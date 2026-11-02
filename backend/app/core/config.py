"""Centralized enterprise configuration for Nano Banana Studio Backend."""

from __future__ import annotations

import os
from pathlib import Path


class Settings:
    """Centralized settings resolved from environment variables."""

    SERVICE_NAME: str = "nanobanana-interactive-backend"
    FRAMEWORK: str = "flask"
    ORM: str = "sqlalchemy"
    KEY_STORAGE_POLICY: str = "never_stored"
    DEFAULT_DEV_USER_ID: str = "usr_local_dev"
    DEFAULT_MODEL: str = "gemini-2.5-flash-image"

    BACKEND_ROOT: Path = Path(__file__).resolve().parents[2]
    PROJECT_ROOT: Path = BACKEND_ROOT.parent
    DEFAULT_SQLITE_PATH: Path = BACKEND_ROOT / "nanobanana.db"
    LOCAL_BUCKET_ROOT: Path = BACKEND_ROOT / ".bucket_storage"
    SHOWCASE_DIR: Path = PROJECT_ROOT / "frontend" / "public"

    @property
    def database_url(self) -> str:
        return os.environ.get("DATABASE_URL", "").strip()

    @property
    def bucket_provider(self) -> str:
        return os.environ.get("BUCKET_PROVIDER", "rustfs").strip() or "rustfs"

    @property
    def bucket_name(self) -> str:
        return (
            os.environ.get("BUCKET_NAME")
            or os.environ.get("S3_BUCKET_NAME")
            or "nanobanana-images"
        ).strip()

    @property
    def bucket_endpoint_url(self) -> str:
        return (
            os.environ.get("BUCKET_ENDPOINT_URL")
            or os.environ.get("S3_ENDPOINT_URL")
            or ""
        ).strip()

    @property
    def bucket_public_url(self) -> str:
        return os.environ.get("BUCKET_PUBLIC_URL", "http://localhost:19000").rstrip("/")

    @property
    def public_backend_url(self) -> str:
        return os.environ.get("PUBLIC_BACKEND_URL", "").rstrip("/")

    @property
    def bucket_access_key(self) -> str:
        return (
            os.environ.get("BUCKET_ACCESS_KEY")
            or os.environ.get("RUSTFS_ACCESS_KEY")
            or os.environ.get("S3_ACCESS_KEY")
            or "rustfsadmin"
        )

    @property
    def bucket_secret_key(self) -> str:
        return (
            os.environ.get("BUCKET_SECRET_KEY")
            or os.environ.get("RUSTFS_SECRET_KEY")
            or os.environ.get("S3_SECRET_KEY")
            or "rustfsadmin"
        )

    @property
    def s3_region(self) -> str:
        return os.environ.get("S3_REGION", "us-east-1")

    @property
    def google_client_id(self) -> str:
        return os.environ.get("GOOGLE_CLIENT_ID", "").strip()

    @property
    def facebook_app_id(self) -> str:
        return os.environ.get("FACEBOOK_APP_ID", "").strip()

    def is_auth_required(self) -> bool:
        """Return True only when REQUIRE_AUTH=true (Production); False in local/dev instances."""
        return os.environ.get("REQUIRE_AUTH", "false").strip().lower() in {"true", "1", "yes"}


settings = Settings()
