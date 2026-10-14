"""
Pruebas Unitarias del Motor de Reglas Determinista (AVIAM / Arajet)
"""

import unittest
from rule_engine import RuleEngine

class TestRuleEngine(unittest.TestCase):
    def setUp(self):
        self.engine = RuleEngine()

    def test_caso_conforme_basico(self):
        """Vuelo estándar de 60 min sin equipos adicionales: debe ser CONFORME"""
        orden = {
            "numero_orden": "TEST_001",
            "aerolinea": "ARAJET",
            "tipo_aeronave": "B737 MAX 8",
            "matricula": "HI1098",
            "llegada": "2026-05-22T10:00",
            "salida": "2026-05-22T11:00",
            "servicios": [
                {"codigo": "RAMP_PACKAGE", "marcado": True},
                {"codigo": "COBUS", "marcado": True, "cantidad": 1} # Crew bus cortesía
            ],
            "firmas": {"aviam": True, "aerolinea": True}
        }
        res = self.engine.calcular_orden(orden)
        self.assertEqual(res["costo_base"], 500.00)
        self.assertEqual(res["costo_adicionales"], 0.0)
        self.assertEqual(res["costo_total_esperado"], 500.00)
        self.assertFalse(res["excede_turnaround"])
        self.assertEqual(res["estado"], "CONFORME")

    def test_concesion_4_agua_y_banos_combo(self):
        """Agua + Baños combinados deben cobrar exactamente USD 50.00 (Concesión 4)"""
        orden = {
            "numero_orden": "TEST_COMBO",
            "aerolinea": "ARAJET",
            "tipo_aeronave": "B737 MAX 8",
            "matricula": "HI1098",
            "llegada": "2026-05-22T10:00",
            "salida": "2026-05-22T11:00",
            "servicios": [
                {"codigo": "RAMP_PACKAGE", "marcado": True},
                {"codigo": "POTABLE_WATER", "marcado": True},
                {"codigo": "LAVATORY", "marcado": True}
            ],
            "firmas": {"aviam": True, "aerolinea": True}
        }
        res = self.engine.calcular_orden(orden)
        self.assertEqual(res["costo_base"], 500.00)
        self.assertEqual(res["costo_adicionales"], 50.00)
        self.assertEqual(res["costo_total_esperado"], 550.00)
        combo_line = next(l for l in res["lineas_costo"] if l["codigo"] == "WATER_LAVATORY_COMBO")
        self.assertEqual(combo_line["total"], 50.00)
        self.assertEqual(res["estado"], "CON_ADICIONALES")

    def test_concesion_9_gpu_bloques(self):
        """GPU 135 minutos (11:30 - 13:45) -> 1h base ($150) + 75m extra (3 bloques de 30m = $225) = $375"""
        orden = {
            "numero_orden": "TEST_GPU",
            "aerolinea": "ARAJET",
            "tipo_aeronave": "B737 MAX 8",
            "matricula": "HI1098",
            "llegada": "2026-05-22T11:05",
            "salida": "2026-05-22T13:58",
            "servicios": [
                {"codigo": "RAMP_PACKAGE", "marcado": True},
                {"codigo": "GPU", "marcado": True, "valor_raw": "1/3"}
            ],
            "observaciones_tiempos": [
                {"etiqueta": "GPU", "inicio": "11:30", "fin": "13:45", "raw": "GPU:11:30/13:45"}
            ],
            "firmas": {"aviam": True, "aerolinea": True}
        }
        res = self.engine.calcular_orden(orden)
        gpu_line = next(l for l in res["lineas_costo"] if l["codigo"] == "GPU")
        # 135 min: 60 min ($150) + 75 min extra (ceil(75/30)=3 bloques * $75 = $225) -> $375
        self.assertEqual(gpu_line["total"], 375.00)

    def test_caso_real_orden_457012(self):
        """Caso Real del lote 22MAY2026: Orden 457012 (HI1098)"""
        orden = {
            "numero_orden": "457012",
            "aerolinea": "ARAJET",
            "tipo_aeronave": "B737 MAX 8",
            "matricula": "HI1098",
            "llegada": "2026-05-22T11:05",
            "salida": "2026-05-22T13:58",
            "servicios": [
                {"codigo": "RAMP_PACKAGE", "marcado": True},
                {"codigo": "CABIN_CLEANING", "marcado": True, "valor_raw": ""},
                {"codigo": "POTABLE_WATER", "marcado": True},
                {"codigo": "LAVATORY", "marcado": True},
                {"codigo": "ACU", "marcado": True, "valor_raw": "1/3"},
                {"codigo": "GPU", "marcado": True, "valor_raw": "1/3"},
                {"codigo": "BAGGAGE_CART", "marcado": True, "valor_raw": "1"},
                {"codigo": "TRACTOR_TRUCK", "marcado": True, "valor_raw": "1"},
                {"codigo": "MAN_HOUR", "marcado": True, "valor_raw": "4/2"},
                {"codigo": "PUSHBACK", "marcado": True, "valor_raw": "1"},
                {"codigo": "COBUS", "marcado": True, "cantidad": 3}
            ],
            "observaciones_tiempos": [
                {"etiqueta": "ACU", "inicio": "11:30", "fin": "13:45"},
                {"etiqueta": "GPU", "inicio": "11:30", "fin": "13:45"}
            ],
            "firmas": {"aviam": True, "aerolinea": True}
        }
        res = self.engine.calcular_orden(orden)
        # 11:05 a 13:58 = 173 min (> 70 min)
        self.assertTrue(res["excede_turnaround"])
        self.assertEqual(res["tiempo_en_tierra_min"], 173)
        self.assertEqual(res["exceso_tiempo_min"], 103)
        self.assertEqual(res["costo_base"], 500.00)
        self.assertGreater(res["costo_adicionales"], 500.00)
        self.assertEqual(res["estado"], "CON_ADICIONALES")

    def test_caso_real_orden_456809(self):
        """Caso Real del lote 22MAY2026: Orden 456809 (HI1081)"""
        orden = {
            "numero_orden": "456809",
            "aerolinea": "ARAJET",
            "tipo_aeronave": "B737 MAX 8",
            "matricula": "HI1081",
            "llegada": "2026-05-22T11:38",
            "salida": "2026-05-22T14:04",
            "servicios": [
                {"codigo": "RAMP_PACKAGE", "marcado": True},
                {"codigo": "CABIN_CLEANING", "marcado": True},
                {"codigo": "POTABLE_WATER", "marcado": True},
                {"codigo": "LAVATORY", "marcado": True},
                {"codigo": "ACU", "marcado": True, "valor_raw": "1/2"},
                {"codigo": "GPU", "marcado": True, "valor_raw": "1/2"},
                {"codigo": "BAGGAGE_CART", "marcado": True, "valor_raw": "2"},
                {"codigo": "TRACTOR_TRUCK", "marcado": True, "valor_raw": "2"},
                {"codigo": "PUSHBACK", "marcado": True, "valor_raw": "1"}
            ],
            "observaciones_tiempos": [
                {"etiqueta": "GPU", "inicio": "12:00", "fin": "13:56"},
                {"etiqueta": "ACU", "inicio": "12:09", "fin": "13:56"}
            ],
            "firmas": {"aviam": True, "aerolinea": True}
        }
        res = self.engine.calcular_orden(orden)
        # 11:38 a 14:04 = 146 min
        self.assertTrue(res["excede_turnaround"])
        self.assertEqual(res["tiempo_en_tierra_min"], 146)
        self.assertEqual(res["estado"], "CON_ADICIONALES")

    def test_recargo_nocturno(self):
        """Vuelo nocturno a las 23:00 debe generar +15% sobre paquete ($75)"""
        orden = {
            "numero_orden": "TEST_NIGHT",
            "aerolinea": "ARAJET",
            "tipo_aeronave": "B737 MAX 8",
            "matricula": "HI1098",
            "llegada": "2026-05-22T23:10",
            "salida": "2026-05-22T23:55",
            "servicios": [{"codigo": "RAMP_PACKAGE", "marcado": True}],
            "firmas": {"aviam": True, "aerolinea": True}
        }
        res = self.engine.calcular_orden(orden)
        noc_line = next(l for l in res["lineas_costo"] if l["codigo"] == "RECARGO_NOCTURNO")
        self.assertEqual(noc_line["total"], 75.00)

if __name__ == "__main__":
    unittest.main()
