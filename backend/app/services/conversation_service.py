"""Business logic for conversations, multi-turn prompt persistence, and RustFS gallery."""

from __future__ import annotations

import json
from typing import Any
import uuid

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.conversation import Conversation, ConversationTurn
from app.models.user import User, utc_now
from app.services.auth_service import ensure_user_exists
from app.services.storage_service import store_turn_image

CURATED_SHOWCASE_GALLERY: list[dict[str, Any]] = [
    {
        "turn_id": "showcase_turn_portrait",
        "conversation_id": "showcase_conv_crypko",
        "conversation_title": "Editorial Anime Portrait Series",
        "turn_number": 1,
        "author_name": "Nano Banana Studio",
        "author_id": "studio_editorial",
        "raw_idea": "Editorial anime explorer character wearing an olive utility jacket and aviator goggles on forehead",
        "master_prompt": (
            "Editorial anime character portrait of a young explorer with copper hair and aviator goggles resting on "
            "the forehead, wearing a structured olive-green utility jacket over a crisp white tee. High-craft cel-shaded "
            "ink linework, graphic flat shadow blocks, warm bone-cream paper backdrop (#E9E7DF), acid-yellow (#F2FA3C) "
            "graphic accents, 85mm f/1.4 prime lens."
        ),
        "edit_instruction": "Flagship Editorial Cover (Turn #1)",
        "style_id": "editorial-anime",
        "modifiers": ["golden-hour", "lens-85mm", "cream-ink-acid"],
        "image_bucket_key": "showcase/hero-portrait.png",
        "image_url": "/showcase/hero-portrait.png",
        "aspect_ratio": "3:4",
        "model_used": "gemini-2.5-flash-image",
        "is_published": True,
        "is_curated": True,
        "bucket_provider": "showcase",
        "created_at": "2026-11-02T12:00:00+00:00",
    },
    {
        "turn_id": "showcase_turn_scene",
        "conversation_id": "showcase_conv_street",
        "conversation_title": "Sunlit Urban Duo Exploration",
        "turn_number": 1,
        "author_name": "Nano Banana Studio",
        "author_id": "studio_editorial",
        "raw_idea": "Two urban explorers walking down a sunlit street beneath a pastel teal sky",
        "master_prompt": (
            "Wide cinematic street scene of two anime urban explorers walking side by side down a sunlit avenue "
            "under a pastel teal sky. High-craft editorial anime illustration, 35mm street photography perspective, "
            "warm golden hour rim lighting, overhead power lines, crisp carbon-black ink outlines."
        ),
        "edit_instruction": "Cinematic Street Narrative (Turn #1)",
        "style_id": "editorial-anime",
        "modifiers": ["golden-hour", "lens-35mm", "pastel-teal-warm"],
        "image_bucket_key": "showcase/hero-scene.png",
        "image_url": "/showcase/hero-scene.png",
        "aspect_ratio": "16:9",
        "model_used": "gemini-2.5-flash-image",
        "is_published": True,
        "is_curated": True,
        "bucket_provider": "showcase",
        "created_at": "2026-11-02T12:05:00+00:00",
    },
    {
        "turn_id": "showcase_turn_step1",
        "conversation_id": "showcase_conv_evolution",
        "conversation_title": "Multi-Turn Explorer Evolution",
        "turn_number": 1,
        "author_name": "Art Director Co-Pilot",
        "author_id": "studio_editorial",
        "raw_idea": "Futuristic explorer character with aviator goggles on a sunlit street",
        "master_prompt": (
            "Portrait of a young anime explorer with copper hair, aviator goggles resting on forehead, "
            "olive-green utility jacket over white tee, high-craft editorial anime illustration, crisp cel-shaded "
            "ink linework, warm bone backdrop #E9E7DF."
        ),
        "edit_instruction": "Base Concept Diagnosis (Turn #1)",
        "style_id": "editorial-anime",
        "modifiers": ["studio-softbox", "lens-85mm"],
        "image_bucket_key": "showcase/step-1-base.png",
        "image_url": "/showcase/step-1-base.png",
        "aspect_ratio": "3:4",
        "model_used": "gemini-2.5-flash-image",
        "is_published": True,
        "is_curated": True,
        "bucket_provider": "showcase",
        "created_at": "2026-11-02T12:10:00+00:00",
    },
    {
        "turn_id": "showcase_turn_step2",
        "conversation_id": "showcase_conv_evolution",
        "conversation_title": "Multi-Turn Explorer Evolution",
        "turn_number": 2,
        "author_name": "Art Director Co-Pilot",
        "author_id": "studio_editorial",
        "raw_idea": "Futuristic explorer character with golden hour chiaroscuro lighting",
        "master_prompt": (
            "Keep exact character identity from Turn #1 and bathe the scene in dramatic Golden Hour sunset lighting "
            "with warm amber rim light, long diagonal cast shadows, and a pastel teal sky backdrop."
        ),
        "edit_instruction": "Make lighting dramatic Golden Hour (Turn #2)",
        "style_id": "editorial-anime",
        "modifiers": ["golden-hour", "lens-85mm", "pastel-teal-warm"],
        "image_bucket_key": "showcase/step-2-lighting.png",
        "image_url": "/showcase/step-2-lighting.png",
        "aspect_ratio": "3:4",
        "model_used": "gemini-2.5-flash-image",
        "is_published": True,
        "is_curated": True,
        "bucket_provider": "showcase",
        "created_at": "2026-11-02T12:15:00+00:00",
    },
    {
        "turn_id": "showcase_turn_step3",
        "conversation_id": "showcase_conv_evolution",
        "conversation_title": "Multi-Turn Explorer Evolution",
        "turn_number": 3,
        "author_name": "Art Director Co-Pilot",
        "author_id": "studio_editorial",
        "raw_idea": "Cyberpunk nocturnal Tokyo refinement with glowing acid-yellow visor",
        "master_prompt": (
            "Preserve exact character identity from Turn #2 and transform the setting into a cyberpunk Tokyo night "
            "with wet asphalt neon reflections and a translucent glowing acid-yellow (#F2FA3C) visor."
        ),
        "edit_instruction": "Add acid-yellow cyber visor & Tokyo night (Turn #3)",
        "style_id": "cyberpunk-3d",
        "modifiers": ["neon-rain", "acid-rim", "lens-85mm"],
        "image_bucket_key": "showcase/step-3-cyber.png",
        "image_url": "/showcase/step-3-cyber.png",
        "aspect_ratio": "3:4",
        "model_used": "gemini-2.5-flash-image",
        "is_published": True,
        "is_curated": True,
        "bucket_provider": "showcase",
        "created_at": "2026-11-02T12:20:00+00:00",
    },
]


