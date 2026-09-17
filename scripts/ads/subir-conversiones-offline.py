#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cruza la planilla de conversaciones con los clics de WhatsApp y sube las conversiones a Google Ads.

    # 1. Traer los clics del buzón (necesita `aws login`):
    python3 scripts/ads/subir-conversiones-offline.py --planilla conversaciones.csv --sync --solo-cruce
    # 2. Validar contra la API sin registrar nada:
    python3 scripts/ads/subir-conversiones-offline.py --planilla conversaciones.csv
    # 3. Subir de verdad:
    python3 scripts/ads/subir-conversiones-offline.py --planilla conversaciones.csv --aplicar

LA PLANILLA (exportada como CSV). Una fila por conversación. Los encabezados se aceptan con o sin
tilde y en cualquier mayúscula:

    codigo | fecha_mensaje | producto | tipo_cliente | fecha_cotizacion | monto_cotizado |
    fecha_venta | monto_venta | motivo_perdida | notas

  - `codigo`: el que llegó al final del mensaje, `#K7Q3M` o `K7Q3M`. Sin código, la fila sirve para
    el análisis pero no se sube: no hay forma de saber de qué anuncio vino.
  - Fechas: `2026-09-18`, `18/09/2026` o con hora, `18/09/2026 14:30`. Hora de Argentina.
  - Montos en pesos: `5.000.000`, `5000000` o `$ 5.000.000,50`.

QUÉ SE SUBE. Una fila con código → "mensaje real". Con `fecha_cotizacion` → además "cotización
enviada" con el monto cotizado como valor. Con `fecha_venta` → además "venta" con el monto real.
Se puede re-subir la planilla entera todos los días: cada conversión lleva `orderId`
`<código>-<etapa>`, y lo ya subido queda anotado en el archivo de estado y se saltea.

