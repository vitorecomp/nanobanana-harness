# Nano Banana Studio 🍌✦ — Interactive AI Image Creation & Art Direction

**Nano Banana Studio** is an interactive visual creation and art-direction web platform powered by **Google Nano Banana (`gemini-2.5-flash-image`)**. It pairs a high-craft **Editorial Neo-Brutalist UI** (inspired by character-creation studio layouts such as *Crypko*, built with **Next.js / React**) with an enterprise modular **Python Interactive Prompt Co-Pilot (Flask + SQLAlchemy)**, **Google & Facebook OAuth Sign-In** (optional in Local Dev mode with zero-friction auto-provisioned `usr_local_dev`, and enforced in Production), relational conversation/prompt persistence in **PostgreSQL 16**, and S3-compatible image storage in **RustFS Bucket (`nanobanana-images`)** — all governed by a strict **Zero-Storage Gemini API Key Architecture**.

---

## 🔒 Zero-Storage API Key Security Invariant

The foundational security principle of **Nano Banana Studio** is complete user sovereignty over their Google AI Studio credential:

1. **Volatile RAM Only (`React.useState`)**: When a user enters their Gemini API key (`AIza...`) inside the Studio bar, it lives **exclusively** in volatile React component state in the browser tab's RAM.
2. **Zero Browser Storage**: The frontend **never** writes the API key to `localStorage`, `sessionStorage`, `IndexedDB`, `cookies`, or URL query strings. Closing or refreshing the tab — or clicking **"Clear from RAM"** — wipes the key immediately.
3. **Direct Browser-to-Google Execution**: Image generation and multi-turn visual editing calls go directly from the user's browser (`frontend/src/features/studio/services/nanobananaClient.ts`) to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent` with `cache: "no-store"`, completely bypassing the Nginx gateway and Python Flask backend.
4. **Active Backend Guard (`zero_storage_api_key_guard`)**: Every request to the Python Flask backend (`backend/app/core/middleware.py`) passes through a `before_request` security hook that inspects HTTP headers (`x-goog-api-key`, `Authorization`), query parameters, and JSON payloads (`api_key`, `AIza...` patterns). Any request containing a Gemini API key is immediately rejected with **HTTP `400 Bad Request` (`API_KEY_REJECTED_ZERO_STORAGE`)** without logging or echoing the secret.

---

## ✨ 4-Page Application Architecture & Interactive Workflow

1. **Home Page (`/`) — Editorial Showcase & 3-Turn Evolution Simulator**:
   - Presents the Crypko-inspired Neo-Brutalist Hero stage, the 4-stage interactive creation loop, the Zero-Storage privacy architecture diagram with a live browser storage auditor, and a clickable **3-Turn Evolution Simulator** (`/showcase/step-1-base.png` → `/showcase/step-2-lighting.png` → `/showcase/step-3-cyber.png`). Primary CTAs redirect to the **Published Community Gallery (`/gallery`)** or **Creation Studio (`/create`)**.
2. **Gallery Page (`/gallery` & `/gallery?tab=personal`) — Published Community Feed & Personal Gallery**:
   - **Published Community Feed (`/gallery`, `GET /api/gallery/public`)**: Displays community-published generations and curated showcase series. Any image can be inspected or loaded into `/create` with 1 click (**"Remix in Studio ★"**) for further multi-turn iteration.
   - **Personal Gallery & History (`/gallery?tab=personal`, `GET /api/users/<id>/gallery`)**: Reached immediately after signing in on `/login`, displaying the creator's personal **RustFS Bucket** images (with a 1-click **"Publish to Community"** toggle via `POST /api/turns/<id>/publish`) and saved **PostgreSQL** multi-turn conversations (`GET /api/conversations`).
3. **Login Page (`/login`) — Social OAuth & Personal Gallery Entry**:
   - Dedicated authentication route supporting **Google OAuth 2.0 (`POST /api/auth/google`)** and **Facebook Login (`POST /api/auth/facebook`)**, plus 1-click local developer profiles (`usr_local_dev`) in Dev Mode (`REQUIRE_AUTH=false`). Upon sign-in, redirects directly to `/gallery?tab=personal`.
