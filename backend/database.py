"""
Módulo de Persistencia SQLite para Órdenes de Servicio AVIAM.
Permite idempotencia por numero_orden, trazabilidad de JSON crudo vs editado, y auditoría.
"""

import sqlite3
import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "aviam_crm.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()
    
    # Tabla de órdenes
    c.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_orden TEXT UNIQUE NOT NULL,
        pagina INTEGER NOT NULL,
        fecha_agrupacion TEXT NOT NULL, -- YYYY-MM-DD (fecha de llegada)
        aerolinea TEXT,
        matricula TEXT,
        tipo_aeronave TEXT,
        posicion TEXT,
        vuelo_entrante TEXT,
        vuelo_saliente TEXT,
        llegada TEXT,
        salida TEXT,
        estado TEXT NOT NULL, -- CONFORME, CON_ADICIONALES, INCONSISTENTE, REVISAR
        costo_base REAL NOT NULL,
        costo_adicionales REAL NOT NULL,
        costo_total_esperado REAL NOT NULL,
        tiempo_en_tierra_min INTEGER,
        excede_turnaround BOOLEAN,
        confianza_promedio REAL,
        raw_json TEXT NOT NULL,
        edited_json TEXT,
        calculation_json TEXT NOT NULL,
        imagen_path TEXT,
        validada BOOLEAN DEFAULT 0,
        hub TEXT DEFAULT 'PUJ',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Migración: Verificar si la columna hub existe en orders, si no, agregarla
    c.execute("PRAGMA table_info(orders)")
    cols = [r["name"] for r in c.fetchall()]
    if "hub" not in cols:
        c.execute("ALTER TABLE orders ADD COLUMN hub TEXT DEFAULT 'PUJ'")

    # Tabla de histórico de subidas / batches
    c.execute("""
    CREATE TABLE IF NOT EXISTS upload_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_archivo TEXT NOT NULL,
        hub TEXT DEFAULT 'PUJ',
        total_paginas INTEGER NOT NULL,
        ordenes_procesadas INTEGER NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Migración upload_batches para columna hub si no existe
    c.execute("PRAGMA table_info(upload_batches)")
    batch_cols = [r["name"] for r in c.fetchall()]
    if "hub" not in batch_cols:
        c.execute("ALTER TABLE upload_batches ADD COLUMN hub TEXT DEFAULT 'PUJ'")

    conn.commit()
    conn.close()

def save_or_update_order(order_data: Dict[str, Any], calc_data: Dict[str, Any], raw_json_str: str, imagen_path: str = "", hub: str = "PUJ") -> int:
    conn = get_connection()
    c = conn.cursor()
    
    num_orden = str(order_data.get("numero_orden"))
    pagina = order_data.get("pagina", 1)
    
    # Extraer fecha de agrupación (YYYY-MM-DD de llegada)
    llegada = order_data.get("llegada", "")
    fecha_agrupacion = "2026-05-22"
    if llegada and len(llegada) >= 10:
        fecha_agrupacion = llegada[:10]
    
    # Confianza promedio
    servicios = order_data.get("servicios", [])
    confs = [s.get("confianza", 0.9) for s in servicios if "confianza" in s]
    conf_prom = round(sum(confs) / len(confs), 2) if confs else 0.90

    # Normalizar hub
    hub_clean = (hub or order_data.get("hub") or "PUJ").strip().upper()
    if hub_clean not in ["PUJ", "SDQ"]:
        hub_clean = "PUJ"

    c.execute("""
    INSERT INTO orders (
        numero_orden, pagina, fecha_agrupacion, aerolinea, matricula, tipo_aeronave,
        posicion, vuelo_entrante, vuelo_saliente, llegada, salida,
        estado, costo_base, costo_adicionales, costo_total_esperado,
        tiempo_en_tierra_min, excede_turnaround, confianza_promedio,
        raw_json, edited_json, calculation_json, imagen_path, hub, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(numero_orden) DO UPDATE SET
        pagina = excluded.pagina,
        fecha_agrupacion = excluded.fecha_agrupacion,
        aerolinea = excluded.aerolinea,
        matricula = excluded.matricula,
        tipo_aeronave = excluded.tipo_aeronave,
        posicion = excluded.posicion,
        vuelo_entrante = excluded.vuelo_entrante,
        vuelo_saliente = excluded.vuelo_saliente,
        llegada = excluded.llegada,
        salida = excluded.salida,
        estado = excluded.estado,
        costo_base = excluded.costo_base,
        costo_adicionales = excluded.costo_adicionales,
        costo_total_esperado = excluded.costo_total_esperado,
        tiempo_en_tierra_min = excluded.tiempo_en_tierra_min,
        excede_turnaround = excluded.excede_turnaround,
        confianza_promedio = excluded.confianza_promedio,
        edited_json = excluded.edited_json,
        calculation_json = excluded.calculation_json,
        imagen_path = COALESCE(NULLIF(excluded.imagen_path, ''), orders.imagen_path),
        hub = COALESCE(excluded.hub, orders.hub, 'PUJ'),
        actualizado_en = CURRENT_TIMESTAMP;
    """, (
        num_orden, pagina, fecha_agrupacion, order_data.get("aerolinea"), order_data.get("matricula"),
        order_data.get("tipo_aeronave"), order_data.get("posicion"), order_data.get("vuelo_entrante"),
        order_data.get("vuelo_saliente"), llegada, order_data.get("salida"),
        calc_data.get("estado"), calc_data.get("costo_base"), calc_data.get("costo_adicionales"),
        calc_data.get("costo_total_esperado"), calc_data.get("tiempo_en_tierra_min"),
        calc_data.get("excede_turnaround"), conf_prom,
        raw_json_str, json.dumps(order_data), json.dumps(calc_data), imagen_path, hub_clean
    ))
    
    order_id = c.lastrowid
    conn.commit()
    conn.close()
    return order_id

def get_orders_by_date(fecha: str, hub: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    if hub and hub.upper() in ["PUJ", "SDQ"]:
        c.execute("SELECT * FROM orders WHERE fecha_agrupacion = ? AND (hub = ? OR hub IS NULL) ORDER BY llegada ASC", (fecha, hub.upper()))
    else:
        c.execute("SELECT * FROM orders WHERE fecha_agrupacion = ? ORDER BY llegada ASC", (fecha,))
    rows = c.fetchall()
    orders = []
    for r in rows:
        d = dict(r)
        d["calculation"] = json.loads(d["calculation_json"])
        d["data"] = json.loads(d["edited_json"] or d["raw_json"])
        orders.append(d)
    conn.close()
    return orders

def get_all_dates_with_counts(hub: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    query = """
    SELECT fecha_agrupacion, COUNT(*) as total_ordenes,
           SUM(costo_total_esperado) as total_usd,
           SUM(costo_adicionales) as total_adicionales_usd,
           SUM(CASE WHEN estado = 'CONFORME' THEN 1 ELSE 0 END) as conformes,
           SUM(CASE WHEN estado = 'CON_ADICIONALES' THEN 1 ELSE 0 END) as adicionales,
           SUM(CASE WHEN estado = 'INCONSISTENTE' THEN 1 ELSE 0 END) as inconsistentes,
           SUM(CASE WHEN estado = 'REVISAR' THEN 1 ELSE 0 END) as revisar
    FROM orders
    """
    params = []
    if hub and hub.upper() in ["PUJ", "SDQ"]:
        query += " WHERE hub = ? OR hub IS NULL"
        params.append(hub.upper())
    
    query += """
    GROUP BY fecha_agrupacion
    ORDER BY fecha_agrupacion DESC
    """
    c.execute(query, params)
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_hub_summary() -> Dict[str, Any]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
    SELECT 
        COALESCE(hub, 'PUJ') as hub_name,
        COUNT(*) as total_ordenes,
        SUM(costo_total_esperado) as total_usd,
        SUM(costo_adicionales) as total_adicionales_usd,
        COUNT(DISTINCT fecha_agrupacion) as dias_operacion
    FROM orders
    GROUP BY COALESCE(hub, 'PUJ')
    """)
    rows = c.fetchall()
    conn.close()
    res = {"PUJ": {"total_ordenes": 0, "total_usd": 0.0, "total_adicionales_usd": 0.0, "dias_operacion": 0},
           "SDQ": {"total_ordenes": 0, "total_usd": 0.0, "total_adicionales_usd": 0.0, "dias_operacion": 0}}
    for r in rows:
        h = r["hub_name"]
        if h in res:
            res[h] = dict(r)
    return res

def get_order_by_number(numero_orden: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM orders WHERE numero_orden = ?", (numero_orden,))
    row = c.fetchone()
    if not row:
        conn.close()
        return None
    d = dict(row)
    d["calculation"] = json.loads(d["calculation_json"])
    d["data"] = json.loads(d["edited_json"] or d["raw_json"])
    conn.close()
    return d

def mark_order_validated(numero_orden: str, validada: bool = True):
    conn = get_connection()
    c = conn.cursor()
    c.execute("UPDATE orders SET validada = ?, actualizado_en = CURRENT_TIMESTAMP WHERE numero_orden = ?", (1 if validada else 0, numero_orden))
    conn.commit()
    conn.close()

def delete_orders_by_date(fecha: str, hub: Optional[str] = None) -> int:
    """
    Elimina todas las órdenes registradas para una fecha determinada (y opcionalmente por hub).
    Retorna el número de órdenes eliminadas.
    """
    conn = get_connection()
    c = conn.cursor()
    if hub and hub.upper() in ["PUJ", "SDQ"]:
        c.execute("DELETE FROM orders WHERE fecha_agrupacion = ? AND (hub = ? OR hub IS NULL)", (fecha, hub.upper()))
    else:
        c.execute("DELETE FROM orders WHERE fecha_agrupacion = ?", (fecha,))
    deleted_count = c.rowcount
    conn.commit()
    conn.close()
    return deleted_count

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)

