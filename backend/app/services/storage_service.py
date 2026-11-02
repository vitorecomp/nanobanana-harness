"""RustFS S3-compatible Object Storage Bucket service (+ local mirror) for Nano Banana Studio."""

from __future__ import annotations

import base64
import re
from typing import Any
import uuid

from app.core.config import settings


_FALLBACK_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)

_DATA_URL_PATTERN = re.compile(r"^data:(?P<mime>[\w/+.-]+);base64,(?P<data>.+)$", re.DOTALL)


def _get_rustfs_s3_client() -> Any | None:
    """Return a configured boto3 S3-compatible client targeting RustFS."""
    endpoint = settings.bucket_endpoint_url
    if not endpoint:
        return None
    try:
        import boto3  # type: ignore[import-untyped]
        from botocore.config import Config  # type: ignore[import-untyped]

        return boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=settings.bucket_access_key,
            aws_secret_access_key=settings.bucket_secret_key,
            region_name=settings.s3_region,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                connect_timeout=2,
                read_timeout=3,
                retries={"max_attempts": 1},
            ),
        )
    except Exception:
        return None


def _parse_image_source(image_data_url: str) -> tuple[bytes, str, str]:
    """Extract raw image bytes, MIME type, and file extension from a data URL or showcase path."""
    raw = image_data_url.strip()

    match = _DATA_URL_PATTERN.match(raw)
    if match:
        mime = match.group("mime").lower()
        b64_data = match.group("data").strip()
        try:
            image_bytes = base64.b64decode(b64_data)
        except Exception:
            image_bytes = _FALLBACK_PNG_BYTES
        ext = "png"
        if "jpeg" in mime or "jpg" in mime:
            ext = "jpg"
        elif "webp" in mime:
            ext = "webp"
        elif "svg" in mime:
            ext = "svg"
        return image_bytes, mime, ext

    if raw.startswith("/showcase/"):
        candidate = settings.SHOWCASE_DIR / raw.lstrip("/")
        if candidate.is_file():
            return candidate.read_bytes(), "image/png", candidate.suffix.lstrip(".") or "png"

    try:
        if len(raw) > 32 and not raw.startswith("http"):
            decoded = base64.b64decode(raw, validate=True)
            if decoded:
                return decoded, "image/png", "png"
    except Exception:
        pass

    return _FALLBACK_PNG_BYTES, "image/png", "png"


def store_turn_image(
    user_id: str,
    conversation_id: str,
    turn_number: int,
    image_data_url: str,
) -> tuple[str, str]:
    """Store an image in the RustFS bucket (and local mirror) and return (bucket_key, public_url)."""
    image_bytes, mime_type, ext = _parse_image_source(image_data_url)

    bucket_name = settings.bucket_name
    safe_user = re.sub(r"[^a-zA-Z0-9_-]", "_", user_id or "user")
    safe_conv = re.sub(r"[^a-zA-Z0-9_-]", "_", conversation_id or "conv")
    short_id = uuid.uuid4().hex[:8]
    relative_key = f"{safe_user}/{safe_conv}/turn-{turn_number}-{short_id}.{ext}"
    full_bucket_key = f"{bucket_name}/{relative_key}"

    target_path = settings.LOCAL_BUCKET_ROOT / full_bucket_key
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(image_bytes)

    s3_client = _get_rustfs_s3_client()
    if s3_client is not None:
        try:
            existing_buckets = [b["Name"] for b in s3_client.list_buckets().get("Buckets", [])]
            if bucket_name not in existing_buckets:
                s3_client.create_bucket(Bucket=bucket_name)
            s3_client.put_object(
                Bucket=bucket_name,
                Key=relative_key,
                Body=image_bytes,
                ContentType=mime_type,
            )
        except Exception:
            pass

    public_url = f"{settings.public_backend_url}/api/bucket/{full_bucket_key}"
    return full_bucket_key, public_url


def read_bucket_object(object_key: str) -> tuple[bytes, str] | None:
    """Read an image object from local bucket mirror or RustFS S3 bucket."""
    clean_key = object_key.strip("/").replace("..", "")
    if not clean_key:
        return None

    bucket_name = settings.bucket_name
    local_path = settings.LOCAL_BUCKET_ROOT / clean_key
    if not local_path.is_file() and not clean_key.startswith(f"{bucket_name}/"):
        local_path = settings.LOCAL_BUCKET_ROOT / bucket_name / clean_key

    mime_type = "image/png"
    if clean_key.endswith(".jpg") or clean_key.endswith(".jpeg"):
        mime_type = "image/jpeg"
    elif clean_key.endswith(".webp"):
        mime_type = "image/webp"
    elif clean_key.endswith(".svg"):
        mime_type = "image/svg+xml"

    if local_path.is_file():
        return local_path.read_bytes(), mime_type

    s3_client = _get_rustfs_s3_client()
    if s3_client is not None:
        s3_rel_key = clean_key[len(bucket_name) + 1 :] if clean_key.startswith(f"{bucket_name}/") else clean_key
        try:
            resp = s3_client.get_object(Bucket=bucket_name, Key=s3_rel_key)
            data = resp["Body"].read()
            local_path.parent.mkdir(parents=True, exist_ok=True)
            local_path.write_bytes(data)
            return data, resp.get("ContentType", mime_type)
        except Exception:
            return None

    return None
