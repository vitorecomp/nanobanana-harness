"""API Blueprint registration package."""

from __future__ import annotations

from flask import Flask

from app.api.v1 import register_v1_blueprints


def register_blueprints(app: Flask) -> None:
    """Register all API blueprints on the Flask application."""
    register_v1_blueprints(app)
