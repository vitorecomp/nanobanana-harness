"""Initial schema for users, conversations, and conversation_turns.

Revision ID: 20261102_0001
Revises: None
Create Date: 2026-11-02 12:20:00
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "20261102_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "users" not in existing_tables:
        op.create_table(
            "users",
            sa.Column("id", sa.String(length=64), primary_key=True, nullable=False),
            sa.Column("provider", sa.String(length=32), nullable=False, server_default="google"),
            sa.Column("google_sub", sa.String(length=128), nullable=False, unique=True),
            sa.Column("email", sa.String(length=255), nullable=False, unique=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("picture", sa.Text(), nullable=False, server_default=""),
            sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)
        op.create_index("ix_users_email", "users", ["email"], unique=True)
    else:
        existing_cols = {c["name"] for c in inspector.get_columns("users")}
        if "provider" not in existing_cols:
            op.add_column(
                "users",
                sa.Column("provider", sa.String(length=32), nullable=False, server_default="google"),
            )

    if "conversations" not in existing_tables:
        op.create_table(
            "conversations",
            sa.Column("id", sa.String(length=64), primary_key=True, nullable=False),
            sa.Column(
                "user_id",
                sa.String(length=64),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("style_id", sa.String(length=64), nullable=False, server_default="editorial-anime"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_conversations_user_id", "conversations", ["user_id"], unique=False)

    if "conversation_turns" not in existing_tables:
        op.create_table(
            "conversation_turns",
            sa.Column("id", sa.String(length=64), primary_key=True, nullable=False),
            sa.Column(
                "conversation_id",
                sa.String(length=64),
                sa.ForeignKey("conversations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "user_id",
                sa.String(length=64),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("turn_number", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("role", sa.String(length=32), nullable=False, server_default="assistant"),
            sa.Column("raw_idea", sa.Text(), nullable=False, server_default=""),
            sa.Column("master_prompt", sa.Text(), nullable=False),
            sa.Column("edit_instruction", sa.Text(), nullable=True),
            sa.Column("style_id", sa.String(length=64), nullable=False, server_default="editorial-anime"),
            sa.Column("modifiers_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("completeness_score", sa.Integer(), nullable=False, server_default="80"),
            sa.Column("analysis_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("image_bucket_key", sa.String(length=512), nullable=True),
            sa.Column("image_url", sa.Text(), nullable=True),
            sa.Column("aspect_ratio", sa.String(length=32), nullable=False, server_default="3:4"),
            sa.Column("model_used", sa.String(length=128), nullable=False, server_default="gemini-2.5-flash-image"),
            sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index(
            "ix_conversation_turns_conversation_id",
            "conversation_turns",
            ["conversation_id"],
            unique=False,
        )
        op.create_index(
            "ix_conversation_turns_user_id",
            "conversation_turns",
            ["user_id"],
            unique=False,
        )
    else:
        existing_turn_cols = {c["name"] for c in inspector.get_columns("conversation_turns")}
        if "is_published" not in existing_turn_cols:
            op.add_column(
                "conversation_turns",
                sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "conversation_turns" in existing_tables:
        op.drop_table("conversation_turns")
    if "conversations" in existing_tables:
        op.drop_table("conversations")
    if "users" in existing_tables:
        op.drop_table("users")
