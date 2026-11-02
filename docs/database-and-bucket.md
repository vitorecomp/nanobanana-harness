# PostgreSQL Database & RustFS Bucket API Contracts — Nano Banana Studio 🍌✦

This document details the persistence layer and API contracts of **Nano Banana Studio**, built with **Python (Flask + SQLAlchemy)** and backed by two complementary engines:
1. **PostgreSQL 16 (`postgres:16-alpine` via SQLAlchemy ORM)**: Stores authenticated user profiles (**Google** and **Facebook** OAuth via the `users` table), creative sessions (`conversations`), and the full multi-turn history of prompts, guided answers, modifiers, and edit instructions (`conversation_turns`).
2. **RustFS Object Storage Bucket (`rustfs/rustfs:latest`)**: Stores generated and iterated image binaries in the S3-compatible bucket `nanobanana-images`, enabling fast later consultation (`GET /api/users/<user_id>/gallery` and `GET /api/bucket/<path:object_key>`).

> **Zero-Storage Security Invariant**: Neither PostgreSQL nor the RustFS Bucket ever stores or accepts a Google Gemini API key (`AIza...`). The key lives exclusively in volatile React RAM (`useState`) in the user's browser.

---

## 1. Relational Schema (`erDiagram`) & Alembic Migrations — PostgreSQL + SQLAlchemy

Defined in `backend/app/models/user.py` and `backend/app/models/conversation.py` using **SQLAlchemy 2.0**, and managed via versioned **Alembic** migrations in `backend/migrations/versions/20261102_0001_initial_schema.py`:

### 1.1 Alembic Migration Workflow
```bash
# Check current database revision
cd backend && .venv/bin/alembic current

# Upgrade schema to the latest revision (head)
cd backend && .venv/bin/alembic upgrade head

# Autogenerate a new migration script after modifying SQLAlchemy models in app/models/
cd backend && .venv/bin/alembic revision --autogenerate -m "description_of_change"

# Downgrade one revision
cd backend && .venv/bin/alembic downgrade -1
```
In Docker/Podman Compose (`docker-compose.yml` / `docker-compose.dev.yml`) and Kubernetes (`infra/deployment.yaml` / `infra/k8s/backend-deployment.yaml`), `alembic upgrade head` runs automatically prior to starting `flask run` or `gunicorn`.

```mermaid
erDiagram
    USERS ||--o{ CONVERSATIONS : "owns (1:N)"
    USERS ||--o{ CONVERSATION_TURNS : "generates (1:N)"
    CONVERSATIONS ||--o{ CONVERSATION_TURNS : "contains turns (1:N)"

    USERS {
        string id PK "e.g. usr_a1b2c3d4e5f6"
        string provider "Auth provider ('google' | 'facebook')"
        string google_sub UK "Unique OAuth provider subject ID"
        string email UK "Verified user email"
        string name "User display name"
        string picture "Avatar URL or SVG data URL"
        boolean email_verified "Email verification flag"
        datetime created_at "First sign-in timestamp (UTC)"
        datetime updated_at "Latest sign-in timestamp (UTC)"
    }

    CONVERSATIONS {
        string id PK "e.g. conv_9f8e7d6c5b4a"
        string user_id FK "References USERS.id"
        string title "Creative session title"
        string style_id "Active style preset (e.g. editorial-anime)"
        int turn_count "Total turns generated in conversation"
        text latest_prompt "Latest synthesized Master Prompt"
        string preview_image_url "URL of latest image stored in RustFS"
        datetime created_at "Conversation creation timestamp"
        datetime updated_at "Latest turn timestamp (indexed)"
    }

    CONVERSATION_TURNS {
        string id PK "e.g. turn_112233445566"
        string conversation_id FK "References CONVERSATIONS.id"
        string user_id FK "References USERS.id"
        int turn_number "Sequential turn index (1, 2, 3...)"
        string role "Turn role ('assistant' | 'user')"
        text raw_idea "Initial natural-language idea"
        text master_prompt "Full Master Prompt sent to Nano Banana"
        text edit_instruction "Iterative multi-turn edit directive"
        string style_id "Style preset used on this turn"
        json modifiers_json "JSON list of active modifiers"
        int completeness_score "Heuristic completeness score (0-100)"
        json analysis_json "JSON snapshot of guided questions & variations"
        string image_bucket_key "RustFS S3 object key (nanobanana-images/...)"
        string image_url "Streaming endpoint URL (/api/bucket/...)"
        string aspect_ratio "Image aspect ratio (e.g. 3:4, 16:9, 1:1)"
        string model_used "Model used (e.g. gemini-2.5-flash-image)"
        datetime created_at "Exact turn creation timestamp"
    }
```

