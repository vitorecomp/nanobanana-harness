# AGENT.md — AI Agent & Developer Engineering Guide 🍌✦

This document defines the architectural invariants, corporate module organization, security boundaries, design craft rules, data models, and operational commands for the **Nano Banana Studio (`nanobanana-inspiration`)** repository. Every AI agent and developer working on this codebase **must** follow these rules strictly.

---

## 1. System Overview & Corporate Modular Structure

**Nano Banana Studio** is an interactive art-direction and multi-turn conversational image creation platform powered by **Google Nano Banana (`gemini-2.5-flash-image`)**.

### Core Architecture Components
1. **Nginx Reverse Proxy Gateway (`infra/nginx/nginx.conf`)**:
   - Unified entry gateway sitting in front of all services (`/` → `frontend:3000`, `/api/` → `backend:8000`, `/s3/` → `rustfs:9000`, `/rustfs-console/` → `rustfs:9001`, `/nginx-health` → `200 OK`).
2. **Enterprise Feature-Based Next.js Frontend (`frontend/src/`)**:
   - App Router + TypeScript + bespoke Vanilla CSS (`frontend/src/app/globals.css`), structured into modular domain slices:
     - `frontend/src/app/`: `layout.tsx`, `page.tsx`, and `globals.css`.
     - `frontend/src/core/`: `config/env.ts` (`IS_AUTH_REQUIRED`, environment constants) and `http/backendClient.ts` (`fetchBackendApi`).
     - `frontend/src/features/auth/`: `components/SocialAuthModal.tsx`, `services/authService.ts` (`authenticateWithGoogle`, `authenticateWithFacebook`, `LOCAL_DEV_USER`), and `types/auth.types.ts`.
     - `frontend/src/features/landing/`: `HeroSection.tsx`, `InteractiveWalkthrough.tsx`, and `PrivacyAndFaqSection.tsx`.
     - `frontend/src/features/studio/`: `components/InteractiveStudio.tsx`, `services/copilotService.ts`, `services/nanobananaClient.ts` (direct browser-to-Google Gemini client), and `types/studio.types.ts`.
     - `frontend/src/features/history/`: `services/historyService.ts` and `types/history.types.ts`.
     - `frontend/src/shared/`: `components/layout/Navbar.tsx`.
   - **Dev vs. Prod Auth Behavior**: In **Dev/Local Mode (`docker-compose.dev.yml`, `NEXT_PUBLIC_REQUIRE_AUTH=false`)**, login is **not required** — users enter the Studio directly as `usr_local_dev` (`Local Dev Instance`) with full PostgreSQL and RustFS persistence, while Google/Facebook sign-in remains optionally available in the navbar. In **Production Mode (`docker-compose.yml` & Kubernetes `infra/deployment.yaml`, `NEXT_PUBLIC_REQUIRE_AUTH=true`)**, Google or Facebook login is enforced before entering the Studio.
3. **Enterprise Modular Python Flask + SQLAlchemy + Alembic Backend (`backend/`)**:
   - Organized as a clean corporate package under `backend/app/` with WSGI entrypoint `backend/wsgi.py` (`app = create_app()`) and versioned **Alembic** migrations (`backend/alembic.ini` & `backend/migrations/`):
     - `backend/migrations/`: `env.py`, `script.py.mako`, and `versions/20261102_0001_initial_schema.py` managing schema evolution (`alembic upgrade head` / `alembic downgrade -1`).
     - `backend/app/__init__.py`: Application factory `create_app()` registering CORS, middleware, SQLAlchemy/Alembic initialization, and v1 API Blueprints.
     - `backend/app/core/`: `config.py` (centralized environment settings) and `middleware.py` (`zero_storage_api_key_guard` hook).
     - `backend/app/db/`: `session.py` (SQLAlchemy 2.0 Engine, `SessionLocal`, `Base`, `run_migrations()`, `init_db()`, `get_db_session()`).
     - `backend/app/models/`: `user.py` (`User`) and `conversation.py` (`Conversation`, `ConversationTurn`).
     - `backend/app/services/`: `auth_service.py` (Google & Facebook OAuth + `usr_local_dev` provisioning), `copilot_service.py` (style presets, modifiers, `analyze_prompt()`, `refine_prompt()`), `conversation_service.py` (conversation & turn persistence), and `storage_service.py` (RustFS S3-compatible bucket client).
     - `backend/app/api/v1/`: Flask Blueprints (`health_routes.py`, `copilot_routes.py`, `auth_routes.py`, `conversation_routes.py`, `gallery_routes.py`).
     - `backend/tests/`: `conftest.py` and `test_api.py`.
4. **PostgreSQL 16 (`postgres`) & RustFS Bucket (`rustfs/rustfs:latest`)**:
   - PostgreSQL stores `users`, `conversations`, and `conversation_turns`.
   - RustFS stores generated PNG frames inside the S3-compatible `nanobanana-images` bucket (`{user_id}/{conversation_id}/turn-{n}-{uuid}.png`).
