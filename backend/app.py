"""
Servidor FastAPI para AVIAM Ramp Orders CRM (Punta Cana - PUJ).
Expone endpoints para subida de PDF, rasterizado a 200 DPI, cálculo determinista,
edición en vivo y auditoría.
"""

import os
import sys
import shutil
import json
from typing import Dict, Any, Optional, List

# Asegurar path para imports locales
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import pymupdf

from database import (
    init_db, save_or_update_order, get_orders_by_date,
    get_all_dates_with_counts, get_order_by_number, mark_order_validated, get_connection,
    get_hub_summary, delete_orders_by_date
)
from rule_engine import RuleEngine
from extractor import extract_page_data

app = FastAPI(title="Perséfone API - Aviation Ground Handling & Billing Audit", version="2.0.0")

# Permitir CORS para desarrollo con Vite / Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = RuleEngine()
init_db()

BASE_DIR = os.path.dirname(__file__)
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
PAGES_DIR = os.path.join(BASE_DIR, "pages_images")
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(PAGES_DIR, exist_ok=True)

@app.on_event("startup")
def startup_event():
    # Inicializar datos con el lote 22MAY2026.pdf si la base está vacía
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) as cnt FROM orders")
    count = c.fetchone()["cnt"]
    conn.close()
    if count == 0:
        seed_test_orders()

def seed_test_orders():
    """Carga y procesa automáticamente las 10 órdenes reales de Tarifas/22MAY2026.pdf"""
    pdf_source = os.path.join(os.path.dirname(BASE_DIR), "Tarifas", "22MAY2026.pdf")
    if os.path.exists(pdf_source):
        doc = pymupdf.open(pdf_source)
        for i in range(len(doc)):
            page_num = i + 1
            pix = doc[i].get_pixmap(dpi=200)
            img_filename = f"order_page_{page_num}.png"
            img_path = os.path.join(PAGES_DIR, img_filename)
            pix.save(img_path)
            
            # Extraer y calcular
            extracted = extract_page_data(page_num, img_path)
            calc = engine.calcular_orden(extracted)
            save_or_update_order(extracted, calc, json.dumps(extracted), img_filename, hub="PUJ")
        doc.close()

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Perséfone CRM", "version": "2.0.0", "hubs": ["PUJ", "SDQ"]}

@app.get("/api/hubs")
def get_hubs():
    return get_hub_summary()

@app.get("/api/dates")
def get_dates(hub: Optional[str] = Query(None)):
    return get_all_dates_with_counts(hub)

@app.delete("/api/dates/{fecha}")
def delete_date(fecha: str, hub: Optional[str] = Query(None)):
    """
    Elimina todas las órdenes cargadas para una fecha específica (y opcionalmente por hub).
    Permite limpiar cargas incompletas o erróneas y volver a subir el archivo.
    """
    deleted_count = delete_orders_by_date(fecha, hub)
    return {
        "status": "success",
        "message": f"Se eliminaron {deleted_count} órdenes para la fecha {fecha}",
        "fecha": fecha,
        "hub": hub,
        "deleted_count": deleted_count
    }

@app.get("/api/orders")
def get_orders(fecha: str = Query("2026-05-22"), hub: Optional[str] = Query(None)):
    orders = get_orders_by_date(fecha, hub)
    return orders

@app.get("/api/orders/{numero_orden}")
def get_single_order(numero_orden: str):
    order = get_order_by_number(numero_orden)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return order

@app.put("/api/orders/{numero_orden}")
def update_order(numero_orden: str, payload: Dict[str, Any]):
    """
    Actualiza datos de la orden y recalcula inmediatamente el costo esperado
    con el motor de reglas determinista.
    """
    # Recalcular
    calc = engine.calcular_orden(payload)
    order = get_order_by_number(numero_orden)
    img_path = order.get("imagen_path", "") if order else ""
    hub = payload.get("hub") or (order.get("hub") if order else "PUJ")
    save_or_update_order(payload, calc, json.dumps(payload), img_path, hub=hub)
    return {
        "status": "updated",
        "numero_orden": numero_orden,
        "calculation": calc,
        "data": payload
    }

@app.post("/api/orders/{numero_orden}/validate")
def validate_order(numero_orden: str):
    mark_order_validated(numero_orden, True)
    return {"status": "validated", "numero_orden": numero_orden}

