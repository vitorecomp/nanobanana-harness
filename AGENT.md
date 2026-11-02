# AGENT.md — Nano Banana Interactive Studio (Tauri v2 + React 19 + Local SQLite)

## Overview
**Nano Banana Interactive Studio** is an installable Desktop & Web application built with:
- **Tauri v2 Native Core** ([`src-tauri/`](file:///usr/local/google/home/vieiravitor/workspace/opensource/nanobanana-inspiration/src-tauri/src/lib.rs)):
  - [`src-tauri/src/db.rs`](file:///usr/local/google/home/vieiravitor/workspace/opensource/nanobanana-inspiration/src-tauri/src/db.rs): Local SQLite 3 database (`<app_data_dir>/nanobanana.sqlite3`) via `rusqlite` with `users`, `conversations`, `conversation_turns`, and `app_vault` tables.
  - [`src-tauri/src/storage.rs`](file:///usr/local/google/home/vieiravitor/workspace/opensource/nanobanana-inspiration/src-tauri/src/storage.rs): Native OS filesystem storage (`<app_data_dir>/images/<user_id>/<turn_id>.png`).
  - [`src-tauri/src/copilot.rs`](file:///usr/local/google/home/vieiravitor/workspace/opensource/nanobanana-inspiration/src-tauri/src/copilot.rs): Native Rust Co-Pilot (`analyze_idea` and `refine_prompt`).
- **Frontend & Universal Bridge** ([`frontend/`](file:///usr/local/google/home/vieiravitor/workspace/opensource/nanobanana-inspiration/frontend/package.json)):
  - Next.js 15 Static Export (`output: "export"` -> `frontend/out`) + React 19 + TypeScript.
  - [`tauriBridge.ts`](file:///usr/local/google/home/vieiravitor/workspace/opensource/nanobanana-inspiration/frontend/src/core/tauri/tauriBridge.ts): Automatically invokes Tauri v2 Rust commands (`__TAURI_INTERNALS__.invoke`) inside the native desktop app and falls back to an identical local SQLite-schema store when running `npm run dev` in the browser.

## Commands
- `npm run dev`: Starts the local development server on `http://localhost:8080`.
- `npm run build`: Builds the static bundle into `frontend/out` for Tauri packaging.
- `npm run tauri:dev`: Launches the Tauri v2 desktop window.
- `npm run tauri:build`: Compiles native installers (`.deb`, `.AppImage`, `.dmg`, `.msi`).
