"""Interactive Co-Pilot routes (`/api/interactive/analyze`, `/api/interactive/refine`)."""

from __future__ import annotations

from typing import Any

from flask import Blueprint, Response, jsonify, request

from app.services.copilot_service import analyze_prompt, refine_prompt

copilot_bp = Blueprint("copilot", __name__)


def _get_json_body() -> dict[str, Any]:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


@copilot_bp.route("/interactive/analyze", methods=["POST"])
def interactive_analyze() -> Response:
    """Analyze the user's raw idea, detect missing dimensions, and return guided questions & 3 variations."""
    body = _get_json_body()
    idea = str(body.get("idea") or "")
    style_id = body.get("style_id")
    modifiers = body.get("modifiers") if isinstance(body.get("modifiers"), list) else []
    history = body.get("history") if isinstance(body.get("history"), list) else []
    step = int(body.get("step") or 1)

    result = analyze_prompt(
        idea=idea,
        style_id=str(style_id) if style_id else "editorial-anime",
        selected_modifiers=[str(m) for m in modifiers],
        history=[str(h) for h in history],
        step=step,
    )
    return jsonify(result)


@copilot_bp.route("/interactive/refine", methods=["POST"])
def interactive_refine() -> Response:
    """Refine an existing prompt with an iterative instruction for multi-turn Nano Banana editing."""
    body = _get_json_body()
    current_prompt = str(body.get("current_prompt") or "")
    instruction = str(body.get("instruction") or "")
    style_id = body.get("style_id")
    modifiers = body.get("modifiers") if isinstance(body.get("modifiers"), list) else []

    result = refine_prompt(
        current_prompt=current_prompt,
        instruction=instruction,
        style_id=str(style_id) if style_id else "editorial-anime",
        selected_modifiers=[str(m) for m in modifiers],
    )
    return jsonify(result)