5. **Container Compose (`podman-compose.yml`, `podman-compose.dev.yml`, `docker-compose.yml`, `docker-compose.dev.yml`) & Kubernetes (`infra/`)**:
   - Root `podman-compose.yml` / `docker-compose.yml` (production build) and `podman-compose.dev.yml` / `docker-compose.dev.yml` (development with hot-reload and `REQUIRE_AUTH=false`) use the universal **`PORT_PAD`** prefix variable (`"${PORT_PAD}8080:80"`, `"${PORT_PAD}3000:3000"`, `"${PORT_PAD}8000:8000"`, `"${PORT_PAD}5432:5432"`, `"${PORT_PAD}9000:9000"`, `"${PORT_PAD}9001:9001"`).
   - `infra/deployment.yaml` and `infra/k8s/*.yaml` provide Kubernetes manifests for the stateless application tier assuming external PostgreSQL and external RustFS/S3 Bucket.

---

## 2. Critical Invariant #1: Zero-Storage Gemini API Key Policy (`AIza...`)

> **NON-NEGOTIABLE SECURITY RULE**: The user's Google Gemini / Nano Banana API key (`AIza...`) must **NEVER** be stored on disk, database, object bucket, logs, or browser storage, and must **NEVER** be transmitted to the Python Flask backend or Nginx gateway.

1. **Frontend Enforcement (`frontend/src/`)**:
   - The Gemini API key is held **exclusively** in volatile React state (`useState` in RAM).
   - **Zero** calls to `localStorage`, `sessionStorage`, `IndexedDB`, `cookies`, or URL parameters for the API key.
   - All calls to Google's Nano Banana API (`frontend/src/features/studio/services/nanobananaClient.ts`) go **directly from the user's browser** to `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` with `cache: "no-store"` and the `x-goog-api-key` header.
2. **Backend Enforcement (`backend/app/core/middleware.py`)**:
   - The Flask `before_request` hook (`zero_storage_api_key_guard`) inspects all incoming headers (`x-goog-api-key`, `x-api-key`, `Authorization`), query parameters, and JSON payloads (`api_key`, `gemini_api_key`, or regex `AIza[0-9A-Za-z\-_]{15,}`).
   - Any request containing a Gemini API key is immediately rejected with **HTTP `400 Bad Request` (`error_code: "API_KEY_REJECTED_ZERO_STORAGE"`)** without logging or echoing the key.

---

## 3. Critical Invariant #2: Impeccable Craft Floor & Design System (`DESIGN.md`)

All UI work in `frontend/src/` must comply with [`DESIGN.md`](./DESIGN.md) and the **Impeccable Craft Floor**:
- **Color Palette**: Outer viewport `#C4C4C0`, main editorial cream canvas `#E9E7DF`, deep carbon ink/borders `#0B0B0B`, primary accent acid-banana yellow `#F2FA3C`, crisp white cards `#FFFFFF` with `1.5px solid #0B0B0B` borders.
- **Typography**: `Anton` for condensed uppercase display headlines (`letter-spacing: -0.02em`), `Plus Jakarta Sans` for body copy (`60ch–72ch` max measure), and `JetBrains Mono` for technical prompt tokens and tabular numbers.
- **Craft Floor Rules**: Minimum **4.5:1** contrast ratio, **`44x44px`** minimum touch targets, **no** gradient text, **no** thick colored side-stripe borders, **no** repetitive eyebrow kickers, and **Vanilla CSS only**.

---

## 4. Universal `PORT_PAD` Convention (`PORT_PAD=1`, `PORT_PAD=2`, ...)

| Service | Container Port | Port Mapping Template | **`PORT_PAD=1`** | **`PORT_PAD=2`** |
| :--- | :---: | :---: | :---: | :---: |
| **`nginx`** *(Gateway)* | `80` | `${PORT_PAD}8080:80` | `http://localhost:18080` | `http://localhost:28080` |
| **`frontend`** *(Next.js)* | `3000` | `${PORT_PAD}3000:3000` | `http://localhost:13000` | `http://localhost:23000` |
| **`backend`** *(Flask `wsgi:app`)* | `8000` | `${PORT_PAD}8000:8000` | `http://localhost:18000` | `http://localhost:28000` |
| **`postgres`** *(PostgreSQL 16)* | `5432` | `${PORT_PAD}5432:5432` | `localhost:15432` | `localhost:25432` |
| **`rustfs`** *(S3 API)* | `9000` | `${PORT_PAD}9000:9000` | `http://localhost:19000` | `http://localhost:29000` |
| **`rustfs`** *(Console)* | `9001` | `${PORT_PAD}9001:9001` | `http://localhost:19001` | `http://localhost:29001` |

---

## 5. Verification & Operational Commands

```bash
# 1. Run Alembic Database Migrations
cd backend && .venv/bin/alembic upgrade head

# 2. Run Modular Python Flask + SQLAlchemy + Alembic Backend Test Suite (pytest)
backend/.venv/bin/pytest -v backend/tests/test_api.py

# 3. Verify Next.js TypeScript & Production Build
cd frontend && npm run build

# 4. Start Dev Stack with Universal PORT_PAD (Gateway :18080, REQUIRE_AUTH=false)
PORT_PAD=1 podman-compose -f podman-compose.dev.yml up -d --build
# Or with docker-compose:
PORT_PAD=1 docker-compose -f docker-compose.dev.yml up -d --build

# 5. Start Prod Compose Stack with Universal PORT_PAD (REQUIRE_AUTH=true)
PORT_PAD=1 podman-compose -f podman-compose.yml up -d --build
# Or on pad 2 (:28080):
PORT_PAD=2 podman-compose -f podman-compose.yml up -d --build

# 6. Deploy Application System to Kubernetes (External DB & External Bucket)
kubectl apply -f infra/deployment.yaml
# Or with Kustomize:
kubectl apply -k infra/k8s/
```
