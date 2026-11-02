"""Zero-Storage Gemini API Key security guard and CORS/Security headers middleware."""

from __future__ import annotations

import json
import re
from typing import Any

from flask import Flask, Response, jsonify, make_response, request


_FORBIDDEN_HEADER_NAMES = {
    "x-goog-api-key",
    "x-api-key",
    "api-key",
    "x-gemini-api-key",
}

_FORBIDDEN_FIELD_NAMES = {
    "api_key",
    "apikey",
    "x-goog-api-key",
    "x_goog_api_key",
    "gemini_api_key",
    "google_api_key",
    "nanobanana_api_key",
    "secret_key",
    "token_key",
}

_GEMINI_KEY_PATTERN = re.compile(r"AIza[0-9A-Za-z\-_]{15,}")

_ZERO_STORAGE_ERROR_PAYLOAD = {
    "detail": (
        "VIOLAÇÃO DE SEGURANÇA ZERO-STORAGE: O backend Python (Flask + SQLAlchemy) nunca aceita, "
        "processa ou armazena chaves de API (x-goog-api-key / api_key). Mantenha sua chave "
        "exclusivamente na memória volátil (RAM) do navegador e chame o Google Nano Banana "
        "diretamente do cliente."
    ),
    "error_code": "API_KEY_REJECTED_ZERO_STORAGE",
    "key_storage": "never_stored",
}


def _contains_forbidden_key_in_obj(obj: Any) -> bool:
    """Recursively inspect parsed JSON objects for forbidden key names or raw Gemini key patterns."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            key_norm = str(k).strip().lower()
            if key_norm in _FORBIDDEN_FIELD_NAMES:
                return True
            if _contains_forbidden_key_in_obj(v):
                return True
    elif isinstance(obj, list):
        for item in obj:
            if _contains_forbidden_key_in_obj(item):
                return True
    elif isinstance(obj, str):
        if _GEMINI_KEY_PATTERN.search(obj):
            return True
    return False


def zero_storage_api_key_guard() -> Response | None:
    """Reject any request that attempts to send an API key in headers, query params, or body."""
    if request.method == "OPTIONS":
        resp = make_response("", 200)
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "*"
        return resp

    # 1. Check HTTP headers
    for header_name, header_val in request.headers.items():
        h_lower = header_name.lower()
        if h_lower in _FORBIDDEN_HEADER_NAMES:
            return make_response(jsonify(_ZERO_STORAGE_ERROR_PAYLOAD), 400)
        if h_lower == "authorization" and header_val.strip():
            return make_response(jsonify(_ZERO_STORAGE_ERROR_PAYLOAD), 400)
        if _GEMINI_KEY_PATTERN.search(header_val):
            return make_response(jsonify(_ZERO_STORAGE_ERROR_PAYLOAD), 400)

    # 2. Check query parameters
    for param_name, param_val in request.args.items():
        if param_name.strip().lower() in _FORBIDDEN_FIELD_NAMES or _GEMINI_KEY_PATTERN.search(param_val):
            return make_response(jsonify(_ZERO_STORAGE_ERROR_PAYLOAD), 400)

    # 3. Check request body on write methods
    if request.method in {"POST", "PUT", "PATCH"}:
        body_bytes = request.get_data(cache=True)
        if body_bytes:
            try:
                parsed = json.loads(body_bytes.decode("utf-8"))
                if _contains_forbidden_key_in_obj(parsed):
                    return make_response(jsonify(_ZERO_STORAGE_ERROR_PAYLOAD), 400)
            except (UnicodeDecodeError, json.JSONDecodeError):
                raw_text = body_bytes.decode("utf-8", errors="ignore")
                if _GEMINI_KEY_PATTERN.search(raw_text):
                    return make_response(jsonify(_ZERO_STORAGE_ERROR_PAYLOAD), 400)

    return None


def attach_security_and_cors_headers(response: Response) -> Response:
    """Attach Zero-Storage policy and CORS headers to every Flask response."""
    response.headers["X-Key-Storage-Policy"] = "never-stored-browser-only"
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


def register_middleware(app: Flask) -> None:
    """Register before_request and after_request hooks on the Flask application."""
    app.before_request(zero_storage_api_key_guard)
    app.after_request(attach_security_and_cors_headers)
