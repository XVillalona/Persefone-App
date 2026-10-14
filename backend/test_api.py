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

if __name__ == '__main__':
    unittest.main()