4. **Creation Studio Page (`/create`) — Guided Nano Banana Co-Pilot & Multi-Turn Canvas**:
   - **Stage 1 — Base Concept & Diagnosis**: The Python Flask Co-Pilot (`POST /api/interactive/analyze`) computes a `completeness_score` (`0–100%`) and detects missing visual dimensions (subject, environment, lighting, camera/lens, mood).
   - **Stage 2 — Guided Art Direction & Variations**: Creators pick from style presets, optical/lighting modifiers, clickable **Guided Questions**, and **3 Directorial Variations** to synthesize an optimal *Master Prompt*.
   - **Stage 3 — Direct Browser Generation**: The browser calls Google's `gemini-2.5-flash-image` directly using the volatile RAM API key held in `StudioSessionProvider` (or runs in **Interactive Simulation Mode** for testing without a key).
   - **Stage 4 — Conversational Multi-Turn Editing & Publishing**: Creators apply iterative edits (`POST /api/interactive/refine`), automatically saving turns to **PostgreSQL + RustFS Bucket** and publishing favorite frames to `/gallery`.

---

## 🗂️ Corporate Repository Structure

```text
nanobanana-inspiration/
├── README.md                     # Project overview and quickstart guide (English)
├── AGENT.md                      # Engineering & architecture guide for AI agents and developers
├── PRODUCT.md                    # Product vision, personas, and security boundaries (Impeccable Init)
├── DESIGN.md                     # Editorial Neo-Brutalist design system & Impeccable Craft Floor
├── .env.example                  # Universal PORT_PAD (e.g. PORT_PAD=1 or PORT_PAD=2), Auth & DB/Bucket env vars
├── podman-compose.yml            # Production Podman Compose stack (Gunicorn wsgi:app, Next.js prod, REQUIRE_AUTH=true)
├── podman-compose.dev.yml        # Development Podman Compose stack (Hot-reload, bind mounts, REQUIRE_AUTH=false)
├── docker-compose.yml            # Production Docker Compose stack (Gunicorn wsgi:app, Next.js prod, REQUIRE_AUTH=true)
├── docker-compose.dev.yml        # Development Docker Compose stack (Hot-reload, bind mounts, REQUIRE_AUTH=false)
├── infra/                        # Kubernetes deployment manifests & Nginx gateway configuration
│   ├── README.md                 # Infrastructure & Kubernetes deployment guide (English)
│   ├── deployment.yaml           # Self-contained Kubernetes manifest (app deployments + ingress)
│   ├── deployment.md             # Detailed Kubernetes deployment documentation
│   ├── nginx/nginx.conf          # Nginx reverse proxy gateway configuration
│   ├── postgres/init.sql         # PostgreSQL initialization script
│   └── k8s/                      # Modular Kustomize manifests (backend, frontend, nginx, ingress, hpa)
├── docs/                         # Comprehensive technical documentation suite (English)
│   ├── README.md                 # Documentation index & executive summary
│   ├── architecture.md           # Distributed system architecture & sequence diagrams
│   ├── data-models.md            # PostgreSQL ER schema, RustFS S3 keys, SQLAlchemy & TS models
│   ├── processing-pipelines.md   # Step-by-step flowcharts for all 5 processing pipelines
│   ├── database-and-bucket.md    # API contracts for PostgreSQL & RustFS Bucket persistence
│   ├── security-and-auth.md      # Zero-Storage defense-in-depth & Google/Facebook OAuth setup
│   └── podman-compose.md         # Podman Compose & Docker Compose Dev/Prod guide & Port Pad
├── backend/                      # Enterprise Modular Python Flask + SQLAlchemy + Alembic Backend
│   ├── wsgi.py                   # WSGI entrypoint (`app = create_app()`)
│   ├── alembic.ini               # Alembic database migration configuration
│   ├── migrations/               # Versioned Alembic schema migrations (`env.py`, `versions/20261102_0001_initial_schema.py`)
│   ├── Dockerfile                # Multi-stage Dockerfile (`development` & `production` targets running `alembic upgrade head`)
│   ├── requirements.txt          # Python dependencies (Flask, SQLAlchemy, Alembic, Flask-Migrate, Gunicorn, pytest)
│   ├── app/
│   │   ├── __init__.py           # Application Factory `create_app()`
│   │   ├── core/                 # `config.py` (settings) & `middleware.py` (`zero_storage_api_key_guard`)
│   │   ├── db/                   # `session.py` (SQLAlchemy Engine, SessionLocal, `run_migrations()`, `init_db()`)
│   │   ├── models/               # `user.py` (`User`) & `conversation.py` (`Conversation`, `ConversationTurn`)
│   │   ├── services/             # `auth_service.py`, `copilot_service.py`, `conversation_service.py`, `storage_service.py`
│   │   └── api/v1/               # Modular Flask Blueprints (`health`, `copilot`, `auth`, `conversation`, `gallery`)
│   └── tests/                    # `conftest.py` & `test_api.py` (Pytest suite)
└── frontend/                     # Enterprise Feature-Based Next.js Frontend
    ├── Dockerfile                # Multi-stage Node 20 Dockerfile (`development` & `production`)
    ├── public/showcase/          # High-craft showcase PNG frames (hero & turns 1–3)
    └── src/
        ├── app/                  # `layout.tsx`, `page.tsx`, `globals.css` (Editorial Neo-Brutalist tokens)
        ├── core/                 # `config/env.ts` & `http/backendClient.ts`
        ├── features/             # Modular domain slices:
        │   ├── auth/             # `components/SocialAuthModal.tsx`, `services/authService.ts`, `types/auth.types.ts`
        │   ├── landing/          # `HeroSection.tsx`, `InteractiveWalkthrough.tsx`, `PrivacyAndFaqSection.tsx`
        │   ├── studio/           # `InteractiveStudio.tsx`, `copilotService.ts`, `nanobananaClient.ts`, `studio.types.ts`
        │   └── history/          # `services/historyService.ts` & `types/history.types.ts` (Postgres + RustFS Gallery)
        └── shared/               # `components/layout/Navbar.tsx`
```

