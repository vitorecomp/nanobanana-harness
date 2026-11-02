-- =============================================================================
-- Nano Banana Studio — PostgreSQL 16 Initialization Script
-- =============================================================================
-- Executed automatically on first container initialization when mounted into
-- /docker-entrypoint-initdb.d/init.sql.
-- Note: Schema migrations (users, conversations, conversation_turns) are
-- versioned and executed via Alembic (`alembic upgrade head`) before the
-- Flask + SQLAlchemy backend starts.
-- =============================================================================

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET timezone = 'UTC';

-- Enable UUID generation utilities if needed by extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