def list_user_conversations(db: Session, user_id: str) -> dict[str, Any]:
    """Ensure user exists and list all conversations ordered by most recent update."""
    ensure_user_exists(db=db, user_id=user_id)
    rows = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return {
        "user_id": user_id,
        "bucket_provider": settings.bucket_provider,
        "conversations": [c.to_summary_dict() for c in rows],
    }


def create_new_conversation(
    db: Session,
    user_id: str,
    title: str | None = None,
    style_id: str | None = None,
) -> dict[str, Any]:
    """Create a new conversation linked to `user_id`."""
    user = ensure_user_exists(db=db, user_id=user_id)
    conv = Conversation(
        id=f"conv_{uuid.uuid4().hex[:12]}",
        user_id=user.id,
        title=(title or "New Creative Session").strip()[:250],
        style_id=(style_id or "editorial-anime").strip(),
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv.to_detail_dict()


def get_conversation_detail(
    db: Session,
    conversation_id: str,
    user_id: str | None = None,
) -> dict[str, Any] | None:
    """Return full conversation detail with ordered turns or None if not found."""
    query = db.query(Conversation).filter(Conversation.id == conversation_id)
    if user_id:
        query = query.filter(Conversation.user_id == user_id)
    conv = query.first()
    if not conv:
        return None
    return conv.to_detail_dict()


def append_conversation_turn(
    db: Session,
    conversation_id: str,
    user_id: str,
    master_prompt: str,
    raw_idea: str = "",
    role: str = "assistant",
    edit_instruction: str | None = None,
    style_id: str = "editorial-anime",
    modifiers: list[str] | None = None,
    completeness_score: int = 85,
    analysis: dict[str, Any] | None = None,
    image_data_url: str | None = None,
    aspect_ratio: str = "3:4",
    model_used: str = "gemini-2.5-flash-image",
    is_published: bool = False,
) -> dict[str, Any]:
    """Persist a turn in PostgreSQL/SQLite and upload any generated image to the RustFS bucket."""
    user = ensure_user_exists(db=db, user_id=user_id)

    conv = None
    if conversation_id and conversation_id != "new":
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()

    if not conv:
        derived_title = (raw_idea or master_prompt or "Nano Banana Session").strip()[:80]
        conv = Conversation(
            id=conversation_id if (conversation_id and conversation_id != "new") else f"conv_{uuid.uuid4().hex[:12]}",
            user_id=user.id,
            title=derived_title,
            style_id=style_id or "editorial-anime",
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    existing_count = (
        db.query(ConversationTurn)
        .filter(ConversationTurn.conversation_id == conv.id)
        .count()
    )
    turn_number = existing_count + 1

    bucket_key: str | None = None
    image_url: str | None = None
    if isinstance(image_data_url, str) and image_data_url.strip():
        bucket_key, image_url = store_turn_image(
            user_id=user.id,
            conversation_id=conv.id,
            turn_number=turn_number,
            image_data_url=image_data_url,
        )

    turn = ConversationTurn(
        id=f"turn_{uuid.uuid4().hex[:12]}",
        conversation_id=conv.id,
        user_id=user.id,
        turn_number=turn_number,
        role=role or "assistant",
        raw_idea=raw_idea or "",
        master_prompt=master_prompt,
        edit_instruction=str(edit_instruction) if edit_instruction is not None else None,
        style_id=style_id or conv.style_id,
        modifiers_json=json.dumps(modifiers or [], ensure_ascii=False),
        completeness_score=completeness_score,
        analysis_json=json.dumps(analysis or {}, ensure_ascii=False),
        image_bucket_key=bucket_key,
        image_url=image_url,
        aspect_ratio=aspect_ratio or "3:4",
        model_used=model_used or settings.DEFAULT_MODEL,
        is_published=bool(is_published),
    )
    db.add(turn)

    if turn_number == 1 and raw_idea and conv.title in {"New Creative Session", "Nano Banana Session", "Nova Sessão Criativa", "Sessão Nano Banana"}:
        conv.title = raw_idea.strip()[:80]
    conv.updated_at = utc_now()

    db.commit()
    db.refresh(turn)
    return turn.to_dict()


def toggle_turn_published(
    db: Session,
    turn_id: str,
    is_published: bool | None = None,
) -> dict[str, Any] | None:
    """Publish or unpublish a specific ConversationTurn to the Public Community Gallery."""
    turn = db.query(ConversationTurn).filter(ConversationTurn.id == turn_id).first()
    if not turn:
        return None
    turn.is_published = (not bool(turn.is_published)) if is_published is None else bool(is_published)
    db.commit()
    db.refresh(turn)
    return turn.to_dict()


def build_user_gallery(db: Session, user_id: str) -> dict[str, Any]:
    """Build the user's personal RustFS bucket image gallery across all conversations."""
    user = ensure_user_exists(db=db, user_id=user_id)
    turns = (
        db.query(ConversationTurn)
        .filter(
            ConversationTurn.user_id == user_id,
            ConversationTurn.image_url.isnot(None),
        )
        .order_by(ConversationTurn.created_at.desc())
        .all()
    )

    conv_titles: dict[str, str] = {}
    conv_ids = {t.conversation_id for t in turns}
    if conv_ids:
        convs = db.query(Conversation).filter(Conversation.id.in_(conv_ids)).all()
        conv_titles = {c.id: c.title for c in convs}

    items = []
    for t in turns:
        t_dict = t.to_dict()
        items.append(
            {
                "turn_id": t.id,
                "conversation_id": t.conversation_id,
                "conversation_title": conv_titles.get(t.conversation_id, "Creative Session"),
                "turn_number": t.turn_number,
                "author_name": user.name,
                "author_id": user.id,
                "raw_idea": t.raw_idea,
                "master_prompt": t.master_prompt,
                "edit_instruction": t.edit_instruction,
                "style_id": t.style_id,
                "modifiers": t_dict["modifiers"],
                "image_bucket_key": t.image_bucket_key,
                "image_url": t.image_url,
                "aspect_ratio": t.aspect_ratio,
                "model_used": t.model_used,
                "is_published": bool(t.is_published),
                "is_curated": False,
                "bucket_provider": settings.bucket_provider,
                "created_at": t_dict["created_at"],
            }
        )

    return {
        "user_id": user_id,
        "bucket_provider": settings.bucket_provider,
        "bucket_name": settings.bucket_name,
        "total": len(items),
        "items": items,
    }


def build_public_gallery(db: Session) -> dict[str, Any]:
    """Return all published community turns merged with the 5 curated editorial showcase creations."""
    published_turns = (
        db.query(ConversationTurn)
        .filter(
            ConversationTurn.is_published.is_(True),
            ConversationTurn.image_url.isnot(None),
        )
        .order_by(ConversationTurn.created_at.desc())
        .limit(60)
        .all()
    )

    conv_ids = {t.conversation_id for t in published_turns}
    user_ids = {t.user_id for t in published_turns}

    conv_titles: dict[str, str] = {}
    if conv_ids:
        convs = db.query(Conversation).filter(Conversation.id.in_(conv_ids)).all()
        conv_titles = {c.id: c.title for c in convs}

    user_names: dict[str, str] = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        user_names = {u.id: u.name for u in users}

    items: list[dict[str, Any]] = []
    for t in published_turns:
        t_dict = t.to_dict()
        items.append(
            {
                "turn_id": t.id,
                "conversation_id": t.conversation_id,
                "conversation_title": conv_titles.get(t.conversation_id, "Community Creation"),
                "turn_number": t.turn_number,
                "author_name": user_names.get(t.user_id, "Studio Creator"),
                "author_id": t.user_id,
                "raw_idea": t.raw_idea,
                "master_prompt": t.master_prompt,
                "edit_instruction": t.edit_instruction,
                "style_id": t.style_id,
                "modifiers": t_dict["modifiers"],
                "image_bucket_key": t.image_bucket_key,
                "image_url": t.image_url,
                "aspect_ratio": t.aspect_ratio,
                "model_used": t.model_used,
                "is_published": True,
                "is_curated": False,
                "bucket_provider": settings.bucket_provider,
                "created_at": t_dict["created_at"],
            }
        )

    items.extend(CURATED_SHOWCASE_GALLERY)

    return {
        "bucket_provider": settings.bucket_provider,
        "bucket_name": settings.bucket_name,
        "total": len(items),
        "items": items,
    }
