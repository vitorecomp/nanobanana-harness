"""Google & Facebook OAuth verification and user provisioning service."""

from __future__ import annotations

import base64
import hashlib
import json
import time
from typing import Any
import uuid

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User, utc_now


_VALID_GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


def resolve_user_id(raw_user_id: Any) -> str | None:
    """Resolve user_id, falling back to `usr_local_dev` when REQUIRE_AUTH is false."""
    cleaned = str(raw_user_id or "").strip()
    if cleaned:
        return cleaned
    if not settings.is_auth_required():
        return settings.DEFAULT_DEV_USER_ID
    return None


def ensure_user_exists(
    db: Session,
    user_id: str | None = None,
    email: str | None = None,
    name: str | None = None,
    picture: str | None = None,
    google_sub: str | None = None,
    provider: str | None = None,
) -> User:
    """Find or create a User record (including `usr_local_dev` in dev mode)."""
    resolved_id = (user_id or "").strip() or settings.DEFAULT_DEV_USER_ID
    if resolved_id == settings.DEFAULT_DEV_USER_ID:
        email = email or "dev@localhost"
        name = name or "Local Dev Instance"
        provider = provider or "local_dev"
        google_sub = google_sub or "local-dev-instance"

    existing = db.query(User).filter(User.id == resolved_id).first()
    if existing:
        if name and existing.name != name:
            existing.name = name
        if picture is not None and picture != existing.picture:
            existing.picture = picture
        if provider and existing.provider != provider:
            existing.provider = provider
        existing.updated_at = utc_now()
        db.commit()
        db.refresh(existing)
        return existing

    clean_email = (email or f"{resolved_id}@nanobanana.local").strip().lower()
    by_email = db.query(User).filter(User.email == clean_email).first()
    if by_email:
        if name:
            by_email.name = name
        if picture is not None:
            by_email.picture = picture
        if provider:
            by_email.provider = provider
        by_email.updated_at = utc_now()
        db.commit()
        db.refresh(by_email)
        return by_email

    sub = google_sub or hashlib.sha256(clean_email.encode("utf-8")).hexdigest()[:16]
    by_sub = db.query(User).filter(User.google_sub == sub).first()
    if by_sub:
        return by_sub

    final_id = resolved_id if resolved_id and not resolved_id.startswith("anon") else f"usr_{uuid.uuid4().hex[:12]}"
    new_user = User(
        id=final_id,
        provider=provider or "google",
        google_sub=sub,
        email=clean_email,
        name=name or clean_email.split("@")[0].replace(".", " ").title(),
        picture=picture or "",
        email_verified=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def _decode_jwt_segment(segment: str) -> dict[str, Any]:
    """Decode a base64url-encoded JWT segment into a dictionary."""
    padding = "=" * ((4 - len(segment) % 4) % 4)
    raw = base64.urlsafe_b64decode((segment + padding).encode("ascii"))
    parsed = json.loads(raw.decode("utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError("Invalid JWT segment.")
    return parsed


def verify_and_parse_google_jwt(
    credential: str, expected_client_id: str | None = None
) -> tuple[dict[str, Any] | None, str | None]:
    """Decode and validate a Google ID token JWT structure and claims."""
    parts = credential.strip().split(".")
    if len(parts) != 3 or not all(parts):
        return None, "Token Google inválido: formato JWT de 3 segmentos esperado."

    try:
        _header = _decode_jwt_segment(parts[0])
        claims = _decode_jwt_segment(parts[1])
    except Exception:
        return None, "Não foi possível decodificar o token JWT do Google."

    issuer = str(claims.get("iss", "")).strip()
    if issuer not in _VALID_GOOGLE_ISSUERS:
        return None, f"Emissor JWT não autorizado ('{issuer}'). Esperado: accounts.google.com."

    exp = claims.get("exp")
    if isinstance(exp, (int, float)) and exp < (time.time() - 60):
        return None, "Sessão Google expirada (exp). Faça login novamente."

    configured_client_id = expected_client_id or settings.google_client_id
    if configured_client_id and claims.get("aud") and claims.get("aud") != configured_client_id:
        return None, "Client ID (aud) do token Google não corresponde ao servidor."

    email = str(claims.get("email", "")).strip().lower()
    if not email or "@" not in email:
        return None, "O token Google não contém um endereço de e-mail válido."

    sub = str(claims.get("sub") or hashlib.sha256(email.encode("utf-8")).hexdigest()[:16])
    name = str(claims.get("name") or email.split("@")[0].replace(".", " ").title())
    picture = str(claims.get("picture") or "")

    return {
        "id": f"usr_{hashlib.sha256(sub.encode('utf-8')).hexdigest()[:12]}",
        "provider": "google",
        "google_sub": sub,
        "name": name,
        "email": email,
        "picture": picture,
        "email_verified": bool(claims.get("email_verified", True)),
    }, None


def update_user_profile(
    db: Session,
    user_id: str,
    name: str | None = None,
    email: str | None = None,
    picture: str | None = None,
    provider: str | None = None,
) -> User:
    """Update an existing user's display name, email, or avatar picture in PostgreSQL."""
    user_row = ensure_user_exists(
        db=db,
        user_id=user_id,
        email=email,
        name=name,
        picture=picture,
        provider=provider,
    )
    if name is not None and name.strip():
        user_row.name = name.strip()
    if email is not None and "@" in email.strip():
        clean_email = email.strip().lower()
        conflict = (
            db.query(User)
            .filter(User.email == clean_email, User.id != user_row.id)
            .first()
        )
        if conflict is None:
            user_row.email = clean_email
    if picture is not None:
        user_row.picture = picture.strip()
    user_row.updated_at = utc_now()
    db.commit()
    db.refresh(user_row)
    return user_row