---

## 2. RustFS S3 Object Storage Hierarchy (`nanobanana-images`)

The object storage tier uses **RustFS (`rustfs/rustfs:latest`)**, a high-performance S3-compatible object storage server written in Rust.

### 2.1 Object Key Layout (`image_bucket_key`)
Every generated or edited image is stored inside the **`nanobanana-images`** bucket partitioned by `user_id`, `conversation_id`, and `turn_number`:

```text
nanobanana-images/
└── {user_id}/
    └── {conversation_id}/
        ├── turn-1-{uuid8}.png
        ├── turn-2-{uuid8}.png
        └── turn-3-{uuid8}.png
```

Example `image_bucket_key`:
```text
nanobanana-images/usr_a1b2c3d4e5f6/conv_9f8e7d6c5b4a/turn-1-abcd1234.png
```

### 2.2 Environment Variables (PostgreSQL & RustFS Bucket)

| Variable | Default (`compose.dev.yaml`) | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+psycopg://nanobanana:nanobanana@postgres:5432/nanobanana` | SQLAlchemy connection string for PostgreSQL (falls back to `sqlite:///./nanobanana.db` when running standalone `pytest`). |
| `POSTGRES_USER` | `nanobanana` | PostgreSQL database user. |
| `POSTGRES_PASSWORD` | `nanobanana` | PostgreSQL database password. |
| `POSTGRES_DB` | `nanobanana` | PostgreSQL database name. |
| `BUCKET_PROVIDER` | `rustfs` | S3-compatible object storage provider identifier. |
| `BUCKET_ENDPOINT_URL` | `http://rustfs:9000` | Internal S3 API endpoint of the RustFS container. |
| `BUCKET_PUBLIC_URL` | `http://localhost:19000` | Host-accessible S3 URL (with Dev Port Pad `+10000`). |
| `BUCKET_NAME` | `nanobanana-images` | Target bucket name for storing generated images. |
| `RUSTFS_ACCESS_KEY` / `BUCKET_ACCESS_KEY` | `rustfsadmin` | RustFS S3 access key. |
| `RUSTFS_SECRET_KEY` / `BUCKET_SECRET_KEY` | `rustfsadmin` | RustFS S3 secret key. |

---

## 3. Flask + SQLAlchemy API Contracts

### 3.1 `GET /api/health` — Service Health & Security Policy Declaration

**Response (`200 OK`)**:
```json
{
  "status": "ok",
  "service": "nanobanana-interactive-backend",
  "framework": "flask",
  "orm": "sqlalchemy",
  "key_storage": "never_stored",
  "bucket_provider": "rustfs"
}
```

---

### 3.2 `POST /api/auth/google` — Google OAuth 2.0 Sign-In & SQLAlchemy User Upsert

Verifies a Google Identity Services JWT (`credential`) or local dev profile and upserts the user into the `users` table with `provider="google"`.

**Response (`200 OK`)**:
```json
{
  "authenticated": true,
  "provider": "google",
  "auth_mode": "google_jwt",
  "user": {
    "id": "usr_a1b2c3d4e5f6",
    "provider": "google",
    "google_sub": "10987654321",
    "email": "vitor@google.com",
    "name": "Vitor Vieira",
    "picture": "",
    "email_verified": true,
    "created_at": "2026-11-02T14:50:00Z"
  },
  "key_policy": "never_stored",
  "key_storage": "never_stored"
}
```

---

### 3.3 `POST /api/auth/facebook` — Facebook OAuth Sign-In & SQLAlchemy User Upsert

Verifies a Facebook OAuth `access_token` or local dev profile and upserts the user into the `users` table with `provider="facebook"`.

