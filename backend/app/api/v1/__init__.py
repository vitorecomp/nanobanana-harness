"""API v1 Blueprints mounted at `/api`."""

from __future__ import annotations

from flask import Flask

from app.api.v1.auth_routes import auth_bp
from app.api.v1.conversation_routes import conversation_bp
from app.api.v1.copilot_routes import copilot_bp
from app.api.v1.gallery_routes import gallery_bp
from app.api.v1.health_routes import health_bp


def register_v1_blueprints(app: Flask) -> None:
    """Register all v1 route blueprints under `/api`."""
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(copilot_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(conversation_bp, url_prefix="/api")
    app.register_blueprint(gallery_bp, url_prefix="/api")
