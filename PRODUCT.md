# PRODUCT.md — Product Context & Value Proposition (Impeccable Init) 🍌✦

This document establishes the durable product vision, user personas, experience architecture, and security boundaries of **Nano Banana Studio**.

---

## 1. Product Vision

**Nano Banana Studio** is an interactive web studio for AI-assisted art direction and multi-turn conversational image creation powered by **Google Nano Banana (`gemini-2.5-flash-image`)**.

Unlike conventional text-to-image generators that present an empty prompt box ("trial-and-error prompting"), **Nano Banana Studio** acts as an **Interactive Art Director (Python Flask + SQLAlchemy Co-Pilot)** that diagnoses the creator's initial idea, detects missing cinematic dimensions (lighting, camera/lens optics, composition, mood, environment), asks guided questions with clickable answer chips, and orchestrates multi-turn visual refinement while preserving character identity across frames.

---

## 2. Target User Personas

1. **Illustrators, Concept Artists & Art Directors**:
   - Need high aesthetic precision (such as *Crypko-inspired Editorial Anime cel-shading*, *35mm Analog Photography*, or *Neo-Brutalist Illustration*) and granular control over camera framing and lighting without losing character consistency across iterations.
2. **Privacy-Conscious Developers Running a Local Instance**:
   - Own a personal Google AI Studio API key (`AIza...`) and want to spin up a local instance (`compose.yaml`) where they can jump straight into the Interactive Studio **without any login barrier** (`REQUIRE_AUTH=false`), while keeping their API key **100% in volatile browser RAM (`Zero-Storage`)** and saving their prompt history in local PostgreSQL and images in local RustFS.
3. **Multi-Session Cloud Creators (Google & Facebook OAuth)**:
   - In production Kubernetes environments (`infra/deployment.yaml` & `infra/k8s/`, `REQUIRE_AUTH=true`), creators sign in with their **Google** or **Facebook** account so all their creative conversations, evolved prompts, and generated images are isolated and persisted in **PostgreSQL** and the **RustFS S3 Bucket** for later consultation and 1-click branching.

---

## 3. Experience Architecture: Showcase, Auth Modes & Interactive Studio

### 3.1 Editorial Showcase Area (Discovery, Transparency & Visual Simulation)
Visitors immediately understand how the system works:
- **High-Impact Editorial Hero**: Showcases the Crypko-inspired Neo-Brutalist design with a rotating circular text seal around a 20-point starburst CTA (`INICIAR CRIAÇÃO ★`).
- **4-Stage Interactive Workflow Walkthrough** & **3-Turn Visual Evolution Simulator** (`/showcase/step-1-base.png` → `/showcase/step-2-lighting.png` → `/showcase/step-3-cyber.png`).
- **Zero-Storage Privacy Architecture Diagram**: Explains why the Gemini API key never leaves browser RAM.

### 3.2 Authentication Modes: Local Dev Instance (`compose.yaml`) vs. Production Kubernetes OAuth
- **Local / Dev Mode (`REQUIRE_AUTH=false`, default in `compose.yaml`)**:
  - Login is **not required**. Clicking **"INICIAR CRIAÇÃO ★"**, **"Abrir Studio"**, or **"CRIAR AGORA"** launches the Interactive Studio immediately using the auto-provisioned `usr_local_dev` (`Local Dev Instance`) profile in PostgreSQL.
  - Optional **Google (`POST /api/auth/google`)** and **Facebook (`POST /api/auth/facebook`)** sign-in remains accessible from the navbar whenever the developer wants to test social login flows.
- **Production Mode on Kubernetes (`REQUIRE_AUTH=true`, in `infra/deployment.yaml` & `infra/k8s/`)**:
  - Clicking Studio entry CTAs opens the social authentication modal supporting **Google OAuth 2.0** and **Facebook Login**, upserting the verified user into PostgreSQL via SQLAlchemy.

### 3.3 Interactive Studio + PostgreSQL History + RustFS Bucket Gallery
- **Volatile RAM API Key Bar**: Password input isolated in `React.useState` with an instant `"Clear from RAM"` button and an `"Interactive Simulation Mode"` toggle.
- **Left Column — Python Flask Prompt Co-Pilot**: Completeness meter (`0–100%`), 6 style presets, 5 modifier categories, clickable guided questions, 3 complete prompt variations, and quick multi-turn refinement chips.
- **Right Column — Live Canvas & Branchable Timeline**: Renders the generated `gemini-2.5-flash-image` frame, supports side-by-side comparison with previous turns, PNG download, and branching from any historical node.
- **PostgreSQL Conversation History & RustFS Bucket Gallery (Later Consultation)**:
  - Lists all past conversations stored in **PostgreSQL** (`GET /api/conversations`).
  - Provides the **RustFS Bucket Gallery** (`GET /api/users/<id>/gallery`), where every image stored in the `nanobanana-images` bucket can be inspected alongside its exact prompt metadata and resumed with 1 click.

---

## 4. Non-Negotiable Security & Storage Boundary

| Asset / Credential | Where It Lives / Is Processed | Security Policy |
| :--- | :--- | :--- |
| **Google Gemini API Key (`AIza...`)** | Exclusively in `React.useState` (Browser Volatile RAM) | **ZERO-STORAGE**: Never saved in `localStorage`, `cookies`, PostgreSQL, or RustFS. Actively rejected with HTTP 400 by the Python Flask backend. |
| **User Identity (`local_dev`, `google`, `facebook`)** | PostgreSQL `users` table (via SQLAlchemy) | Identifies the owner of saved conversations and gallery images. |
| **Conversations, Prompts & Guided Answers** | PostgreSQL `conversations` & `conversation_turns` tables | Persisted for later consultation and multi-turn resumption. |
| **Generated & Iterated Images (`PNG`)** | **RustFS** S3 Bucket (`nanobanana-images`) | Persisted and streamed via `/api/bucket/...` for the User Gallery. |
