"""SQLAlchemy 2.0 Engine, SessionLocal, Alembic migration runner, and schema initialization."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Generator

from alembic import command
from alembic.config import Config as AlembicConfig
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy ORM models."""


def _build_engine() -> tuple[Any, str, str]:
    configured_url = settings.database_url
    if configured_url:
        try:
            if configured_url.startswith("sqlite"):
                eng = create_engine(configured_url, connect_args={"check_same_thread": False})
            else:
                eng = create_engine(configured_url, pool_pre_ping=True)
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            return eng, ("postgresql" if "postgres" in configured_url else "sqlite"), configured_url
        except Exception:
            pass

    sqlite_url = f"sqlite:///{settings.DEFAULT_SQLITE_PATH}"
    eng = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    return eng, "sqlite", sqlite_url


engine, ACTIVE_DB_BACKEND, ACTIVE_DATABASE_URL = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """Provide a transactional scope around a series of database operations."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def get_alembic_config() -> AlembicConfig:
    """Build an Alembic Config object pointing to `backend/alembic.ini` and `backend/migrations`."""
    alembic_ini_path = settings.BACKEND_ROOT / "alembic.ini"
    migrations_dir = settings.BACKEND_ROOT / "migrations"
    cfg = AlembicConfig(str(alembic_ini_path) if alembic_ini_path.is_file() else None)
    cfg.set_main_option("script_location", str(migrations_dir))
    cfg.set_main_option("sqlalchemy.url", ACTIVE_DATABASE_URL)
    return cfg


def run_migrations(revision: str = "head") -> None:
    """Run Alembic migrations programmatically to the target revision."""
    import app.models.conversation  # noqa: F401
    import app.models.user  # noqa: F401

    cfg = get_alembic_config()
    command.upgrade(cfg, revision)


def init_db() -> None:
    """Import all ORM models and ensure schema is migrated to head."""
    import app.models.conversation  # noqa: F401
    import app.models.user  # noqa: F401

    try:
        migrations_dir = settings.BACKEND_ROOT / "migrations" / "versions"
        if migrations_dir.is_dir():
            run_migrations("head")
        else:
            Base.metadata.create_all(bind=engine)
    except Exception:
        Base.metadata.create_all(bind=engine)

    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN provider VARCHAR(32) DEFAULT 'google' NOT NULL"))
    except Exception:
        pass

    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE conversation_turns ADD COLUMN is_published BOOLEAN DEFAULT FALSE NOT NULL"))
    except Exception:
        pass