**Request**:
```json
{
  "access_token": "<optional_facebook_access_token>",
  "user_id": "<optional_facebook_user_id>",
  "dev_profile": {
    "name": "Vitor Vieira",
    "email": "vitor@fb.com",
    "picture": ""
  }
}
```

**Response (`200 OK`)**:
```json
{
  "authenticated": true,
  "provider": "facebook",
  "auth_mode": "facebook_oauth",
  "user": {
    "id": "usr_f9e8d7c6b5a4",
    "provider": "facebook",
    "email": "vitor@fb.com",
    "name": "Vitor Vieira",
    "picture": "",
    "email_verified": true,
    "created_at": "2026-11-02T14:50:00Z"
  },
  "key_policy": "never_stored",
  "key_storage": "never_stored"
}
```

---

### 3.4 `POST /api/conversations` — Create Conversation

Creates a new creative conversation linked to the authenticated `user_id` (Google or Facebook).

**Request**:
```json
{
  "user_id": "usr_a1b2c3d4e5f6",
  "title": "Futuristic Explorer in Tokyo",
  "style_id": "editorial-anime"
}
```

**Response (`200` / `201`)**:
```json
{
  "id": "conv_9f8e7d6c5b4a",
  "user_id": "usr_a1b2c3d4e5f6",
  "title": "Futuristic Explorer in Tokyo",
  "style_id": "editorial-anime",
  "turn_count": 0,
  "latest_prompt": "",
  "preview_image_url": null,
  "created_at": "2026-11-02T14:50:00Z",
  "updated_at": "2026-11-02T14:50:00Z",
  "turns": []
}
```

---

### 3.5 `GET /api/conversations?user_id=<id>` — List User Conversations

Returns all conversations for the signed-in user ordered by `updated_at DESC`.

**Response (`200 OK`)**:
```json
{
  "user_id": "usr_a1b2c3d4e5f6",
  "conversations": [
    {
      "id": "conv_9f8e7d6c5b4a",
      "user_id": "usr_a1b2c3d4e5f6",
      "title": "Futuristic Explorer in Tokyo",
      "style_id": "editorial-anime",
      "turn_count": 2,
      "latest_prompt": "Futuristic explorer in a sunlit street, high-craft editorial anime...",
      "preview_image_url": "/api/bucket/nanobanana-images/usr_a1b2c3d4e5f6/conv_9f8e7d6c5b4a/turn-2-abcd1234.png",
      "created_at": "2026-11-02T14:50:00Z",
      "updated_at": "2026-11-02T14:51:00Z"
    }
  ]
}
```

---

### 3.6 `GET /api/conversations/<conversation_id>?user_id=<id>` — Retrieve Full Conversation & Turn Timeline

Returns the conversation metadata and the ordered list of all its `turns`.

---

### 3.7 `POST /api/conversations/<conversation_id>/turns` — Persist Turn in PostgreSQL & Upload Image to RustFS

Uploads `image_data_url` (Base64 data URL or showcase path) to the **RustFS Bucket (`nanobanana-images`)** and persists the prompt, edit instruction, modifiers, completeness score, and bucket reference in PostgreSQL via SQLAlchemy.

**Request**:
```json
{
  "user_id": "usr_a1b2c3d4e5f6",
  "role": "assistant",
  "raw_idea": "Uma exploradora futurista em uma rua ensolarada",
  "master_prompt": "Uma exploradora futurista em uma rua ensolarada, high-craft editorial anime illustration...",
  "edit_instruction": null,
  "style_id": "editorial-anime",
  "modifiers": ["golden-hour"],
  "completeness_score": 82,
  "analysis": {},
  "image_data_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "aspect_ratio": "3:4",
  "model_used": "gemini-2.5-flash-image"
}
```

---

### 3.8 `GET /api/users/<user_id>/gallery` — Query User's RustFS Bucket Gallery (Later Consultation)

Returns all images stored in the **RustFS Bucket** across all conversations for the user, paired with their exact prompts and turn metadata.

---

### 3.9 `GET /api/bucket/<path:object_key>` — Stream Image from RustFS Bucket

Streams the binary image (`image/png`, `image/jpeg`, `image/webp`, or `image/svg+xml`) stored in the RustFS bucket.