---

## 🔌 Universal `PORT_PAD` Convention (`PORT_PAD=1`, `PORT_PAD=2`, ...)

All 4 root Compose files (`podman-compose.yml`, `podman-compose.dev.yml`, `docker-compose.yml`, `docker-compose.dev.yml`) place an **Nginx Reverse Proxy Gateway** (`infra/nginx/nginx.conf`) in front of the stack and use a single universal **`${PORT_PAD}`** prefix on every host port mapping (`"${PORT_PAD}8080:80"`, `"${PORT_PAD}3000:3000"`, `"${PORT_PAD}8000:8000"`, `"${PORT_PAD}5432:5432"`, `"${PORT_PAD}9000:9000"`, `"${PORT_PAD}9001:9001"`):

| Service | Internal Port | Port Mapping Template | **`PORT_PAD=1`**<br>(Default in `*.dev.yml`) | **`PORT_PAD=2`**<br>(Default in `podman-compose.yml` / `docker-compose.yml`) | Description |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`nginx`** *(Gateway)* | `80` | `${PORT_PAD}8080:80` | **`http://localhost:18080`** | **`http://localhost:28080`** | Unified Reverse Proxy (`/`, `/api/`, `/s3/`, `/rustfs-console/`, `/nginx-health`). |
| **`frontend`** *(Next.js)* | `3000` | `${PORT_PAD}3000:3000` | **`http://localhost:13000`** | **`http://localhost:23000`** | Next.js web application (direct container port). |
| **`backend`** *(Flask)* | `8000` | `${PORT_PAD}8000:8000` | **`http://localhost:18000`** | **`http://localhost:28000`** | Python Flask + SQLAlchemy Co-Pilot & Persistence API (`wsgi:app`). |
| **`postgres`** *(PostgreSQL 16)* | `5432` | `${PORT_PAD}5432:5432` | **`localhost:15432`** | **`localhost:25432`** | Relational database (`users`, `conversations`, `conversation_turns`). |
| **`rustfs`** *(S3 API)* | `9000` | `${PORT_PAD}9000:9000` | **`http://localhost:19000`** | **`http://localhost:29000`** | RustFS S3-compatible object storage (`nanobanana-images`). |
| **`rustfs`** *(Web Console)* | `9001` | `${PORT_PAD}9001:9001` | **`http://localhost:19001`** | **`http://localhost:29001`** | RustFS administrative console (`rustfsadmin` / `rustfsadmin`). |

