import unittest
import os
import sys

# Asegurar path para imports locales
sys.path.insert(0, os.path.dirname(__file__))

from database import get_all_dates_with_counts, get_hub_summary, get_orders_by_date

class TestApiEndpoints(unittest.TestCase):
    def test_dates_query(self):
        """Verifica que la consulta de fechas por hub retorne una lista válida"""
        dates = get_all_dates_with_counts("PUJ")
        self.assertIsInstance(dates, list)

    def test_hub_summary(self):
        """Verifica que el resumen de hubs contenga PUJ y SDQ"""
        summary = get_hub_summary()
        self.assertIn("PUJ", summary)
        self.assertIn("SDQ", summary)

    def test_orders_by_date(self):
        """Verifica la consulta de órdenes con fecha existente o vacía"""
        orders = get_orders_by_date("2026-05-22", "PUJ")
        self.assertIsInstance(orders, list)

    def test_app_endpoints_if_fastapi_available(self):
        """Prueba los nuevos endpoints en app.py si FastAPI está instalado en el entorno"""
        try:
            from app import create_manual_order, audit_clause_12, export_csv
            # 1. Crear orden manual
            payload = {
                "numero_orden": "TEST_UNIT_MANUAL",
                "fecha_agrupacion": "2026-05-22",
                "llegada": "2026-05-22T10:00",
                "salida": "2026-05-22T11:00",
                "matricula": "HI1098",
                "servicios": [{"codigo": "RAMP_PACKAGE", "marcado": True}],
                "hub": "PUJ"
            }
            res_manual = create_manual_order(payload)
            self.assertEqual(res_manual["status"], "created")
            self.assertEqual(res_manual["numero_orden"], "TEST_UNIT_MANUAL")

            # 2. Auditar cláusula 12
            res_audit = audit_clause_12("TEST_UNIT_MANUAL", strict=True)
            self.assertEqual(res_audit["status"], "audited")
            self.assertTrue(res_audit["aplicar_clausula_12_estricta"])

            # 3. Exportar CSV
            res_csv = export_csv(fecha="2026-05-22", hub="PUJ")
            self.assertGreater(len(res_csv.body), 0)
            self.assertIn(b"Reclamado_AVIAM_USD", res_csv.body)
            self.assertIn(b"Conciliado_Arajet_USD", res_csv.body)
        except ImportError:
            pass

if __name__ == '__main__':
    unittest.main()

