# AGENT.md — Nano Banana Atelier Studio 🍌✦

Instructions, system architecture, invariants, and coding conventions for AI agents working in `nanobanana-inspiration`.

---

## 1. Project Overview & Identity

**Nano Banana Atelier Studio** is an installable Desktop and Web application designed for AI-assisted visual art direction and multi-turn conversational image creation powered by **Google Nano Banana (`gemini-2.5-flash-image`)** and **`gemini-2.5-flash`**.

### Architectural Foundation
- **Desktop Runtime**: **Tauri v2** native core written in Rust (`src-tauri/`) hosting an OS native WebView.
- **Frontend Core**: **Next.js 15 (Static Export `output: "export"`)** + **React 19** + TypeScript (`frontend/`).
- **Persistence**: **Local-First SQLite (`nanobanana.sqlite3`)** via `rusqlite` (desktop) and `node:sqlite` (browser development fallback).
- **Image Storage**: **Native OS Filesystem** directly under `~/Pictures/nanobanana/<project-name>/<turn-id>.png`.
- **Zero-Storage Security**: The Google Gemini API key (`AIza...`) resides exclusively in React volatile RAM (`useState`), with an optional user-consented persistence in the local desktop `app_vault` SQLite table.

---

## 2. Repository Layout

```text
nanobanana-inspiration/
├── README.md                     # Project overview and desktop quickstart
├── AGENT.md                      # Engineering guidelines and rules for AI agents (this file)
├── PRODUCT.md                    # Durable product vision, user personas, and brand commitments
├── DESIGN.md                     # Neo-Brutalist design tokens, craft floor, and visual hierarchy
├── docs/                         # Technical documentation suite
│   ├── goal-harness.md           # Deep dive into the 4-stage AutoRef + EvoGen TRACE Goal Harness
│   ├── README.md                 # Documentation index & executive overview
│   ├── architecture.md           # System architecture & component topology
│   ├── data-models.md            # SQLite schema, tables, and TypeScript definitions
│   ├── processing-pipelines.md   # Step-by-step pipeline sequence diagrams
│   ├── desktop-operations.md     # Desktop packaging (x86/x64 .exe/.msi, .deb, .AppImage, .rpm, .dmg) & CI/CD
│   ├── sqlite-and-storage.md     # Local SQLite schema & filesystem conventions
│   └── security-and-auth.md      # Zero-Storage RAM policy & local vault security
├── frontend/                     # Next.js 15 + React 19 Frontend
│   ├── package.json              # Scripts: dev, build, build:tauri
│   ├── scripts/
│   │   └── build-tauri.mjs       # Build wrapper ensuring clean static export for Tauri
│   └── src/
│       ├── app/                  # App Router routes: /, /harness, /create, /gallery, /modifiers
│       │   ├── api/db/route.ts   # Node 22+ SQLite development bridge fallback
│       │   └── api/image/        # Local filesystem image streaming route
│       ├── core/
│       │   ├── context/          # StudioSessionContext (RAM API key & studio/harness state)
│       │   └── tauri/            # tauriBridge.ts (Universal IPC command dispatcher)
│       ├── features/
│       │   ├── harness/          # Goal Harness agents (Planner, Critic, TRACE Refiner & Living Spec)
│       │   ├── studio/           # InteractiveStudio, nanobananaClient, copilotService
│       │   ├── history/          # historyService & SQLite persistence types
│       │   └── auth/             # Profile and Studio/Harness Settings modals
│       └── shared/               # AppShell, Navbar, and Neo-Brutalist Swiss UI components
└── src-tauri/                    # Tauri v2 Native Core (Rust)
    ├── Cargo.toml                # Dependencies: tauri v2, rusqlite, serde, tokio
    ├── tauri.conf.json           # Window configuration, capabilities & bundle metadata
    └── src/
        ├── lib.rs                # IPC command registrations & Tauri entrypoint
        ├── db.rs                 # SQLite connection manager, WAL mode & migrations
        ├── storage.rs            # Native filesystem image storage (~/Pictures/nanobanana)
        └── copilot.rs            # Native Rust prompt diagnosis and refinement heuristics
```

---

## 3. Non-Negotiable Invariants & Guardrails

### 1. Zero-Storage Credential Security
- **Never** write the Google Gemini API key (`AIza...`) to `localStorage`, `sessionStorage`, `cookies`, or URL search params.
- The API key lives exclusively in `React.useState` in memory unless the user explicitly checks *"Remember in Local App Vault"*, which writes strictly to local SQLite on the user's private workstation.
- Never hardcode API keys or commit secrets to git.

### 2. Zero-Scroll Desktop Shell (`100vw × 100vh`) & Neo-Brutalist Swiss Surfaces
- The outer application frame must occupy exactly `100vw × 100vh` without outer page scrollbars.
- Cards, toolbars, and modals use smooth rounded geometry (`14px–20px`), `1.5px–2px solid #0d1b2a` structural borders, and crisp zero-blur bottom-right offset shadows (`--ref-shadow-hard-*`).

### 3. Strict 5-Step Cool-Slate Atelier Palette
- Deepest Ink: `#0d1b2a`
- Primary Slate Navy: `#1b263b`
- Mid Slate: `#415a77`
- Steel Blue Accent: `#778da9`
- Warm Alabaster Canvas: `#e0e1dd` (plus `#ffffff` card surfaces)

### 4. Non-Destructive Creative Lineage
- Always record `parent_turn_number` when saving new turns.
- Navigating back to an earlier turn in the timeline loads its context but **never** deletes or mutates existing turns.
- Deleting a project from SQLite **preserves** the physical folder and PNG files in `~/Pictures/nanobanana/<project-name>/`.

### 5. Universal Bridge Invariant
- Any database or storage mutation must be implemented through [`tauriBridge.ts`](file:///usr/local/google/home/vieiravitor/workspace/opensource/nanobanana-inspiration/frontend/src/core/tauri/tauriBridge.ts).
- Both the native Tauri IPC handler (`src-tauri/src/lib.rs`) and the web dev route (`frontend/src/app/api/db/route.ts`) must support identical schemas and action names.

---

## 4. Development & Build Commands

```bash
# 1. Run local web development server (port 8080)
npm run dev

# 2. Typecheck frontend code
npm run typecheck

# 3. Compile static export bundle for Tauri
npm run build:tauri-web

# 4. Check Tauri Rust core
cargo check --manifest-path src-tauri/Cargo.toml

# 5. Launch Tauri native desktop development window
npm run tauri:dev

# 6. Compile native desktop installers (.deb, .AppImage, .rpm / x86 & x64 .exe, .msi / .dmg)
npm run tauri:build
```
