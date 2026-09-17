#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Crea las tres acciones de conversión offline de WhatsApp en Google Ads.

    python3 scripts/ads/crear-acciones-offline.py            # validateOnly: no cambia nada
    python3 scripts/ads/crear-acciones-offline.py --aplicar  # las crea de verdad

LAS TRES NACEN SECUNDARIAS (`primaryForGoal: false`) Y ESO ES LO IMPORTANTE. Una acción primaria
entra en la puja en el momento en que se crea: la campaña empezaría a optimizar por una señal que
todavía no tiene ni un dato, y Maximizar conversiones volvería a aprender. Secundarias, juntan datos
sin tocar la puja. Pasar "mensaje real" a primaria es una decisión aparte, cuando haya volumen.

"Mensaje real" va en CONTACT, el mismo objetivo que "WhatsApp - clic". Google no permite
IMPORTED_LEAD en acciones UPLOAD_CLICKS (ENUM_VALUE_NOT_PERMITTED, verificado con validateOnly), y
CONTACT simplifica el cambio de puja: la campaña ya tiene ese objetivo como pujable, así que después
alcanza con volver primaria esta acción y secundaria la del clic, sin reconfigurar objetivos.
Cotización y venta van en QUALIFIED_LEAD y CONVERTED_LEAD, cada una en su propio objetivo.

Es idempotente: si una acción con ese nombre ya existe, no la vuelve a crear.
"""

import argparse
import sys

import ads_api

ACTIONS = [
    {
        "name": ads_api.ACTION_MESSAGE,
        "category": "CONTACT",
        # Sin valor: un mensaje no vale lo mismo que otro, y un valor inventado ensuciaría una futura
        # puja por valor.
        "valueSettings": {"defaultValue": 0, "defaultCurrencyCode": "ARS", "alwaysUseDefaultValue": True},
    },
    {
        "name": ads_api.ACTION_QUOTE,
        "category": "QUALIFIED_LEAD",
        # El valor es el monto cotizado, que se manda en cada conversión.
        "valueSettings": {"defaultValue": 0, "defaultCurrencyCode": "ARS", "alwaysUseDefaultValue": False},
    },
    {
        "name": ads_api.ACTION_SALE,
        "category": "CONVERTED_LEAD",
        "valueSettings": {"defaultValue": 0, "defaultCurrencyCode": "ARS", "alwaysUseDefaultValue": False},
    },
]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--aplicar", action="store_true", help="crea las acciones (sin esto, sólo valida)")
    args = parser.parse_args()

    existing = ads_api.conversion_actions_by_name([action["name"] for action in ACTIONS])
    for name, action in existing.items():
        print(f"ya existe: {name} ({action['resourceName']}, primaria={action.get('primaryForGoal')})")

    operations = []
    for action in ACTIONS:
        if action["name"] in existing:
            continue
        operations.append({
            "create": {
                **action,
                "type": "UPLOAD_CLICKS",
                "status": "ENABLED",
                "primaryForGoal": False,
                # Una conversión por clic: dos mensajes de la misma persona desde el mismo anuncio
                # son un solo contacto.
                "countingType": "ONE_PER_CLICK",
                # El máximo que acepta Google. Una cotización o una venta llegan semanas después.
                "clickThroughLookbackWindowDays": 90,
            }
        })

    if not operations:
        print("Nada para crear.")
        return 0

    result = ads_api.post("/conversionActions:mutate", {
        "operations": operations,
        "validateOnly": not args.aplicar,
    })

    if not args.aplicar:
        print(f"validateOnly OK para {len(operations)} acción(es). Nada cambió. Repetí con --aplicar.")
        return 0

    for row in result.get("results", []):
        print(f"creada: {row['resourceName']}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ads_api.AdsApiError as error:
        print(error, file=sys.stderr)
        sys.exit(1)
