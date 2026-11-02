"""Conversation and ConversationTurn SQLAlchemy ORM models."""

from __future__ import annotations

from datetime import datetime
import json
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.db.session import Base
from app.models.user import utc_now

if TYPE_CHECKING:
    from app.models.user import User


class Conversation(Base):
    """Represents a user-linked interactive image creation conversation."""

    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    style_id: Mapped[str] = mapped_column(String(64), default="editorial-anime", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="conversations")
    turns: Mapped[list["ConversationTurn"]] = relationship(
        "ConversationTurn",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ConversationTurn.turn_number.asc()",
    )

    def to_summary_dict(self) -> dict[str, Any]:
        ordered_turns = list(self.turns or [])
        latest_prompt = ordered_turns[-1].master_prompt if ordered_turns else ""
        preview_url = None
        for t in reversed(ordered_turns):
            if t.image_url:
                preview_url = t.image_url
                break
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "style_id": self.style_id,
            "turn_count": len(ordered_turns),
            "latest_prompt": latest_prompt,
            "preview_image_url": preview_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def to_detail_dict(self) -> dict[str, Any]:
        data = self.to_summary_dict()
        data["turns"] = [t.to_dict() for t in (self.turns or [])]
        return data


class ConversationTurn(Base):
    """Represents an individual prompt & image generation/refinement turn in a conversation."""

    __tablename__ = "conversation_turns"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("conversations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    turn_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="assistant", nullable=False)
    raw_idea: Mapped[str] = mapped_column(Text, default="", nullable=False)
    master_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    edit_instruction: Mapped[str | None] = mapped_column(Text, nullable=True)
    style_id: Mapped[str] = mapped_column(String(64), default="editorial-anime", nullable=False)
    modifiers_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    completeness_score: Mapped[int] = mapped_column(Integer, default=80, nullable=False)
    analysis_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    image_bucket_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    aspect_ratio: Mapped[str] = mapped_column(String(32), default="3:4", nullable=False)
    model_used: Mapped[str] = mapped_column(String(128), default="gemini-2.5-flash-image", nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="turns")

    def to_dict(self) -> dict[str, Any]:
        try:
            modifiers = json.loads(self.modifiers_json or "[]")
        except json.JSONDecodeError:
            modifiers = []
        try:
            analysis = json.loads(self.analysis_json or "{}")
        except json.JSONDecodeError:
            analysis = {}

        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "user_id": self.user_id,
            "turn_number": self.turn_number,
            "role": self.role,
            "raw_idea": self.raw_idea,
            "master_prompt": self.master_prompt,
            "edit_instruction": self.edit_instruction,
            "style_id": self.style_id,
            "modifiers": modifiers,
            "completeness_score": self.completeness_score,
            "analysis": analysis,
            "image_bucket_key": self.image_bucket_key,
            "image_url": self.image_url,
            "aspect_ratio": self.aspect_ratio,
            "model_used": self.model_used,
            "is_published": bool(self.is_published),
            "bucket_provider": settings.bucket_provider,
            "storage_status": "saved_postgres_and_rustfs" if self.image_bucket_key else "saved_postgres",
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
