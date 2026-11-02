# System Architecture — Nano Banana Studio 🍌✦

This document details the distributed architecture of **Nano Banana Studio**, illustrating how the **Nginx Reverse Proxy Gateway (`nginx:1.27-alpine`)**, **Next.js Frontend**, **Python Flask + SQLAlchemy Backend**, **PostgreSQL 16 Database**, **RustFS S3-Compatible Object Storage Bucket (`rustfs/rustfs:latest`)**, **Social OAuth Providers (Google & Facebook)**, and **Google Gemini Nano Banana API** interact with strict security and low latency.

---

## 1. Component Topology & Separation of Planes

The system architecture is built on three core principles:

1. **Unified Nginx Reverse Proxy Gateway (`docker-compose.dev.yml`, `docker-compose.yml`, and `infra/deployment.yaml`)**:
   - An **Nginx (`infra/nginx/nginx.conf`)** reverse proxy receives incoming traffic on the **Port-Padded** gateway port (`:18080` in Dev `+10000`; `:28080` in Prod `+20000`) and routes requests transparently to `frontend:3000` (`/`), `backend:8000` (`/api/`), `rustfs:9000` (`/s3/`), and `rustfs:9001` (`/rustfs-console/`).
2. **Control, Co-Pilot & Persistence Plane (`Frontend <-> Nginx <-> Modular Flask Backend <-> PostgreSQL + RustFS Bucket`)**:
   - Implemented in an enterprise modular package (`backend/app/{core,db,models,services,api/v1}` + `backend/wsgi.py`). Manages user identity (frictionless auto-provisioned `usr_local_dev` in Dev mode when `REQUIRE_AUTH=false`, and enforced **Google OAuth 2.0** or **Facebook Login** in Production mode when `REQUIRE_AUTH=true`), heuristic prompt engineering, multi-turn conversation history (`conversations`, `conversation_turns`), and S3 image storage in **RustFS** (`nanobanana-images`) for later consultation. **No Gemini API key ever transits through this plane.**
3. **Zero-Storage Generative Execution Plane (`Browser RAM -> Google Gemini API`)**:
   - Connects the user's browser **directly** to `https://generativelanguage.googleapis.com` using the API key held exclusively in volatile React memory (`useState`), bypassing Nginx and the Python Flask backend completely.

```mermaid
flowchart TB
    subgraph Client["Client Layer — User Browser"]
        direction TB
        Landing["Editorial Showcase Area\n(Hero, 4-Stage Walkthrough, 3-Turn Simulator)"]
        AuthModal["Social Sign-In Modal (Google & Facebook)\n(Optional in Dev, Required in Prod)"]
        Studio["Interactive Studio\n(Co-Pilot Controls, Live Canvas, Timeline)"]
        HistoryPanel["PostgreSQL History & RustFS Gallery\n(Later Consultation of Prompts & Images)"]
        VolatileRAM["Volatile React State (useState)\n🔑 Gemini API Key (RAM Only)"]
    end

    subgraph ExternalProviders["External Providers (Direct HTTPS)"]
        direction TB
        SocialOAuth["Google Identity Services &\nFacebook OAuth"]
        NanoBananaAPI["Google Gemini API\ngemini-2.5-flash-image\n(:generateContent)"]
    end

    subgraph PodmanNetwork["Container / K8s Infrastructure (Port Pad +10000 Dev / +20000 Prod)"]
        direction TB
        NginxGW["Nginx Reverse Proxy Gateway (nginx/nginx.conf)\nDev :18080 | Prod :28080\nRoutes: / | /api/ | /s3/ | /rustfs-console/ | /nginx-health"]

        subgraph FrontendContainer["Next.js Frontend (Dev :13000 / Prod :23000 -> :3000)"]
            NextApp["Next.js App Router + /api/* Rewrites"]
        end

        subgraph BackendContainer["Modular Python Flask + SQLAlchemy Backend (Dev :18000 / Prod :28000 -> :8000)"]
            Guard["Zero-Storage Security Hook\n(app/core/middleware.py)"]
            AuthRouter["Auth Blueprint & Service\n(app/api/v1/auth_routes.py & app/services/auth_service.py)"]
            PromptEngine["Prompt Co-Pilot Blueprint & Service\n(app/api/v1/copilot_routes.py & app/services/copilot_service.py)"]
            HistoryRouter["Conversations & Gallery Blueprints\n(app/api/v1/conversation_routes.py & gallery_routes.py)"]
            StorageService["RustFS / S3 Object Storage Service\n(app/services/storage_service.py)"]
        end

        PostgresDB[("PostgreSQL 16 (Dev :15432 / Prod :25432 -> :5432)\nSQLAlchemy ORM Tables: users,\nconversations, conversation_turns")]
        RustfsBucket[("RustFS Object Storage (Dev :19000 / Prod :29000 -> :9000)\nrustfs/rustfs:latest (S3 Compatible)\nBucket: nanobanana-images")]
    end

    Landing -->|"Dev: Direct Entry (usr_local_dev)\nProd: Sign In with Google/Facebook"| Studio
    Landing -.->|"Optional in Dev / Required in Prod"| AuthModal
    AuthModal <-->|"OAuth 2.0"| SocialOAuth
    AuthModal -->|"POST /api/auth/google or /facebook"| NginxGW
    Studio -->|"GET / & Static Assets"| NginxGW
    Studio -->|"POST /api/interactive/analyze & /refine"| NginxGW
    Studio -->|"POST /api/conversations/<id>/turns"| NginxGW
    HistoryPanel -->|"GET /api/conversations & /gallery & /api/bucket/*"| NginxGW

    NginxGW -->|"Location /"| NextApp
    NginxGW -->|"Location /api/"| Guard
    NginxGW -->|"Location /s3/"| RustfsBucket

    Guard --> AuthRouter
    Guard --> PromptEngine
    Guard --> HistoryRouter

    AuthRouter -->|"SQLAlchemy Upsert User"| PostgresDB
    HistoryRouter -->|"SQLAlchemy Read/Write Conversations & Turns"| PostgresDB
    HistoryRouter --> StorageService
    StorageService -->|"PutObject / GetObject S3"| RustfsBucket

    VolatileRAM -->|"Ephemeral RAM Read"| Studio
    Studio ===>|"DIRECT HTTPS CALL (x-goog-api-key)\nNever passes through Nginx or Flask Backend"| NanoBananaAPI
    NanoBananaAPI ===>|"Returns Base64 Image (inlineData)"| Studio
```

