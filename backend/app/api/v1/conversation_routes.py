"""Conversation and turn persistence routes (`/api/conversations`, `/api/conversations/<id>/turns`)."""

from __future__ import annotations

from typing import Any

from flask import Blueprint, Response, jsonify, make_response, request

from app.core.config import settings
from app.db.session import get_db_session
from app.services.auth_service import resolve_user_id
from app.services.conversation_service import (
    append_conversation_turn,
    create_new_conversation,
    get_conversation_detail,
    list_user_conversations,
)

conversation_bp = Blueprint("conversations", __name__)


def _get_json_body() -> dict[str, Any]:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


@conversation_bp.route("/conversations", methods=["GET", "POST"])
def conversations_collection() -> Response:
    """List or create PostgreSQL conversations linked to the user (or `usr_local_dev` in dev mode)."""
    if request.method == "GET":
        user_id = resolve_user_id(request.args.get("user_id"))
        if not user_id:
            return make_response(jsonify({"detail": "Query parameter 'user_id' is required."}), 400)
        with get_db_session() as db:
            payload = list_user_conversations(db=db, user_id=user_id)
        return jsonify(payload)

    body = _get_json_body()
    user_id = resolve_user_id(body.get("user_id"))
    if not user_id:
        return make_response(jsonify({"detail": "Field 'user_id' is required."}), 400)

    with get_db_session() as db:
        detail = create_new_conversation(
            db=db,
            user_id=user_id,
            title=str(body.get("title") or "New Creative Session"),
            style_id=str(body.get("style_id") or "editorial-anime"),
        )
    return jsonify(detail)


@conversation_bp.route("/conversations/<conversation_id>", methods=["GET"])
def get_conversation(conversation_id: str) -> Response:
    """Retrieve full conversation details and ordered multi-turn prompt + image history."""
    user_id = request.args.get("user_id")
    with get_db_session() as db:
        detail = get_conversation_detail(db=db, conversation_id=conversation_id, user_id=user_id)
    if detail is None:
        return make_response(jsonify({"detail": "Conversation not found."}), 404)
    return jsonify(detail)


@conversation_bp.route("/conversations/<conversation_id>/turns", methods=["POST"])
def create_conversation_turn(conversation_id: str) -> Response:
    """Save a prompt turn in PostgreSQL via SQLAlchemy and upload the image to the RustFS bucket."""
    body = _get_json_body()
    user_id = resolve_user_id(body.get("user_id"))
    master_prompt = str(body.get("master_prompt", "")).strip()
    if not user_id or not master_prompt:
        return make_response(
            jsonify({"detail": "Fields 'user_id' and 'master_prompt' are required."}),
            400,
        )

    modifiers = body.get("modifiers") if isinstance(body.get("modifiers"), list) else []
    analysis = body.get("analysis") if isinstance(body.get("analysis"), dict) else {}
    edit_instruction = body.get("edit_instruction")
    image_data_url = body.get("image_data_url")
    is_published = bool(body.get("is_published", False))

    with get_db_session() as db:
        turn_dict = append_conversation_turn(
            db=db,
            conversation_id=conversation_id,
            user_id=user_id,
            master_prompt=master_prompt,
            raw_idea=str(body.get("raw_idea") or ""),
            role=str(body.get("role") or "assistant"),
            edit_instruction=str(edit_instruction) if edit_instruction is not None else None,
            style_id=str(body.get("style_id") or "editorial-anime").strip(),
            modifiers=[str(m) for m in modifiers],
            completeness_score=int(body.get("completeness_score") or 85),
            analysis=analysis,
            image_data_url=str(image_data_url) if isinstance(image_data_url, str) else None,
            aspect_ratio=str(body.get("aspect_ratio") or "3:4"),
            model_used=str(body.get("model_used") or settings.DEFAULT_MODEL),
            is_published=is_published,
        )
    return jsonify(turn_dict)
