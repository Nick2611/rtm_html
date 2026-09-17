#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cliente mínimo de la API REST de Google Ads para los scripts de conversiones offline.

Sólo biblioteca estándar. La autenticación es la misma que ya se usa para escribir en la cuenta:
Application Default Credentials de gcloud + el developer token de la variable de entorno. NADA
secreto vive en este archivo: el repo es público.

    gcloud auth application-default login --scopes=https://www.googleapis.com/auth/adwords,...
    export GOOGLE_ADS_DEVELOPER_TOKEN=...   (ya está en ~/.zshrc)
"""

import json
import os
import subprocess
import urllib.error
import urllib.request

# Sólo v22 responde en esta cuenta; v17-v21 devuelven 404.
API_VERSION = "v22"
CUSTOMER_ID = "8067335472"
LOGIN_CUSTOMER_ID = "5059822509"
BASE_URL = f"https://googleads.googleapis.com/{API_VERSION}/customers/{CUSTOMER_ID}"

# Los nombres son el contrato entre los dos scripts: uno las crea, el otro las busca por nombre.
ACTION_MESSAGE = "WhatsApp - mensaje real"
ACTION_QUOTE = "WhatsApp - cotización enviada"
ACTION_SALE = "WhatsApp - venta"


class AdsApiError(RuntimeError):
    def __init__(self, status, payload):
        super().__init__(f"Google Ads API respondió {status}: {json.dumps(payload, ensure_ascii=False)[:2000]}")
        self.status = status
        self.payload = payload


def _access_token():
    try:
        return subprocess.run(
            ["gcloud", "auth", "application-default", "print-access-token"],
            check=True, capture_output=True, text=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(
            "No se pudo obtener el token de gcloud. Corré `gcloud auth application-default login` "
            f"con el scope de adwords. Detalle: {error}"
        )


def _developer_token():
    token = os.environ.get("GOOGLE_ADS_DEVELOPER_TOKEN", "").strip()
    if not token:
        raise SystemExit("Falta GOOGLE_ADS_DEVELOPER_TOKEN en el entorno.")
    return token


def post(path, body):
    """POST a `BASE_URL + path`. Devuelve el JSON de respuesta o lanza AdsApiError."""
    request = urllib.request.Request(
        BASE_URL + path,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {_access_token()}",
            "developer-token": _developer_token(),
            "login-customer-id": LOGIN_CUSTOMER_ID,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"raw": raw}
        raise AdsApiError(error.code, payload) from None


def search(query):
    """GAQL. Devuelve la lista de filas (sin paginar: las consultas de estos scripts son chicas)."""
    return post("/googleAds:search", {"query": query}).get("results", [])


def conversion_actions_by_name(names):
    quoted = ", ".join("'" + name.replace("'", "\\'") + "'" for name in names)
    rows = search(
        "SELECT conversion_action.resource_name, conversion_action.name, conversion_action.status, "
        "conversion_action.type, conversion_action.primary_for_goal "
        f"FROM conversion_action WHERE conversion_action.name IN ({quoted}) "
        "AND conversion_action.status != 'REMOVED'"
    )
    return {row["conversionAction"]["name"]: row["conversionAction"] for row in rows}
