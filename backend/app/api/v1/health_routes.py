"""Health and studio bootstrap routes (`/api/health`, `/api/bootstrap`)."""

from __future__ import annotations

from flask import Blueprint, Response, jsonify

from app.core.config import settings
from app.db.session import ACTIVE_DB_BACKEND
from app.services.copilot_service import (
    INTERACTIVE_WORKFLOW_STEPS,
    MODIFIER_CATEGORIES,
    QUICK_ITERATION_CHIPS,
    STYLE_PRESETS,
)

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health_check() -> Response:
    """Return service health, Flask + SQLAlchemy + Alembic stack info, and zero-storage declaration."""
    return jsonify(
        {
            "status": "ok",
            "service": settings.SERVICE_NAME,
            "framework": settings.FRAMEWORK,
            "orm": settings.ORM,
            "migrations": "alembic",
            "key_storage": settings.KEY_STORAGE_POLICY,
            "auth_required": settings.is_auth_required(),
            "default_dev_user_id": settings.DEFAULT_DEV_USER_ID,
            "database_backend": ACTIVE_DB_BACKEND,
            "bucket_provider": settings.bucket_provider,
            "bucket_name": settings.bucket_name,
        }
    )


@health_bp.route("/bootstrap", methods=["GET"])
def bootstrap_studio() -> Response:
    """Return all presets, modifier categories, interactive workflow steps, and quick iteration chips."""
    return jsonify(
        {
            "style_presets": STYLE_PRESETS,
            "modifier_categories": MODIFIER_CATEGORIES,
            "interactive_workflow_steps": INTERACTIVE_WORKFLOW_STEPS,
            "quick_iteration_chips": QUICK_ITERATION_CHIPS,
            "auth_required": settings.is_auth_required(),
            "default_dev_user_id": settings.DEFAULT_DEV_USER_ID,
            "security_policy": {
                "key_storage": settings.KEY_STORAGE_POLICY,
                "execution_mode": "direct_browser_to_google_gemini",
                "model_default": settings.DEFAULT_MODEL,
                "framework": settings.FRAMEWORK,
                "orm": settings.ORM,
                "migrations": "alembic",
                "auth_required": settings.is_auth_required(),
                "default_dev_user_id": settings.DEFAULT_DEV_USER_ID,
                "google_auth_supported": True,
                "google_client_id_configured": bool(settings.google_client_id),
                "facebook_auth_supported": True,
                "facebook_app_id_configured": bool(settings.facebook_app_id),
                "database_backend": ACTIVE_DB_BACKEND,
                "bucket_provider": settings.bucket_provider,
                "bucket_name": settings.bucket_name,
            },
        }
    )