---

## 2. Port Pad Convention (`+10000` Dev vs. `+20000` Prod)

| Service | Internal Port | **Dev Environment (`docker-compose.dev.yml`)**<br>Port Pad **`+10000` (`1xxxx`)** | **Prod Environment (`docker-compose.yml`)**<br>Port Pad **`+20000` (`2xxxx`)** |
| :--- | :---: | :---: | :---: |
| **`nginx`** *(Unified Gateway)* | `80` | `http://localhost:18080` | `http://localhost:28080` |
| **`frontend`** *(Next.js)* | `3000` | `http://localhost:13000` | `http://localhost:23000` |
| **`backend`** *(Flask `wsgi:app`)* | `8000` | `http://localhost:18000` | `http://localhost:28000` |
| **`postgres`** *(PostgreSQL 16)* | `5432` | `localhost:15432` | `localhost:25432` |
| **`rustfs`** *(S3 API)* | `9000` | `http://localhost:19000` | `http://localhost:29000` |
| **`rustfs`** *(Web Console)* | `9001` | `http://localhost:19001` | `http://localhost:29001` |

---

## 3. Authentication Modes: Local Dev Instance vs. Production OAuth (Google & Facebook)

### 3.1 Local / Development Mode (`docker-compose.dev.yml`, `REQUIRE_AUTH=false`)
In `docker-compose.dev.yml`, `REQUIRE_AUTH` and `NEXT_PUBLIC_REQUIRE_AUTH` default to `false` so developers running a local instance can jump straight into the Interactive Studio without any login barrier:
- Clicking **"INICIAR CRIAÇÃO ★"** or **"Abrir Studio"** enters the Studio immediately as `usr_local_dev` (`Local Dev Instance`, `dev@localhost`).
- The Flask + SQLAlchemy backend automatically ensures the `usr_local_dev` record exists in PostgreSQL (`users`), so conversation saving and RustFS bucket gallery consultation work out-of-the-box.
- Developers can still click the navbar sign-in button at any time to test **Google** or **Facebook** authentication.

### 3.2 Production Mode (`docker-compose.yml` & Kubernetes `infra/deployment.yaml`, `REQUIRE_AUTH=true`)
In `docker-compose.yml` and Kubernetes (`infra/deployment.yaml` / `infra/k8s/`), `REQUIRE_AUTH` and `NEXT_PUBLIC_REQUIRE_AUTH` are set to `true`:
- Entering the Studio requires authenticating via **Google (`POST /api/auth/google`)** or **Facebook (`POST /api/auth/facebook`)**.
- The Flask backend verifies the token and upserts the `User` in PostgreSQL via SQLAlchemy.
