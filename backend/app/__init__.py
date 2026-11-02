"""Enterprise Flask Application Factory (`create_app`) for Nano Banana Studio."""

from __future__ import annotations

import click
from flask import Flask
from flask_cors import CORS

from app.api import register_blueprints
from app.core.middleware import register_middleware
from app.db.session import init_db, run_migrations


def create_app() -> Flask:
    """Create and configure the modular Flask application."""
    flask_app = Flask(__name__)
    CORS(flask_app, resources={r"/*": {"origins": "*"}})

    init_db()
    register_middleware(flask_app)
    register_blueprints(flask_app)

    @flask_app.cli.command("db-upgrade")
    @click.argument("revision", default="head")
    def db_upgrade_command(revision: str) -> None:
        """Apply Alembic database migrations (`flask --app wsgi:app db-upgrade`)."""
        run_migrations(revision)
        click.echo(f"Alembic migrations applied to '{revision}'.")

    return flask_app


__all__ = ["create_app"]
