# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

1. **Illustrators, Concept Artists, and Art Directors**:
   - Creators who refine scenes and multi-asset game/illustration packs iteratively with strict control over framing, lighting, style, character DNA, and rubric quality, comparing parallel candidates on an infinite flow canvas and evolving from the strongest frame of every round.
2. **Local-First Desktop & Web Creators**:
   - Users running their own Google Gemini API key (`AIza...`) in an installable **Tauri v2** desktop workstation or local Next.js server, backed by **SQLite** metadata persistence and `.png` files saved directly in the native OS filesystem without cloud buckets or external containers.

## Product Purpose

**Nano Banana Studio** (`NANO BANANA // ATELIER STUDIO`) is an interactive desktop and web art-direction workstation (`Tauri v2` + `Next.js 15` + `SQLite`) powered by **Google Nano Banana (`gemini-2.5-flash-image`)** and **Gemini (`gemini-2.5-flash`)**.

It replaces single-shot static prompting with two complementary local-first creation engines:
- **Studio Flow (`/` and `/create`)**: An immutable, branching node-graph canvas where each step generates `1..8` parallel scene interpretations (with optional AI prompt enhancement, AI variation synthesis, reference-image anchoring, preservation locks, and Canonical Character DNA) connected by collision-free orthogonal wires.
- **Goal-Driven Agent Harness (`/harness`)**: An autonomous and co-pilot 4-stage pipeline (`01 Thinking` Planner → `02 Drafts` Generator → `03 Refining` Critic & TRACE Attribution → `04 Result` Pairwise Gate) that decomposes visual goals into deliverables and weighted rubrics and iterates until target scores converge.
- **Unified Projects Gallery (`/gallery`) & Visual Direction Library (`/modifiers`)**: Instant filtering across Studio projects and Goal Harness missions plus reusable camera, lighting, wardrobe, and lens modifier sweeps.

## Positioning

Unlike linear text-to-image chat tools, **Nano Banana Studio** combines:
1. **Immutable Branching Flow Canvas**: Every Studio turn and Goal Harness round is preserved as an inspectable canvas card (`parent_turn_number` lineage), allowing non-destructive branching from any variation.
2. **Rubric-Scored TRACE Evolution**: The Goal Harness evaluates generated candidates against explicit weighted criteria, diagnoses failure modes (`PROMPT_SPECIFICATION`, `REFERENCE_ROUTING`, `MODEL_PARAMETERS`), and promotes challengers only when they beat the incumbent.
3. **Local-First Ownership (SQLite + Native Filesystem)**: SQLite stores lightweight metadata, prompts, and file paths (`image_path`), while full-resolution `.png` files live directly in `~/Pictures/nanobanana/<project-name>/` and remain preserved on disk even if a project is removed from the Gallery.

## Operating Context

- **Full-Viewport Desktop Frame (`100vw × 100vh`, Zero Outer Scroll) with Adaptive Tablet/Mobile Reflow**:
  - Framed by a Rich Ink (`#0d1b2a`) window shell with custom Tauri titlebar controls, a collapsible left navigation rail (`204px` expanded / `68px` collapsed, with a bottom `Collapse` toggle button; adapts to a compact bottom navigation bar below `768px`), and a Warm Alabaster (`#e0e1dd`) workspace canvas.
  - **Studio (`/` and `/create`)**: Full-bleed dotted pan/zoom Flow Canvas with a single-row floating top bar (inline-editable project title on the left; `Auto-Organize`, `Fit View`, `Zoom`, and `+ New Step` on the right) and a 3-step creation wizard dialog.
  - **Goal Harness (`/harness`)**: Split Flow Canvas on the left (`Thinking → Drafts → Refining → Result` columns per deliverable) and a `384px` Iteration & Refinement console dock on the right (stacking vertically below `960px`).
  - **Gallery (`/gallery`)**: Compact left-aligned search bar + `[All] [Studio] [Goal Harness]` filter buttons above a responsive grid of aligned project and mission cards with white boxed `Open` and `Remove` actions on the bottom right.
  - **Modifiers (`/modifiers`)**: Left `62%` Visual Direction Library category cards + right `38%` AI Generator and manual category/modifier editor.

