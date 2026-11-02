"""Pytest fixtures for the modular Nano Banana Studio Flask application."""

from __future__ import annotations

from pathlib import Path
import sys

from flask import Flask
from flask.testing import FlaskClient
import pytest

_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app import create_app


@pytest.fixture(scope="session")
def app() -> Flask:
    """Create and configure a Flask application instance for testing."""
    return create_app()


@pytest.fixture()
def client(app: Flask) -> FlaskClient:
    """Provide a Flask test client."""
    return app.test_client()