Los clics y el estado viven FUERA del repo (`~/.cache/rtm-ads/`): tienen identificadores de clic y
el repo es público.
"""

import argparse
import csv
import json
import re
import subprocess
import sys
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

REF_CODE_PATTERN = re.compile(r"^[2-9A-HJKMNP-Z]{5}$")
CLICK_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,200}$")
# Argentina no tiene horario de verano desde 2009.
ARGENTINA = timezone(timedelta(hours=-3))
# Google Ads rechaza conversiones de clics de más de 90 días.
MAX_CLICK_AGE = timedelta(days=90)
# Un código es único en la práctica, pero no en teoría: sólo se buscan clics de este período antes
# del mensaje, que es mucho más que lo que tarda alguien entre tocar el botón y escribir.
CLICK_LOOKBACK = timedelta(days=30)
# Una fecha de la planilla sin hora, o una hora redondeada a mano, puede quedar antes del clic.
# Google rechaza una conversión anterior al clic, así que se corre a un minuto después.
MIN_GAP_AFTER_CLICK = timedelta(minutes=1)

CACHE_DIR = Path.home() / ".cache" / "rtm-ads"
DEFAULT_CLICKS_DIR = CACHE_DIR / "whatsapp-clicks"
DEFAULT_STATE_FILE = CACHE_DIR / "subidas.json"
S3_CLICKS_URI = "s3://rtm-leads-raw/whatsapp-clicks/"

STAGE_MESSAGE = "mensaje"
STAGE_QUOTE = "cotizacion"
STAGE_SALE = "venta"


# --------------------------------------------------------------------------------------------------
# Lectura de la planilla
# --------------------------------------------------------------------------------------------------

def normalize_header(value):
    text = unicodedata.normalize("NFD", str(value or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def parse_code(value):
    code = str(value or "").strip().upper().lstrip("#").strip()
    return code if REF_CODE_PATTERN.match(code) else ""


def parse_datetime(value):
    """Devuelve `(datetime con zona, tenía_hora)` o `(None, False)`."""
    text = str(value or "").strip()
    if not text:
        return None, False

    formats = [
        ("%Y-%m-%d %H:%M:%S", True), ("%Y-%m-%d %H:%M", True), ("%Y-%m-%d", False),
        ("%d/%m/%Y %H:%M:%S", True), ("%d/%m/%Y %H:%M", True), ("%d/%m/%Y", False),
    ]
    for fmt, has_time in formats:
        try:
            parsed = datetime.strptime(text, fmt)
        except ValueError:
            continue
        if not has_time:
            # Sin hora se toma el mediodía: queda dentro del día aunque la zona se corra, y si cae
            # antes del clic la regla del minuto la corrige.
            parsed = parsed.replace(hour=12)
        return parsed.replace(tzinfo=ARGENTINA), has_time
    return None, False


def parse_amount(value):
    """Pesos argentinos: el punto separa miles y la coma, decimales."""
    text = re.sub(r"[^\d.,-]", "", str(value or ""))
    if not text:
        return None
    text = text.replace(".", "").replace(",", ".")
    try:
        amount = float(text)
    except ValueError:
        return None
    return amount if amount >= 0 else None


def read_sheet(path):
    with open(path, newline="", encoding="utf-8-sig") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(handle, dialect=dialect)
        rows = []
        for line_number, raw in enumerate(reader, start=2):
            row = {normalize_header(key): (value or "").strip() for key, value in raw.items() if key}
            row["_linea"] = line_number
            rows.append(row)
        return rows


# --------------------------------------------------------------------------------------------------
# Clics guardados por la Lambda
# --------------------------------------------------------------------------------------------------

def sync_clicks(clicks_dir):
    clicks_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(["aws", "s3", "sync", S3_CLICKS_URI, str(clicks_dir), "--only-show-errors"], check=True)


def load_clicks(clicks_dir):
    """Índice `código → [clic]`, con la hora del servidor ya parseada."""
    index = {}
    for path in sorted(Path(clicks_dir).rglob("*.json")):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            click = record["click"]
            code = parse_code(click.get("ref"))
            received = datetime.fromisoformat(record["receivedAt"].replace("Z", "+00:00"))
        except (OSError, ValueError, KeyError, TypeError):
            continue
        if not code:
            continue
        ids = {
            name: value for name, value in (click.get("clickIds") or {}).items()
            if name in ("gclid", "gbraid", "wbraid") and isinstance(value, str) and CLICK_ID_PATTERN.match(value)
        }
        index.setdefault(code, []).append({
            "receivedAt": received,
            "clickIds": ids,
            "page": click.get("page", ""),
            "placement": click.get("placement", ""),
        })
    return index


def click_identifier(click_ids):
    """Google acepta UNO por conversión. `gclid` es el más preciso; los otros dos son de iOS."""
    for name in ("gclid", "gbraid", "wbraid"):
        if click_ids.get(name):
            return name, click_ids[name]
    return None, None


def match_click(clicks, message_time):
    """El clic que originó el mensaje, o `(None, motivo)`.

    Varios registros con el mismo código son normales (varios toques en la misma página) y tienen
    los mismos identificadores. Si traen identificadores DISTINTOS, son dos personas con el mismo
    código: se descarta antes que atribuir el mensaje a la persona equivocada.
    """
    if not clicks:
        return None, "no hay ningún clic registrado con ese código"

    window = [
        click for click in clicks
        if message_time is None
        or message_time - CLICK_LOOKBACK <= click["receivedAt"] <= message_time + timedelta(hours=12)
    ]
    if not window:
        return None, "el código existe pero ningún clic cae cerca de la fecha del mensaje"

    with_ids = [click for click in window if click_identifier(click["clickIds"])[0]]
    if not with_ids:
        return None, "el clic no vino de un anuncio de Google (sin gclid/gbraid/wbraid)"

    distinct = {tuple(sorted(click["clickIds"].items())) for click in with_ids}
    if len(distinct) > 1:
        return None, "código ambiguo: dos clics distintos con el mismo código"

    return max(with_ids, key=lambda click: click["receivedAt"]), None


# --------------------------------------------------------------------------------------------------
# Armado de conversiones
# --------------------------------------------------------------------------------------------------

def google_datetime(value):
    """El formato que pide Google Ads: `2026-09-18 14:30:00-03:00`."""
    local = value.astimezone(ARGENTINA)
    return local.strftime("%Y-%m-%d %H:%M:%S") + "-03:00"


def plan_conversions(rows, clicks_index, now=None):
    """Devuelve `(conversiones, avisos)`. No toca la red: es la parte que se prueba."""
    now = now or datetime.now(timezone.utc)
    conversions = []
    notices = []

    for row in rows:
        line = row["_linea"]
        raw_code = row.get("codigo", "")
        code = parse_code(raw_code)
        if not code:
            if raw_code:
                notices.append(f"línea {line}: código «{raw_code}» inválido")
            continue

        message_time, _ = parse_datetime(row.get("fecha_mensaje"))
        click, reason = match_click(clicks_index.get(code, []), message_time)
        if not click:
            notices.append(f"línea {line} ({code}): no se sube, {reason}")
            continue

        if now - click["receivedAt"] > MAX_CLICK_AGE:
            notices.append(f"línea {line} ({code}): no se sube, el clic tiene más de 90 días")
            continue

        id_name, id_value = click_identifier(click["clickIds"])
        earliest = click["receivedAt"] + MIN_GAP_AFTER_CLICK

        stages = [(STAGE_MESSAGE, message_time or earliest, None)]

        quote_time, _ = parse_datetime(row.get("fecha_cotizacion"))
        if quote_time:
            stages.append((STAGE_QUOTE, quote_time, parse_amount(row.get("monto_cotizado"))))
        elif row.get("monto_cotizado"):
            notices.append(f"línea {line} ({code}): hay monto cotizado sin fecha_cotizacion, no se sube la cotización")

        sale_time, _ = parse_datetime(row.get("fecha_venta"))
        if sale_time:
            stages.append((STAGE_SALE, sale_time, parse_amount(row.get("monto_venta"))))
        elif row.get("monto_venta"):
            notices.append(f"línea {line} ({code}): hay monto de venta sin fecha_venta, no se sube la venta")

        for stage, when, amount in stages:
            when = max(when, earliest)
            if when > now:
                notices.append(f"línea {line} ({code}): {stage} con fecha futura, se saltea")
                continue
            conversion = {
                "stage": stage,
                "orderId": f"{code}-{stage}",
                id_name: id_value,
                "conversionDateTime": google_datetime(when),
                "currencyCode": "ARS",
            }
            if stage != STAGE_MESSAGE:
                if amount is None:
                    notices.append(f"línea {line} ({code}): {stage} sin monto, se sube con valor 0")
                conversion["conversionValue"] = amount or 0
            conversions.append(conversion)

    return conversions, notices


def load_state(path):
    try:
        return set(json.loads(Path(path).read_text(encoding="utf-8")).get("subidas", []))
    except (OSError, ValueError):
        return set()


def save_state(path, uploaded):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"subidas": sorted(uploaded)}, indent=2), encoding="utf-8")


# --------------------------------------------------------------------------------------------------
# Subida
# --------------------------------------------------------------------------------------------------

def upload(conversions, apply_changes):
    import ads_api  # recién acá: el cruce y las pruebas no necesitan credenciales

    names = {
        STAGE_MESSAGE: ads_api.ACTION_MESSAGE,
        STAGE_QUOTE: ads_api.ACTION_QUOTE,
        STAGE_SALE: ads_api.ACTION_SALE,
    }
    actions = ads_api.conversion_actions_by_name(list(names.values()))
    missing = [name for name in names.values() if name not in actions]
    if missing:
        raise SystemExit(f"Faltan acciones de conversión en Google Ads: {missing}. Corré crear-acciones-offline.py --aplicar.")

    payload = []
    for conversion in conversions:
        body = {key: value for key, value in conversion.items() if key != "stage"}
        body["conversionAction"] = actions[names[conversion["stage"]]]["resourceName"]
        payload.append(body)

    succeeded = set()
    # La API acepta hasta 2000 conversiones por llamada.
    for start in range(0, len(payload), 2000):
        batch = payload[start:start + 2000]
        response = ads_api.post(":uploadClickConversions", {
            "conversions": batch,
            "partialFailure": True,
            "validateOnly": not apply_changes,
        })

        failed_indexes = set()
        for error in (response.get("partialFailureError") or {}).get("details", [{}])[0].get("errors", []):
            elements = error.get("location", {}).get("fieldPathElements", [])
            index = next((element.get("index") for element in elements if element.get("fieldName") == "conversions"), None)
            if index is not None:
                failed_indexes.add(index)
                print(f"  rechazada {batch[index]['orderId']}: {error.get('message')}")

        for index, conversion in enumerate(batch):
            if index not in failed_indexes:
                succeeded.add(conversion["orderId"])

    return succeeded


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--planilla", required=True, help="CSV exportado de la planilla de conversaciones")
    parser.add_argument("--clics", default=str(DEFAULT_CLICKS_DIR), help="carpeta local con los clics del buzón")
    parser.add_argument("--estado", default=str(DEFAULT_STATE_FILE), help="archivo con lo ya subido")
    parser.add_argument("--sync", action="store_true", help="traer antes los clics nuevos de S3")
    parser.add_argument("--solo-cruce", action="store_true", help="mostrar el cruce sin llamar a Google Ads")
    parser.add_argument("--aplicar", action="store_true", help="subir de verdad (sin esto, validateOnly)")
    args = parser.parse_args()

    clicks_dir = Path(args.clics).expanduser()
    if args.sync:
        sync_clicks(clicks_dir)

    rows = read_sheet(args.planilla)
    clicks_index = load_clicks(clicks_dir)
    conversions, notices = plan_conversions(rows, clicks_index)

    already = load_state(args.estado)
    pending = [conversion for conversion in conversions if conversion["orderId"] not in already]

    print(f"{len(rows)} filas · {sum(len(v) for v in clicks_index.values())} clics · "
          f"{len(conversions)} conversiones · {len(conversions) - len(pending)} ya subidas · {len(pending)} pendientes")
    for notice in notices:
        print(f"  aviso: {notice}")
    for conversion in pending:
        value = conversion.get("conversionValue")
        print(f"  {conversion['orderId']:<20} {conversion['conversionDateTime']}" + (f"  ${value:,.0f}" if value else ""))

    if args.solo_cruce or not pending:
        return 0

    succeeded = upload(pending, args.aplicar)
    if args.aplicar:
        save_state(args.estado, already | succeeded)
        print(f"Subidas {len(succeeded)} de {len(pending)}.")
    else:
        print(f"validateOnly: {len(succeeded)} de {len(pending)} pasarían. Nada cambió. Repetí con --aplicar.")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    try:
        sys.exit(main())
    except subprocess.CalledProcessError as error:
        print(f"Falló `aws s3 sync` (¿sesión vencida? corré `aws login`): {error}", file=sys.stderr)
        sys.exit(1)
    except Exception as error:  # noqa: BLE001 — el mensaje de la API es lo único útil acá
        if error.__class__.__name__ == "AdsApiError":
            print(error, file=sys.stderr)
            sys.exit(1)
        raise