---

## 🚀 Quickstart (`podman-compose` & `docker-compose`)

### 1. Development Stack (`podman-compose.dev.yml` / `docker-compose.dev.yml` — `REQUIRE_AUTH=false`)
```bash
# With podman-compose and universal PORT_PAD:
PORT_PAD=1 podman-compose -f podman-compose.dev.yml up -d --build

# Or with docker-compose:
PORT_PAD=1 docker-compose -f docker-compose.dev.yml up -d --build
```
Open **`http://localhost:18080`** (Nginx Gateway) or **`http://localhost:13000`** (Frontend direct). Click **"INICIAR CRIAÇÃO ★"** to enter the Studio immediately as `usr_local_dev`.

### 2. Production Compose Stack (`podman-compose.yml` / `docker-compose.yml` — `REQUIRE_AUTH=true`)
```bash
# Run with PORT_PAD=1 (binds 18080, 13000, 18000, 15432, 19000, 19001):
PORT_PAD=1 podman-compose -f podman-compose.yml up -d --build

# Or run with PORT_PAD=2 (binds 28080, 23000, 28000, 25432, 29000, 29001):
PORT_PAD=2 podman-compose -f podman-compose.yml up -d --build

# Or with docker-compose:
PORT_PAD=1 docker-compose -f docker-compose.yml up -d --build
```

### 3. Production Kubernetes Deployment (`infra/deployment.yaml` & `infra/k8s/`)
When deploying to a Kubernetes cluster where PostgreSQL and the RustFS/S3 Bucket are already provisioned externally:
```bash
kubectl apply -f infra/deployment.yaml
# Or via Kustomize:
kubectl apply -k infra/k8s/
```
See **[`infra/deployment.md`](./infra/deployment.md)** for complete instructions.

### 4. Bare-Metal Local Development, Alembic Migrations & Testing

```bash
# Run Alembic Database Migrations (upgrade to latest head)
cd backend && .venv/bin/alembic upgrade head

# Create a new autogenerated Alembic migration revision
cd backend && .venv/bin/alembic revision --autogenerate -m "describe_schema_change"

# Roll back one migration revision
cd backend && .venv/bin/alembic downgrade -1

# Run Modular Backend Pytest Suite (Flask + SQLAlchemy + Alembic)
backend/.venv/bin/pytest -v backend/tests/test_api.py

# Start Backend Flask Server via WSGI entrypoint on port 8000
cd backend && .venv/bin/flask --app wsgi:app run --host=0.0.0.0 --port=8000 --reload

# Verify Frontend Production Build & Start on port 3000
cd frontend && npm run build && npm run dev
```

---

## 📚 Documentation Links

- **[Documentation Index (`docs/README.md`)](./docs/README.md)**
- **[System Architecture (`docs/architecture.md`)](./docs/architecture.md)**
- **[Data Models & Schemas (`docs/data-models.md`)](./docs/data-models.md)**
- **[Processing Pipelines (`docs/processing-pipelines.md`)](./docs/processing-pipelines.md)**
- **[Database & RustFS Bucket API Reference (`docs/database-and-bucket.md`)](./docs/database-and-bucket.md)**
- **[Zero-Storage Security & Social Auth (`docs/security-and-auth.md`)](./docs/security-and-auth.md)**
- **[Podman Compose & Docker Compose Guide (`docs/podman-compose.md`)](./docs/podman-compose.md)**
- **[Kubernetes Deployment Guide (`infra/deployment.yaml` & `infra/deployment.md`)](./infra/deployment.md)**
- **[AI Agent & Developer Guide (`AGENT.md`)](./AGENT.md)**
- **[Product Context (`PRODUCT.md`)](./PRODUCT.md)**
- **[Design System Specification (`DESIGN.md`)](./DESIGN.md)**
