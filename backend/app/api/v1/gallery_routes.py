"""RustFS Bucket gallery, public community gallery, and object streaming routes."""

from __future__ import annotations

from typing import Any

from flask import Blueprint, Response, jsonify, make_response, request

from app.core.config import settings
from app.db.session import get_db_session
from app.services.auth_service import resolve_user_id
from app.services.conversation_service import (
    build_public_gallery,
    build_user_gallery,
    toggle_turn_published,
)
from app.services.storage_service import read_bucket_object

gallery_bp = Blueprint("gallery", __name__)


@gallery_bp.route("/gallery/public", methods=["GET"])
def get_public_gallery() -> Response:
    """Return all published community generations plus curated showcase creations."""
    with get_db_session() as db:
        payload = build_public_gallery(db=db)
    return jsonify(payload)


@gallery_bp.route("/turns/<turn_id>/publish", methods=["POST"])
def publish_turn(turn_id: str) -> Response:
    """Publish or unpublish a generated turn to the Public Community Gallery."""
    data = request.get_json(silent=True)
    body: dict[str, Any] = data if isinstance(data, dict) else {}
    desired = body.get("is_published")
    is_pub: bool | None = bool(desired) if isinstance(desired, bool) else None

    with get_db_session() as db:
        updated = toggle_turn_published(db=db, turn_id=turn_id, is_published=is_pub)
    if updated is None:
        return make_response(jsonify({"detail": "Turn not found."}), 404)
    return jsonify(updated)


@gallery_bp.route("/users/<user_id>/gallery", methods=["GET"])
def get_user_gallery(user_id: str) -> Response:
    """Return all generated images stored in the RustFS bucket across all conversations for a user."""
    resolved_user_id = resolve_user_id(user_id) or user_id
    with get_db_session() as db:
        payload = build_user_gallery(db=db, user_id=resolved_user_id)
    return jsonify(payload)


@gallery_bp.route("/bucket/<path:object_key>", methods=["GET"])
def serve_bucket_image(object_key: str) -> Response:
    """Stream an image stored in the RustFS bucket (`nanobanana-images`)."""
    result = read_bucket_object(object_key)
    if result is None:
        return make_response(jsonify({"detail": "Image not found in RustFS bucket."}), 404)
    data, mime_type = result
    resp = make_response(data, 200)
    resp.headers["Content-Type"] = mime_type
    resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    resp.headers["X-Bucket-Provider"] = settings.bucket_provider
    return resp
