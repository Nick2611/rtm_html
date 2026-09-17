#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pruebas del cruce planilla × clics. Sin red ni credenciales.

    python3 -m unittest scripts/ads/test_subir_conversiones.py

Lo que protegen, en orden de gravedad si se rompen:
  1. Un mensaje nunca se atribuye a la persona equivocada (código ambiguo o fuera de ventana).
  2. Ninguna conversión queda antes del clic: Google la rechaza.
  3. Los montos en formato argentino no se leen mil veces más chicos o más grandes.
"""

import csv
import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("subir", HERE / "subir-conversiones-offline.py")
subir = importlib.util.module_from_spec(spec)
spec.loader.exec_module(subir)

UTC = timezone.utc
NOW = datetime(2026, 9, 25, 15, 0, tzinfo=UTC)
GCLID = "Cj0KCQjw_abc-123XYZ"


def click(received, **ids):
    return {"receivedAt": received, "clickIds": ids, "page": "/productos/totems.html", "placement": "hero"}


def row(line=2, **values):
    return {"_linea": line, **values}


class ParseTests(unittest.TestCase):
    def test_codigo_con_numeral_y_minusculas(self):
        self.assertEqual(subir.parse_code(" #k7q3m "), "K7Q3M")
        self.assertEqual(subir.parse_code("K0Q3M"), "")

    def test_montos_argentinos(self):
        self.assertEqual(subir.parse_amount("5.000.000"), 5_000_000)
        self.assertEqual(subir.parse_amount("$ 5.000.000,50"), 5_000_000.5)
        self.assertEqual(subir.parse_amount("300000"), 300_000)
        self.assertIsNone(subir.parse_amount(""))

    def test_fechas_con_y_sin_hora(self):
        with_time, has_time = subir.parse_datetime("18/09/2026 14:30")
        self.assertTrue(has_time)
        self.assertEqual(with_time.utcoffset(), timedelta(hours=-3))
        date_only, has_time = subir.parse_datetime("2026-09-18")
        self.assertFalse(has_time)
        self.assertEqual(date_only.hour, 12)

    def test_encabezados_con_tilde(self):
        self.assertEqual(subir.normalize_header("Código"), "codigo")
        self.assertEqual(subir.normalize_header("Fecha cotización"), "fecha_cotizacion")


class MatchTests(unittest.TestCase):
    def test_varios_toques_mismo_codigo_une_igual(self):
        t = datetime(2026, 9, 18, 17, 0, tzinfo=UTC)
        chosen, reason = subir.match_click(
            [click(t, gclid=GCLID), click(t + timedelta(minutes=2), gclid=GCLID)], t + timedelta(minutes=5)
        )
        self.assertIsNone(reason)
        self.assertEqual(chosen["receivedAt"], t + timedelta(minutes=2))

    def test_codigo_ambiguo_no_se_atribuye(self):
        t = datetime(2026, 9, 18, 17, 0, tzinfo=UTC)
        chosen, reason = subir.match_click([click(t, gclid=GCLID), click(t, gclid="OtroGclid123")], t)
        self.assertIsNone(chosen)
        self.assertIn("ambiguo", reason)

    def test_clic_viejo_con_mismo_codigo_queda_fuera_de_ventana(self):
        t = datetime(2026, 9, 18, 17, 0, tzinfo=UTC)
        chosen, reason = subir.match_click([click(t - timedelta(days=40), gclid=GCLID)], t)
        self.assertIsNone(chosen)

    def test_clic_organico_no_se_sube(self):
        t = datetime(2026, 9, 18, 17, 0, tzinfo=UTC)
        chosen, reason = subir.match_click([click(t)], t)
        self.assertIsNone(chosen)
        self.assertIn("sin gclid", reason)

    def test_gclid_gana_sobre_gbraid(self):
        self.assertEqual(subir.click_identifier({"gbraid": "b", "gclid": "g"}), ("gclid", "g"))
        self.assertEqual(subir.click_identifier({"wbraid": "w"}), ("wbraid", "w"))


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.click_time = datetime(2026, 9, 18, 17, 0, tzinfo=UTC)  # 14:00 en Argentina
        self.index = {"K7Q3M": [click(self.click_time, gclid=GCLID)]}

    def test_embudo_completo_genera_tres_conversiones(self):
        rows = [row(
            codigo="#K7Q3M", fecha_mensaje="18/09/2026 14:05",
            fecha_cotizacion="20/09/2026", monto_cotizado="5.000.000",
            fecha_venta="24/09/2026 10:00", monto_venta="4.800.000",
        )]
        conversions, notices = subir.plan_conversions(rows, self.index, now=NOW)

        self.assertEqual([c["orderId"] for c in conversions], ["K7Q3M-mensaje", "K7Q3M-cotizacion", "K7Q3M-venta"])
        self.assertEqual(conversions[0]["conversionDateTime"], "2026-09-18 14:05:00-03:00")
        self.assertNotIn("conversionValue", conversions[0])
        self.assertEqual(conversions[1]["conversionValue"], 5_000_000)
        self.assertEqual(conversions[2]["conversionValue"], 4_800_000)
        self.assertTrue(all(c["gclid"] == GCLID for c in conversions))
        self.assertEqual(notices, [])

    def test_fecha_sin_hora_anterior_al_clic_se_corre_despues_del_clic(self):
        # Clic el 18 a las 14:00 AR; la planilla dice "18/09/2026" → mediodía, antes del clic.
        rows = [row(codigo="K7Q3M", fecha_mensaje="18/09/2026")]
        conversions, _ = subir.plan_conversions(rows, self.index, now=NOW)
        self.assertEqual(conversions[0]["conversionDateTime"], "2026-09-18 14:01:00-03:00")

    def test_clic_de_mas_de_90_dias_no_se_sube(self):
        index = {"K7Q3M": [click(NOW - timedelta(days=95), gclid=GCLID)]}
        rows = [row(codigo="K7Q3M", fecha_mensaje="")]
        conversions, notices = subir.plan_conversions(rows, index, now=NOW)
        self.assertEqual(conversions, [])
        self.assertIn("90 días", notices[0])

    def test_monto_sin_fecha_avisa_y_no_inventa_fecha(self):
        rows = [row(codigo="K7Q3M", fecha_mensaje="18/09/2026 14:05", monto_cotizado="300.000")]
        conversions, notices = subir.plan_conversions(rows, self.index, now=NOW)
        self.assertEqual([c["orderId"] for c in conversions], ["K7Q3M-mensaje"])
        self.assertTrue(any("sin fecha_cotizacion" in n for n in notices))

    def test_fila_sin_codigo_se_ignora_en_silencio(self):
        conversions, notices = subir.plan_conversions([row(producto="tótem")], self.index, now=NOW)
        self.assertEqual((conversions, notices), ([], []))


class FilesTests(unittest.TestCase):
    def test_csv_con_punto_y_coma_y_clics_de_la_lambda(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            sheet = tmp / "planilla.csv"
            with open(sheet, "w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle, delimiter=";")
                writer.writerow(["Código", "Fecha mensaje", "Producto"])
                writer.writerow(["#K7Q3M", "18/09/2026 14:05", "Tótem"])

            day = tmp / "clics" / "2026" / "09" / "18"
            day.mkdir(parents=True)
            (day / "K7Q3M-uuid.json").write_text(json.dumps({
                "schemaVersion": 1,
                "receivedAt": "2026-09-18T17:00:00.000Z",
                "click": {"ref": "K7Q3M", "page": "/productos/totems.html", "clickIds": {"gclid": GCLID}},
            }))

            rows = subir.read_sheet(sheet)
            index = subir.load_clicks(tmp / "clics")
            conversions, _ = subir.plan_conversions(rows, index, now=NOW)

            self.assertEqual(rows[0]["codigo"], "#K7Q3M")
            self.assertEqual(len(conversions), 1)
            self.assertEqual(conversions[0]["gclid"], GCLID)


if __name__ == "__main__":
    unittest.main()
