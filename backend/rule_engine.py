"""
Motor de Reglas Determinista para Liquidación de Órdenes de Servicio en Rampa AVIAM (PUJ).
Aplica tarifas oficiales 2025 y Concesión Arajet S.A.
PRINCIPIO: La IA extrae; el código calcula.
"""

import json
import os
import re
from datetime import datetime, time
from typing import Dict, Any, List, Optional, Tuple

class RuleEngine:
    def __init__(self, config_path: Optional[str] = None):
        if config_path is None:
            base_dir = os.path.dirname(__file__)
            config_path = os.path.join(base_dir, "tarifas.json")
        self.config_path = config_path
        self.load_config()

    def load_config(self):
        with open(self.config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)

    def _parse_time(self, t_str: Optional[str]) -> Optional[time]:
        if not t_str:
            return None
        # Clean string
        t_clean = t_str.strip().replace(".", ":").replace("-", ":")
        match = re.search(r"(\d{1,2}):(\d{2})", t_clean)
        if match:
            h, m = int(match.group(1)), int(match.group(2))
            return time(h, m)
        match_digits = re.search(r"^(\d{2})(\d{2})$", t_clean)
        if match_digits:
            h, m = int(match_digits.group(1)), int(match_digits.group(2))
            return time(h, m)
        return None

    def _parse_datetime(self, dt_str: Optional[str]) -> Optional[datetime]:
        if not dt_str:
            return None
        dt_clean = dt_str.strip()
        # Common formats: 2026-05-22T11:05, 22-05-26 11:05, 22.05.26 11:05
        patterns = [
            r"(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})",
            r"(\d{2})[-./](\d{2})[-./](\d{2})\s+(\d{2})[:.](\d{2})",
            r"(\d{4})[-./](\d{2})[-./](\d{2})\s+(\d{2})[:.](\d{2})"
        ]
        m = re.search(patterns[0], dt_clean)
        if m:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4)), int(m.group(5)))
        m = re.search(patterns[1], dt_clean)
        if m:
            d, month, y, h, minute = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4)), int(m.group(5))
            year = 2000 + y if y < 100 else y
            return datetime(year, month, d, h, minute)
        m = re.search(patterns[2], dt_clean)
        if m:
            y, month, d, h, minute = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4)), int(m.group(5))
            return datetime(y, month, d, h, minute)
        return None

    def _parse_fraction_or_number(self, val_raw: Optional[str]) -> Tuple[Optional[float], Optional[float], float]:
        """
        Retorna (cantidad, horas, confianza) interpretando fracciones como 1/2, 1/3, 2/1, 4/1.
        """
        if not val_raw or val_raw.strip().upper() in ["-", "N/A", "NO", "JB"]:
            return None, None, 1.0
        v = val_raw.strip()
        # Caso fracción con barra
        if "/" in v:
            parts = v.split("/")
            try:
                p1 = float(parts[0].strip())
                p2 = float(parts[1].strip())
                if p2 == 0:
                    return None, None, 0.4
                if p1 == 1 and p2 in [2, 3, 4]:
                    # 1/2 hora (0.5), 1/3 hora (0.33)
                    return 1.0, p1 / p2, 0.70
                if p2 == 1:
                    # 2/1 = 2 cantidad o 2 horas
                    return p1, p1, 0.70
                return p1 / p2, p1 / p2, 0.50
            except ValueError:
                return None, None, 0.3
        # Caso número entero o decimal
        try:
            num = float(v.replace(",", "."))
            return num, num, 0.95
        except ValueError:
            return None, None, 0.4

    def _es_feriado_rd(self, fecha_str: str) -> bool:
        feriados = [f["fecha"] for f in self.config.get("feriados_republica_dominicana_2026", [])]
        return fecha_str in feriados

    def calcular_orden(self, orden: Dict[str, Any]) -> Dict[str, Any]:
        """
        Procesa una orden de servicio y calcula el costo esperado,
        adicionales, recargos y estado semafórico.
        """
        alertas: List[Dict[str, Any]] = []
        lineas_costo: List[Dict[str, Any]] = []
        
        aerolinea = (orden.get("aerolinea") or "").upper().strip()
        tipo_aeronave = (orden.get("tipo_aeronave") or "").upper().strip()
        es_arajet = "ARAJET" in aerolinea
        es_b737_max8 = "737" in tipo_aeronave or "MAX" in tipo_aeronave
        aplica_concesion = es_arajet and es_b737_max8 and self.config.get("concesion_arajet", {}).get("activa", True)

        # 1. Fechas y Horas (Cálculo de tiempo en tierra)
        dt_llegada = self._parse_datetime(orden.get("llegada"))
        dt_salida = self._parse_datetime(orden.get("salida"))
        tiempo_en_tierra_min = None
        excede_turnaround = False
        exceso_tiempo_min = 0

        tiempo_incluido = 70 if aplica_concesion else self.config.get("tarifario_estandar", {}).get("tabla_5_tiempos_tierra", {}).get("B737-8", 70)

        if dt_llegada and dt_salida:
            delta = dt_salida - dt_llegada
            tiempo_en_tierra_min = int(delta.total_seconds() / 60)
            if tiempo_en_tierra_min < 0:
                alertas.append({
                    "tipo": "ERROR",
                    "codigo": "HORA_INVALIDA",
                    "descripcion": f"La hora de salida ({orden.get('salida')}) es anterior a la llegada ({orden.get('llegada')})",
                    "clausula": "General",
                    "monto": 0.0
                })
            elif tiempo_en_tierra_min > tiempo_incluido:
                excede_turnaround = True
                exceso_tiempo_min = tiempo_en_tierra_min - tiempo_incluido
                alertas.append({
                    "tipo": "ADICIONAL",
                    "codigo": "EXCEDE_TURNAROUND",
                    "descripcion": f"Tiempo en tierra ({tiempo_en_tierra_min} min) excede los {tiempo_incluido} min incluidos en {exceso_tiempo_min} min",
                    "clausula": "Tabla 5 / Concesión 2",
                    "monto": 0.0
                })
        else:
            alertas.append({
                "tipo": "REVISAR",
                "codigo": "FECHAS_FALTANTES",
                "descripcion": "No se pudieron determinar las horas exactas de llegada y salida",
                "clausula": "Formulario F-RAM",
                "monto": 0.0,
                "bloqueante": True
            })

        # 2. Servicios indexados
        servicios_map: Dict[str, Dict[str, Any]] = {}
        for s in orden.get("servicios", []):
            servicios_map[s.get("codigo")] = s

        # Revisión de Observaciones para tiempos de equipos (ACU, GPU, etc.)
        tiempos_obs: Dict[str, Dict[str, Any]] = {}
        for obs_t in orden.get("observaciones_tiempos", []):
            etiqueta = obs_t.get("etiqueta", "").upper().strip()
            tiempos_obs[etiqueta] = obs_t

        obs_texto = (orden.get("observaciones_texto") or "").upper()
        es_ferry = "FERRY" in obs_texto or "VACIO" in obs_texto

        # 3. Paquete de Rampa Base
        costo_base = 0.0
        paquete_item = servicios_map.get("RAMP_PACKAGE")
        esta_marcado_paquete = paquete_item.get("marcado", False) if paquete_item else False

        if aplica_concesion:
            if esta_marcado_paquete or not es_ferry:
                costo_base = self.config["concesion_arajet"]["paquete_rampa_base_usd"]
                lineas_costo.append({
                    "codigo": "RAMP_PACKAGE",
                    "descripcion": "Paquete Básico de Manejo en Rampa Arajet (737 MAX 8)",
                    "cantidad": 1,
                    "unidad": "turnaround",
                    "precio_unitario": 500.00,
                    "total": 500.00,
                    "regla": "Concesión 2: Tarifa plana USD 500 turnaround (70 min)",
                    "es_adicional": False
                })
            else:
                alertas.append({
                    "tipo": "INCONSISTENTE",
                    "codigo": "PAQUETE_NO_MARCADO",
                    "descripcion": "Paquete de rampa no marcado en operación regular",
                    "clausula": "Concesión 2",
                    "monto": 0.0
                })
        else:
            # Tarifa estándar narrowbody
            costo_base = self.config["tarifario_estandar"]["paquete_narrowbody_1_28"]
            lineas_costo.append({
                "codigo": "RAMP_PACKAGE",
                "descripcion": "Paquete Básico de Manejo en Rampa (Tarifa Estándar)",
                "cantidad": 1,
                "unidad": "turnaround",
                "precio_unitario": costo_base,
                "total": costo_base,
                "regla": "Tarifario 2025 Tabla 1",
                "es_adicional": False
            })

        # 4. Servicios Incluidos en el Paquete Arajet (Concesiones)
        # Concesión 6: Crew bus gratis
        cobus_item = servicios_map.get("COBUS")
        if cobus_item and cobus_item.get("marcado"):
            cant_cobus = cobus_item.get("cantidad") or 1
            if cant_cobus == 1 and aplica_concesion:
                lineas_costo.append({
                    "codigo": "COBUS_CREW",
                    "descripcion": "Transporte de Tripulación (Crew Bus)",
                    "cantidad": 1,
                    "unidad": "servicio",
                    "precio_unitario": 0.0,
                    "total": 0.0,
                    "regla": "Concesión 6: 1 transporte de tripulación gratis por turnaround",
                    "es_adicional": False
                })
            else:
                # Cobus adicional para pasajeros
                extra_cant = cant_cobus - (1 if aplica_concesion else 0)
                precio_cobus = 125.00
                total_cobus = extra_cant * precio_cobus
                lineas_costo.append({
                    "codigo": "COBUS_EXTRA",
                    "descripcion": f"Cobus adicional ({extra_cant} servicio/s)",
                    "cantidad": extra_cant,
                    "unidad": "servicio",
                    "precio_unitario": precio_cobus,
                    "total": total_cobus,
                    "regla": "Tabla 6: Cobus Narrowbody USD 125",
                    "es_adicional": True
                })

        # Concesión 4: Agua Potable + Lavatory
        tiene_agua = servicios_map.get("POTABLE_WATER", {}).get("marcado", False)
        tiene_banos = servicios_map.get("LAVATORY", {}).get("marcado", False)
        if aplica_concesion:
            if tiene_agua and tiene_banos:
                lineas_costo.append({
                    "codigo": "WATER_LAVATORY_COMBO",
                    "descripcion": "Agua Potable + Baños (Lavatory) Combinados",
                    "cantidad": 1,
                    "unidad": "servicio combinado",
                    "precio_unitario": 50.00,
                    "total": 50.00,
                    "regla": "Concesión 4: Tarifa plana USD 50.00 combinada por ambos servicios",
                    "es_adicional": True
                })
            elif tiene_agua or tiene_banos:
                svc_desc = "Agua Potable" if tiene_agua else "Baños / Lavatory"
                lineas_costo.append({
                    "codigo": "WATER_OR_LAVATORY",
                    "descripcion": f"Servicio individual de {svc_desc}",
                    "cantidad": 1,
                    "unidad": "servicio",
                    "precio_unitario": 50.00,
                    "total": 50.00,
                    "regla": "Concesión 4 (Tarifa unificada)",
                    "es_adicional": True
                })
        else:
            if tiene_agua:
                lineas_costo.append({
                    "codigo": "POTABLE_WATER",
                    "descripcion": "Agua Potable",
                    "cantidad": 1,
                    "unidad": "servicio",
                    "precio_unitario": 60.00,
                    "total": 60.00,
                    "regla": "Tabla 6",
                    "es_adicional": True
                })
            if tiene_banos:
                lineas_costo.append({
                    "codigo": "LAVATORY",
                    "descripcion": "Baños / Lavatory",
                    "cantidad": 1,
                    "unidad": "servicio",
                    "precio_unitario": 80.00,
                    "total": 80.00,
                    "regla": "Tabla 6",
                    "es_adicional": True
                })

        # 5. Limpieza de Cabina (Concesión 7)
        limpieza_item = servicios_map.get("CABIN_CLEANING")
        if limpieza_item and limpieza_item.get("marcado"):
            valor_raw = (limpieza_item.get("valor_raw") or "").strip()
            # Determinar tipo
            if tiempo_en_tierra_min is not None and tiempo_en_tierra_min <= 70:
                # Turnaround <= 70 min DEBE ser Tipo 1
                if "2" in valor_raw:
                    alertas.append({
                        "tipo": "INCONSISTENTE",
                        "codigo": "LIMPIEZA_TIPO_2_INVALIDA",
                        "descripcion": f"Limpieza Tipo 2 registrada pero el tiempo en tierra ({tiempo_en_tierra_min} min) es <= 70 min. Arajet solo permite Tipo 1 en rotación corta.",
                        "clausula": "Concesión 7",
                        "monto": 85.00
                    })
                lineas_costo.append({
                    "codigo": "CABIN_CLEANING_T1",
                    "descripcion": "Limpieza de Cabina Tipo 1 (Tránsito)",
                    "cantidad": 1,
                    "unidad": "servicio",
                    "precio_unitario": 70.00,
                    "total": 70.00,
                    "regla": "Concesión 7 / Tabla 3: Tipo 1 USD 70.00 para turnarounds <= 70 min",
                    "es_adicional": True
                })
            else:
                # Turnaround > 70 min puede ser Tipo 2 ($85 con concesión) o Tipo 1 ($70)
                es_tipo_2 = "2" in valor_raw or "T2" in valor_raw or "TIPO 2" in valor_raw
                tarifa_limpieza = 85.00 if es_tipo_2 else 70.00
                tipo_str = "Tipo 2" if es_tipo_2 else "Tipo 1 (o revisión)"
                regla_str = "Concesión 7: USD 85.00 para Tipo 2" if es_tipo_2 else "Concesión 7 / Tabla 3: USD 70.00"
                if not valor_raw:
                    alertas.append({
                        "tipo": "REVISAR",
                        "codigo": "TIPO_LIMPIEZA_AMBIGUO",
                        "descripcion": f"Turnaround extendido ({tiempo_en_tierra_min} min). Tipo de limpieza no especificado claramente en casilla.",
                        "clausula": "Concesión 7",
                        "monto": tarifa_limpieza
                    })
                lineas_costo.append({
                    "codigo": "CABIN_CLEANING",
                    "descripcion": f"Limpieza de Cabina {tipo_str}",
                    "cantidad": 1,
                    "unidad": "servicio",
                    "precio_unitario": tarifa_limpieza,
                    "total": tarifa_limpieza,
                    "regla": regla_str,
                    "es_adicional": True
                })

        # 6. GPU (Ground Power Unit) - Concesión 9
        gpu_item = servicios_map.get("GPU")
        if gpu_item and gpu_item.get("marcado"):
            gpu_minutos = None
            # Revisar si hay tiempo en observaciones
            if "GPU" in tiempos_obs:
                t_ini = self._parse_time(tiempos_obs["GPU"].get("inicio"))
                t_fin = self._parse_time(tiempos_obs["GPU"].get("fin"))
                if t_ini and t_fin:
                    gpu_minutos = (t_fin.hour * 60 + t_fin.minute) - (t_ini.hour * 60 + t_ini.minute)
                    if gpu_minutos < 0:
                        gpu_minutos += 24 * 60

            gpu_val_raw = (gpu_item.get("valor_raw") or "").strip()
            es_jb = gpu_val_raw.upper() == "JB" or "JB" in gpu_val_raw.upper()

            if es_jb:
                # Conectado a Jet Bridge
                lineas_costo.append({
                    "codigo": "GPU_JB",
                    "descripcion": "Energía Eléctrica vía Jet Bridge (JB)",
                    "cantidad": 1,
                    "unidad": "conexión JB",
                    "precio_unitario": 0.0,
                    "total": 0.0,
                    "regla": "Conexión a puente de abordaje (sin cargo GPU móvil)",
                    "es_adicional": False
                })
            else:
                # Cobro por tiempo Concesión 9: Mínimo 1 hora ($150), luego bloques de 30 min ($75) redondeados arriba
                if gpu_minutos is None:
                    # Estimar a partir de valor_raw (ej. 1/2 hora -> mínimo 1 hora por regla)
                    cant, hrs, conf = self._parse_fraction_or_number(gpu_val_raw)
                    gpu_minutos = int((hrs or 1.0) * 60)

                if gpu_minutos <= 60:
                    total_gpu = 150.00
                    desc_gpu = f"GPU: Activación primera hora ({gpu_minutos} min)"
                else:
                    minutos_extra = gpu_minutos - 60
                    bloques = (minutos_extra + 29) // 30  # Round up to next 30 min block
                    total_gpu = 150.00 + (bloques * 75.00)
                    desc_gpu = f"GPU: 1h base ($150) + {bloques} bloque/s de 30m ({minutos_extra}m extra = ${bloques*75})"

                lineas_costo.append({
                    "codigo": "GPU",
                    "descripcion": desc_gpu,
                    "cantidad": round(gpu_minutos / 60.0, 2),
                    "unidad": "horas",
                    "precio_unitario": 150.00,
                    "total": total_gpu,
                    "regla": "Concesión 9: Mínimo 1 hora ($150) + bloques 30 min ($75) redondeo hacia arriba",
                    "es_adicional": True
                })

        # 7. ACU (Aire Acondicionado) - Tabla 6
        acu_item = servicios_map.get("ACU")
        if acu_item and acu_item.get("marcado"):
            acu_minutos = None
            if "ACU" in tiempos_obs:
                t_ini = self._parse_time(tiempos_obs["ACU"].get("inicio"))
                t_fin = self._parse_time(tiempos_obs["ACU"].get("fin"))
                if t_ini and t_fin:
                    acu_minutos = (t_fin.hour * 60 + t_fin.minute) - (t_ini.hour * 60 + t_ini.minute)
                    if acu_minutos < 0:
                        acu_minutos += 24 * 60

            acu_val_raw = (acu_item.get("valor_raw") or "").strip()
            es_jb_acu = acu_val_raw.upper() == "JB" or "JB" in acu_val_raw.upper()

            if es_jb_acu:
                lineas_costo.append({
                    "codigo": "ACU_JB",
                    "descripcion": "Aire Acondicionado vía Jet Bridge (JB)",
                    "cantidad": 1,
                    "unidad": "conexión JB",
                    "precio_unitario": 0.0,
                    "total": 0.0,
                    "regla": "Conexión a puente de abordaje",
                    "es_adicional": False
                })
            else:
                if acu_minutos is None:
                    cant, hrs, conf = self._parse_fraction_or_number(acu_val_raw)
                    acu_minutos = int((hrs or 1.0) * 60)
                
                horas_acu = round(acu_minutos / 60.0, 2)
                total_acu = round(horas_acu * 155.00, 2)
                lineas_costo.append({
                    "codigo": "ACU",
                    "descripcion": f"Aire Acondicionado Móvil ({acu_minutos} min / {horas_acu} hrs)",
                    "cantidad": horas_acu,
                    "unidad": "horas",
                    "precio_unitario": 155.00,
                    "total": total_acu,
                    "regla": "Tabla 6: USD 155.00 / hora",
                    "es_adicional": True
                })

        # 8. Otros Equipos de Tabla 6 (Pushback, Man Hour, Tractor, Baggage Cart, etc.)
        items_tabla_6 = [
            ("PUSHBACK", 150.00, "servicio", "Push-Tractor / Remolcador"),
            ("MAN_HOUR", 16.00, "hora", "Hora-Hombre / Man-Hour"),
            ("TRACTOR_TRUCK", 55.00, "hora", "Tractor / Truck"),
            ("BAGGAGE_CART", 20.00, "hora", "Carro de Equipaje / Baggage Cart"),
            ("CARGOVEYOR", 38.00, "hora", "Correa de Equipaje / Cargoveyor"),
            ("PASSENGER_STAIRS", 100.00, "0.5 hora", "Escalera de Abordaje / Passenger Stairs"),
            ("LOADER", 85.00, "0.5 hora", "Elevador de Carga / Loader"),
            ("DISABLED_LIFT", 50.00, "servicio", "Ascensor Discapacitados / Disabled Lift")
        ]

        for cod, tarifa_std, unidad_std, nombre_std in items_tabla_6:
            item = servicios_map.get(cod)
            if item and item.get("marcado"):
                raw_v = str(item.get("valor_raw") or "")
                cant, hrs, conf = self._parse_fraction_or_number(raw_v)
                c_final = cant if cant is not None else (item.get("cantidad") or 1.0)
                
                if cod == "MAN_HOUR" and "/" in raw_v:
                    # En Man-Hour, "4/1" usualmente significa 4 hombres x 1 hora o 4 horas
                    parts = raw_v.split("/")
                    try:
                        c_final = float(parts[0]) * float(parts[1])
                    except:
                        c_final = 4.0
                
                tot = round(c_final * tarifa_std, 2)
                lineas_costo.append({
                    "codigo": cod,
                    "descripcion": f"{nombre_std} (x{c_final})",
                    "cantidad": c_final,
                    "unidad": unidad_std,
                    "precio_unitario": tarifa_std,
                    "total": tot,
                    "regla": f"Tabla 6: USD {tarifa_std} por {unidad_std}",
                    "es_adicional": True
                })

        # 9. Recargos Porcentuales (+15% Nocturno, +15% Domingos y Feriados)
        recargos_total = 0.0
        aplica_nocturno = False
        aplica_domingo_feriado = False

        if dt_llegada:
            h_arr = dt_llegada.time()
            # Nocturno: 22:00 a 05:59
            if h_arr >= time(22, 0) or h_arr <= time(5, 59):
                aplica_nocturno = True
            
            # Domingo o Feriado RD: 06:00 a 21:59
            fecha_str = dt_llegada.strftime("%Y-%m-%d")
            es_domingo = dt_llegada.weekday() == 6
            es_feriado = self._es_feriado_rd(fecha_str)

            if (es_domingo or es_feriado) and (time(6, 0) <= h_arr <= time(21, 59)):
                aplica_domingo_feriado = True

        if aplica_nocturno:
            monto_noc = round(costo_base * 0.15, 2)
            recargos_total += monto_noc
            lineas_costo.append({
                "codigo": "RECARGO_NOCTURNO",
                "descripcion": "Recargo Operación Nocturna (22:00 - 05:59) +15%",
                "cantidad": 1,
                "unidad": "recargo %",
                "precio_unitario": monto_noc,
                "total": monto_noc,
                "regla": "Tarifario 2025 Nota 8: +15% sobre paquete básico",
                "es_adicional": True
            })

        if aplica_domingo_feriado:
            motivo = "Domingo" if dt_llegada.weekday() == 6 else "Feriado Dominicano"
            monto_dom = round(costo_base * 0.15, 2)
            recargos_total += monto_dom
            lineas_costo.append({
                "codigo": "RECARGO_DOMINGO_FERIADO",
                "descripcion": f"Recargo {motivo} (06:00 - 21:59) +15%",
                "cantidad": 1,
                "unidad": "recargo %",
                "precio_unitario": monto_dom,
                "total": monto_dom,
                "regla": "Tarifario 2025 Nota 9: +15% sobre paquete básico",
                "es_adicional": True
            })

        # Verificación de casilla "15% Adicional" en el formulario
        casilla_15 = servicios_map.get("EXTRA_15", {}).get("marcado", False)
        if casilla_15 and not (aplica_nocturno or aplica_domingo_feriado):
            alertas.append({
                "tipo": "INCONSISTENTE",
                "codigo": "CASILLA_15_SIN_JUSTIFICACION",
                "descripcion": "Casilla '15% Adicional' marcada en formulario pero el vuelo no es nocturno, domingo ni feriado RD",
                "clausula": "Notas 8 y 9",
                "monto": round(costo_base * 0.15, 2)
            })
        elif not casilla_15 and (aplica_nocturno or aplica_domingo_feriado):
            alertas.append({
                "tipo": "ADVERTENCIA",
                "codigo": "CASILLA_15_NO_MARCADA",
                "descripcion": "Aplica recargo del 15% por horario/día pero la casilla no está marcada en el formulario físico",
                "clausula": "Notas 8 y 9",
                "monto": round(costo_base * 0.15, 2)
            })

        # 10. Totales y Estado Semafórico
        costo_adicionales = sum(l["total"] for l in lineas_costo if l["es_adicional"])
        costo_total_esperado = round(costo_base + costo_adicionales, 2)

        # Determinar estado
        # 🟢 CONFORME, 🟠 CON ADICIONALES, 🔴 INCONSISTENTE, ⚪ REVISAR
        hay_bloqueo_revisar = any(a["tipo"] == "REVISAR" and a.get("bloqueante", False) for a in alertas)
        hay_inconsistencias = any(a["tipo"] == "INCONSISTENTE" or a["tipo"] == "ERROR" for a in alertas)
        
        # Verificar firmas
        firmas = orden.get("firmas", {})
        if not firmas.get("aviam") or not firmas.get("aerolinea"):
            alertas.append({
                "tipo": "ADVERTENCIA",
                "codigo": "FIRMA_FALTANTE",
                "descripcion": "Falta una o ambas firmas (AVIAM / Aerolínea) en el pie del formulario",
                "clausula": "F-RAM-AVL-MAG 04 Pie",
                "monto": 0.0
            })

        if hay_bloqueo_revisar:
            estado = "REVISAR"
        elif hay_inconsistencias:
            estado = "INCONSISTENTE"
        elif costo_adicionales > 0 or excede_turnaround:
            estado = "CON_ADICIONALES"
        else:
            estado = "CONFORME"

        return {
            "numero_orden": orden.get("numero_orden"),
            "aerolinea": aerolinea,
            "matricula": orden.get("matricula"),
            "tipo_aeronave": tipo_aeronave,
            "vuelo_entrante": orden.get("vuelo_entrante"),
            "vuelo_saliente": orden.get("vuelo_saliente"),
            "llegada": orden.get("llegada"),
            "salida": orden.get("salida"),
            "tiempo_en_tierra_min": tiempo_en_tierra_min,
            "tiempo_incluido_min": tiempo_incluido,
            "excede_turnaround": excede_turnaround,
            "exceso_tiempo_min": exceso_tiempo_min,
            "costo_base": costo_base,
            "costo_adicionales": round(costo_adicionales, 2),
            "costo_total_esperado": costo_total_esperado,
            "lineas_costo": lineas_costo,
            "alertas": alertas,
            "estado": estado
        }
