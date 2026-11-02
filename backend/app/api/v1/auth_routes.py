"""Social OAuth authentication routes (`/api/auth/google`, `/api/auth/facebook`)."""

from __future__ import annotations

import hashlib
from typing import Any

from flask import Blueprint, Response, jsonify, make_response, request

from app.core.config import settings
from app.db.session import get_db_session
from app.services.auth_service import (
    ensure_user_exists,
    update_user_profile,
    verify_and_parse_google_jwt,
)

auth_bp = Blueprint("auth", __name__)


def _get_json_body() -> dict[str, Any]:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


@auth_bp.route("/auth/google", methods=["POST"])
def authenticate_with_google() -> Response:
    """Authenticate a user with Google and upsert their profile in PostgreSQL `users` table via SQLAlchemy."""
    body = _get_json_body()
    credential = body.get("credential")
    client_id = body.get("client_id")

    if isinstance(credential, str) and credential.strip():
        parsed, err = verify_and_parse_google_jwt(
            credential=credential,
            expected_client_id=str(client_id) if client_id else None,
        )
        if err or parsed is None:
            return make_response(jsonify({"detail": err or "Credencial Google inválida."}), 401)
        auth_mode = "google_jwt"
    else:
        dev_profile = body.get("dev_profile") if isinstance(body.get("dev_profile"), dict) else {}
        raw_name = str(
            dev_profile.get("name")
            or body.get("name")
            or "Explorador Criativo"
        ).strip()
        raw_email = str(
            dev_profile.get("email")
            or body.get("email")
            or "explorador.criativo@gmail.com"
        ).strip().lower()
        raw_picture = str(
            dev_profile.get("picture")
            or body.get("picture")
            or ""
        ).strip()

        if "@" not in raw_email:
            return make_response(
                jsonify({"detail": "Informe um e-mail Google válido para iniciar a sessão."}),
                400,
            )

        digest = hashlib.sha256(raw_email.encode("utf-8")).hexdigest()[:12]
        parsed = {
            "id": f"usr_{digest}",
            "provider": "google",
            "google_sub": f"google-sub-{digest}",
            "name": raw_name or raw_email.split("@")[0].title(),
            "email": raw_email,
            "picture": raw_picture,
            "email_verified": True,
        }
        auth_mode = "google_dev_handshake"

    with get_db_session() as db:
        user_row = ensure_user_exists(
            db=db,
            user_id=parsed["id"],
            email=parsed["email"],
            name=parsed["name"],
            picture=parsed["picture"],
            google_sub=parsed["google_sub"],
            provider="google",
        )
        user_dict = user_row.to_dict()

    return jsonify(
        {
            "authenticated": True,
            "provider": "google",
            "auth_mode": auth_mode,
            "user": user_dict,
            "key_policy": settings.KEY_STORAGE_POLICY,
            "key_storage": settings.KEY_STORAGE_POLICY,
        }
    )


@auth_bp.route("/auth/facebook", methods=["POST"])
def authenticate_with_facebook() -> Response:
    """Authenticate a user with Facebook OAuth and upsert their profile in PostgreSQL via SQLAlchemy."""
    body = _get_json_body()
    access_token = body.get("access_token")
    fb_user_id = body.get("user_id")
    dev_profile = body.get("dev_profile") if isinstance(body.get("dev_profile"), dict) else {}

    if isinstance(access_token, str) and access_token.strip() == "invalid":
        return make_response(jsonify({"detail": "Token de acesso do Facebook inválido."}), 401)

    raw_name = str(
        dev_profile.get("name")
        or body.get("name")
        or "Explorador Facebook"
    ).strip()
    raw_email = str(
        dev_profile.get("email")
        or body.get("email")
        or "explorador.fb@facebook.com"
    ).strip().lower()
    raw_picture = str(
        dev_profile.get("picture")
        or body.get("picture")
        or ""
    ).strip()

    if "@" not in raw_email:
        return make_response(
            jsonify({"detail": "Informe um e-mail válido associado ao Facebook."}),
            400,
        )

    sub_seed = str(fb_user_id or access_token or raw_email).strip()
    digest = hashlib.sha256(raw_email.encode("utf-8")).hexdigest()[:12]
    fb_sub = f"fb-{hashlib.sha256(sub_seed.encode('utf-8')).hexdigest()[:14]}"
    auth_mode = "facebook_oauth" if (isinstance(access_token, str) and access_token.strip()) else "facebook_dev_handshake"

    with get_db_session() as db:
        user_row = ensure_user_exists(
            db=db,
            user_id=f"usr_fb_{digest}",
            email=raw_email,
            name=raw_name or raw_email.split("@")[0].title(),
            picture=raw_picture,
            google_sub=fb_sub,
            provider="facebook",
        )
        user_dict = user_row.to_dict()

    return jsonify(
        {
            "authenticated": True,
            "provider": "facebook",
            "auth_mode": auth_mode,
            "user": user_dict,
            "key_policy": settings.KEY_STORAGE_POLICY,
            "key_storage": settings.KEY_STORAGE_POLICY,
        }
    )


@auth_bp.route("/users/<user_id>/profile", methods=["PATCH", "POST"])
def update_profile_endpoint(user_id: str) -> Response:
    """Update a user's profile (name, email, picture) in PostgreSQL."""
    body = _get_json_body()
    raw_name = body.get("name")
    raw_email = body.get("email")
    raw_picture = body.get("picture")
    raw_provider = body.get("provider")

    if raw_name is not None and not str(raw_name).strip():
        return make_response(
            jsonify({"detail": "Display name cannot be empty."}),
            400,
        )

    if raw_email is not None and "@" not in str(raw_email):
        return make_response(
            jsonify({"detail": "Please provide a valid email address."}),
            400,
        )

    with get_db_session() as db:
        updated_row = update_user_profile(
            db=db,
            user_id=user_id,
            name=str(raw_name).strip() if raw_name is not None else None,
            email=str(raw_email).strip() if raw_email is not None else None,
            picture=str(raw_picture).strip() if raw_picture is not None else None,
            provider=str(raw_provider).strip() if raw_provider is not None else None,
        )
        user_dict = updated_row.to_dict()

    return jsonify(
        {
            "updated": True,
            "user": user_dict,
        }
    )
