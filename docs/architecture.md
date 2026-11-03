# System Architecture — Nano Banana Atelier Studio 🍌✦

This document details the software architecture of **Nano Banana Atelier Studio**, illustrating the interactions between the **Next.js 15 / React 19 Frontend WebView**, the **Tauri v2 Native Rust Core**, the **Local SQLite Database (`nanobanana.sqlite3`)**, the **Native OS Filesystem (`~/Pictures/nanobanana/`)**, and **Google Cloud Gemini APIs (`gemini-2.5-flash` and `gemini-2.5-flash-image`)**.

---

## 1. System Topology & Separation of Tiers

Nano Banana Studio is built on three architectural tiers:

1. **Presentation & Creative UI Tier (`frontend/`)**:
   - Engineered in **Next.js 15** with **React 19** and TypeScript.
   - Operates inside an OS-native desktop WebView (or local browser during standalone development).
   - Manages prompt composition, the `2×2` Quad Generation Matrix, side-by-side Lightbox comparisons, the interactive branching timeline, and modifier categories.
   - Enforces the **Zero-Storage Volatile RAM Policy**: the Gemini API key lives in `useState` and never leaves volatile client memory without explicit user consent.
2. **Native Orchestration Tier (`src-tauri/`)**:
   - Engineered in **Rust** using **Tauri v2**.
   - Handles IPC commands dispatched by the frontend bridge (`frontend/src/core/tauri/tauriBridge.ts`).
   - Manages relational SQLite persistence via `rusqlite` ([`src-tauri/src/db.rs`](file:///usr/local/google/home/vieiravitor/workspace/opensource/nanobanana-inspiration/src-tauri/src/db.rs)).
   - Manages filesystem operations, project directory synchronization, and image writing ([`src-tauri/src/storage.rs`](file:///usr/local/google/home/vieiravitor/workspace/opensource/nanobanana-inspiration/src-tauri/src/storage.rs)).
   - Executes native prompt diagnosis and refinement heuristics ([`src-tauri/src/copilot.rs`](file:///usr/local/google/home/vieiravitor/workspace/opensource/nanobanana-inspiration/src-tauri/src/copilot.rs)).
3. **Generative Execution Plane (Direct Client HTTPS)**:
   - Connects the user's browser/WebView **directly** to `https://generativelanguage.googleapis.com` via standard HTTPS fetch calls ([`nanobananaClient.ts`](file:///usr/local/google/home/vieiravitor/workspace/opensource/nanobanana-inspiration/frontend/src/features/studio/services/nanobananaClient.ts)).
   - Uses `cache: "no-store"` to ensure generated image buffers and API tokens are never cached in browser disk caches.

---

## 2. Component Architecture Diagram

```mermaid
flowchart TB
    subgraph ClientHost["Host Operating System (Linux / macOS / Windows)"]
        direction TB

        subgraph WebViewContainer["Tauri v2 Native Window (100vw × 100vh Zero-Scroll)"]
            direction TB
            UI["Neo-Brutalist Studio Shell\n• AppShell & Collapsible Sidebar\n• Studio Quad Canvas (2×2 Matrix)\n• Branching Timeline (de #X ➔)\n• Dual-Mode Prompt Editor"]
            RAM["Volatile React RAM State\n🔑 Google Gemini API Key (useState)"]
            Bridge["Universal IPC Bridge (tauriBridge.ts)\n• Native Tauri IPC: invoke('db_*', ...)\n• Dev Fallback: fetch('/api/db?action=...')"]
        end

        subgraph RustCore["Tauri v2 Core Engine (Rust)"]
            direction TB
            IPC["IPC Dispatcher (src/lib.rs)"]
            DB["rusqlite Database Manager (src/db.rs)\nPRAGMA journal_mode = WAL"]
            Storage["OS Filesystem Manager (src/storage.rs)"]
            Copilot["Prompt Diagnosis & Heuristics (src/copilot.rs)"]
        end

        subgraph LocalDisk["Workstation Disk Storage"]
            SQLiteFile[("SQLite 3 Database\n~/.local/share/com.nanobanana.studio/nanobanana.sqlite3\nTables: users, conversations, turns, app_vault")]
            ProjectFolders[("Project Pictures Root\n~/Pictures/nanobanana/<project-name>/\n• turn-<id>.png\n• turn-<id>-var-<idx>.png")]
        end
    end

    subgraph GoogleCloud["Google AI Cloud Services (Direct Client HTTPS)"]
        GeminiFlash["gemini-2.5-flash\n• Concept Scene Analysis\n• 3 Dynamic Directional Emphases"]
        GeminiImage["gemini-2.5-flash-image\n• 4× Parallel Quad Image Generation\n• Multimodal Surgical Delta Refinement"]
    end

    UI -->|"1. User enters idea"| RAM
    RAM ===>|"2. Direct HTTPS call (AIza... in RAM)"| GeminiFlash
    GeminiFlash ===>|"3. Returns 3 prompt emphases"| UI
    RAM ===>|"4. Parallel render (4× HTTPS calls)"| GeminiImage
    GeminiImage ===>|"5. Returns 4 image buffers"| UI

    UI -->|"6. Save turn & variants"| Bridge
    Bridge --> IPC
    IPC --> DB
    IPC --> Storage
    IPC --> Copilot
    DB --> SQLiteFile
    Storage --> ProjectFolders
```

---

## 3. Universal Bridge & Development Abstraction

To ensure fluid development velocity without requiring full Rust compilation during every CSS or React component change, the platform implements a **Universal Bridge** ([`frontend/src/core/tauri/tauriBridge.ts`](file:///usr/local/google/home/vieiravitor/workspace/opensource/nanobanana-inspiration/frontend/src/core/tauri/tauriBridge.ts)):

```mermaid
flowchart LR
    Caller["Frontend Service / Component"] --> Bridge["tauriBridge.ts"]

    Bridge --> Check{"window.__TAURI_INTERNALS__\npresent?"}
    
    Check -->|YES (Desktop App)| Native["Tauri Core IPC\n@tauri-apps/api/core.invoke()"]
    Check -->|NO (Web Dev)| DevRoute["Node.js 22 SQLite Route\nfetch('/api/db?action=...')"]

    Native --> Rusqlite["rusqlite (Rust)"]
    DevRoute --> NodeSqlite["node:sqlite (Next.js Node)"]
```

Both paths enforce identical relational schemas, foreign key cascades, and directory creation semantics.

---

## 4. State & Data Flow Invariants

1. **Zero Base64 in Database**: SQLite stores exclusively metadata, prompt texts, and file paths (`image_path`). Raw image binary data is written directly to disk (`~/Pictures/nanobanana/`), keeping database size minimal and queries instantaneous.
2. **Non-Destructive Lineage**: Every turn stores `parent_turn_number`. Returning to an earlier turn does not mutate prior records; it seeds the editor for a new child branch.
3. **Filesystem Synchronization**: Renaming a project in the application UI invokes `db_rename_project`, which updates both SQLite and renames the physical directory on disk (`~/Pictures/nanobanana/<new-name>/`), updating all stored image paths atomically.