## Capabilities and Constraints

- **Models**:
  - `gemini-2.5-flash` for scene enhancement, `1 + N` prompt variation synthesis, Goal Harness planning, rubric critique, and TRACE refinement.
  - `gemini-2.5-flash-image` for parallel image generation and multimodal reference-anchored refinement.
- **Filesystem Image Storage**:
  - Default folder: `~/Pictures/nanobanana/<project-name>/` (configurable in `Settings` via `images_output_dir` in `app_vault`).
  - Raw base64 payloads are never stored in SQLite; local files stream via `/api/image?path=...`.
- **SQLite Persistence (`~/.local/share/com.nanobanana.studio/nanobanana.sqlite3`)**:
  - Tables: `users`, `conversations`, `conversation_turns`, `harness_missions`, and `app_vault`.
- **Zero-Storage API Key Security (`AIza...`)**:
  - Held in volatile React RAM (`useState`) and never written to `localStorage`, `sessionStorage`, cookies, or URLs; persisted exclusively to local SQLite `app_vault` when the user enables *"Remember in Local App Vault"*.

## Brand Commitments

- **Identity**: **Nano Banana Studio** (`NANO BANANA // ATELIER STUDIO`).
- **Interface Language**: English (`en-US`), supporting multilingual user prompts (`pt-BR`, `en-US`, etc.).
- **Binding Visual Commitments**:
  - **5-Step Cool-Slate Neo-Brutalist Atelier Palette**: `#0d1b2a` (Deepest Ink), `#1b263b` (Slate Navy), `#415a77` (Mid Slate), `#778da9` (Steel Blue), and `#e0e1dd` (Warm Alabaster Canvas), paired with `#ffffff` elevated card/button surfaces and `#9e2a2b` two-step destructive confirmation.
  - **Boxed Rounded-Border Controls Only**: Every button, badge, port, and switch uses crisp boxed geometry with rounded borders (`4px`–`14px`), `1.5px solid #0d1b2a` structural strokes, and zero-blur offset shadows (`--ref-shadow-hard-*`)—never circular (`50%`) or stadium capsule (`9999px`) buttons.

## Evidence on Hand

- **Source Routes & Services**:
  - Studio Flow Canvas & 3-Step Creation Wizard: `frontend/src/features/studio/components/InteractiveStudio.tsx` (`/` and `/create`).
  - Goal-Driven Agent Harness: `frontend/src/app/harness/page.tsx` (`/harness`) and `frontend/src/features/harness/services/harnessAgentService.ts`.
  - Unified Gallery: `frontend/src/app/gallery/page.tsx` (`/gallery`).
  - Visual Direction Modifiers: `frontend/src/app/modifiers/page.tsx` (`/modifiers`).
  - Universal Tauri / Dev SQLite Bridge: `frontend/src/core/tauri/tauriBridge.ts`, `frontend/src/app/api/db/route.ts`, and `src-tauri/src/db.rs`.
- **Confirmed Absences (Do Not Fabricate)**:
  - No cloud multi-tenancy, subscription pricing tiers, external marketing testimonials, or PostgreSQL/RustFS dependencies.

## Product Principles

1. **Parallel & Rubric-Guided Exploration over Blind Retries**: Offer simultaneous visual variations in Studio and structured Critic/TRACE evolution in Goal Harness.
2. **Real File Ownership (Filesystem-First)**: Generated `.png` files belong directly to the user's OS folder and survive Gallery cleanups.
3. **Non-Destructive Lineage**: Every step records its parent origin so creators can branch freely without overwriting prior work.
4. **Focused Zero-Scroll Workstation**: Keep outer desktop chrome locked to `100vw × 100vh` while adapting cleanly to touch pointers and narrow viewports.
