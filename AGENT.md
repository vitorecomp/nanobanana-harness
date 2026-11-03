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
│   ├── README.md                 # Documentation index & executive overview
│   ├── architecture.md           # System architecture & component topology
│   ├── data-models.md            # SQLite schema, tables, and TypeScript definitions
│   ├── processing-pipelines.md   # Step-by-step pipeline sequence diagrams
│   ├── desktop-operations.md     # Desktop packaging (.deb, .AppImage, .dmg, .msi) & build guide
│   ├── sqlite-and-storage.md     # Local SQLite schema & filesystem conventions
│   └── security-and-auth.md      # Zero-Storage RAM policy & local vault security
├── frontend/                     # Next.js 15 + React 19 Frontend
│   ├── package.json              # Scripts: dev, build, build:tauri
│   ├── scripts/
│   │   └── build-tauri.mjs       # Build wrapper ensuring clean static export for Tauri
│   └── src/
│       ├── app/                  # App Router routes: /, /gallery, /modifiers, /create
│       │   ├── api/db/route.ts   # Node 22+ SQLite development bridge fallback
│       │   └── api/image/        # Local filesystem image streaming route
│       ├── core/
│       │   ├── context/          # StudioSessionContext (RAM API key & studio state)
│       │   └── tauri/            # tauriBridge.ts (Universal IPC command dispatcher)
│       ├── features/
│       │   ├── studio/           # InteractiveStudio, nanobananaClient, copilotService
│       │   ├── history/          # historyService & SQLite persistence types
│       │   └── auth/             # Profile and configuration modals
│       └── shared/               # AppShell, Navbar, and chamfered layout components
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

### 2. Zero-Scroll Desktop Shell (`100vw × 100vh`)
- The outer application frame must occupy exactly `100vw × 100vh` without outer page scrollbars.
- Layout divisions use structural borders (`1.5px solid rgba(20, 33, 61, 0.22)`) rather than nested container boxes.
- Chamfered 45° card styling (`clip-path: polygon(...)`) is restricted to the sidebar, gallery cards, modifier categories, and the 4 generated quad image cards.

### 3. Strict 5-Color Brand Palette
- Jet Black: `#000000`
- Oxford Navy: `#14213d` (dominant frame and chrome)
- Cyber Gold: `#fca311` (primary action accents, starbursts, active states)
- Platinum: `#e5e5e5` (workspace canvas backgrounds)
- Pure White: `#ffffff` (card surfaces and text contrast)
- Carmine Crimson: `#d62828` (reserved exclusively for two-step destructive confirmation)

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
npm --prefix frontend exec -- tsc --noEmit

# 3. Compile static export bundle for Tauri
npm run build:tauri

# 4. Launch Tauri native desktop development window
npm run tauri:dev

# 5. Compile native desktop installers (.deb, .AppImage, .dmg, .msi)
npm run tauri:build
```