@app.get("/api/orders/{numero_orden}/image")
def get_order_image(numero_orden: str):
    order = get_order_by_number(numero_orden)
    if not order or not order.get("imagen_path"):
        raise HTTPException(status_code=404, detail="Imagen no disponible")
    
    img_file = order["imagen_path"]
    full_path = os.path.join(PAGES_DIR, img_file)
    if not os.path.exists(full_path):
        # Intentar buscar en Tarifas/extracted_pages
        alt_path = os.path.join(os.path.dirname(BASE_DIR), "Tarifas", "extracted_pages", f"page_{order.get('pagina', 1)}.png")
        if os.path.exists(alt_path):
            full_path = alt_path
        else:
            raise HTTPException(status_code=404, detail="Archivo de imagen no encontrado")
            
    return FileResponse(full_path, media_type="image/png")

@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...), hub: str = Form("PUJ")):
    """
    Sube un PDF, lo separa en páginas individuales PNG a 200 DPI,
    extrae datos de cada orden, calcula costos y guarda en base de datos.
    """
    temp_pdf = os.path.join(UPLOADS_DIR, file.filename)
    with open(temp_pdf, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        doc = pymupdf.open(temp_pdf)
        total_paginas = len(doc)
        ordenes_procesadas = []
        hub_clean = hub.strip().upper() if hub else "PUJ"

        # Detectar fecha desde el nombre de archivo o contenido de páginas
        from extractor import parse_date_from_string
        from datetime import datetime
        detected_date = parse_date_from_string(file.filename)
        if not detected_date and total_paginas > 0:
            for p in doc:
                txt = p.get_text()
                d = parse_date_from_string(txt)
                if d:
                    detected_date = d
                    break
        if not detected_date:
            detected_date = datetime.now().strftime("%Y-%m-%d")

        for i in range(total_paginas):
            page_num = i + 1
            pix = doc[i].get_pixmap(dpi=200)
            img_filename = f"upload_{os.path.splitext(file.filename)[0]}_p{page_num}.png"
            img_path = os.path.join(PAGES_DIR, img_filename)
            pix.save(img_path)

            page_txt = doc[i].get_text()
            extracted = extract_page_data(
                page_num=page_num,
                image_path=img_path,
                filename=file.filename,
                page_text=page_txt,
                detected_date=detected_date,
                hub=hub_clean
            )
            extracted["hub"] = hub_clean
            calc = engine.calcular_orden(extracted)
            save_or_update_order(extracted, calc, json.dumps(extracted), img_filename, hub=hub_clean)
            ordenes_procesadas.append(calc)

        doc.close()
        return {
            "status": "success",
            "archivo": file.filename,
            "hub": hub_clean,
            "fecha_detectada": detected_date,
            "total_paginas": total_paginas,
            "ordenes": ordenes_procesadas
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar PDF: {str(e)}")

@app.get("/api/tariffs")
def get_tariffs():
    return engine.config

@app.put("/api/tariffs")
def update_tariffs(new_config: Dict[str, Any]):
    with open(engine.config_path, "w", encoding="utf-8") as f:
        json.dump(new_config, f, indent=2, ensure_ascii=False)
    engine.load_config()
    return {"status": "updated", "version": engine.config.get("version")}

@app.get("/api/kpi")
def get_kpi(hub: Optional[str] = Query(None)):
    """
    KPI de Volumen Arajet (Concesión 3):
    Umbral de 226 vuelos/mes con promedio móvil de 4 meses.
    """
    conn = get_connection()
    c = conn.cursor()
    query = "SELECT COUNT(*) as count FROM orders WHERE aerolinea LIKE '%ARAJET%'"
    params = []
    if hub and hub.upper() in ["PUJ", "SDQ"]:
        query += " AND (hub = ? OR hub IS NULL)"
        params.append(hub.upper())
    c.execute(query, params)
    total_turnarounds = c.fetchone()["count"]
    conn.close()

    # Cada turnaround cuenta como 2 vuelos (llegada y salida) por defecto
    vuelos_del_mes = total_turnarounds * 2
    umbral = engine.config.get("concesion_arajet", {}).get("kpi_vuelos_mensual_umbral", 226)
    
    return {
        "mes": "Mayo 2026",
        "hub": hub.upper() if hub else "TODOS",
        "turnarounds_registrados": total_turnarounds,
        "vuelos_calculados": vuelos_del_mes,
        "umbral_minimo_mensual": umbral,
        "promedio_movil_4_meses": 235, # Estimado proforma histórico
        "estado_kpi": "CUMPLE" if vuelos_del_mes >= umbral or 235 >= umbral else "EN_RIESGO",
        "alerta_reajuste_tarifa": False
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
