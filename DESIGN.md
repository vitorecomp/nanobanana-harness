---
name: Nano Banana Studio
description: Estúdio desktop e web de direção de arte interativa e geração multi-turno 2×2 com Google Nano Banana
colors:
  rich-black: "#0d1b2a"
  oxford-blue: "#1b263b"
  yinmn-blue: "#415a77"
  silver-lake-blue: "#778da9"
  platinum-alabaster: "#e0e1dd"
  crisp-white: "#ffffff"
  oxford-divider: "rgba(27, 38, 59, 0.24)"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.12rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    letterSpacing: "0.04em"
rounded:
  sm: "10px"
  md: "14px"
  lg: "16px"
  xl: "24px"
  card: "26px"
  canvas: "28px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "20px"
  2xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.oxford-navy}"
    textColor: "{colors.crisp-white}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 18px"
  button-primary-hover:
    backgroundColor: "{colors.jet-black}"
    textColor: "{colors.amber-gold}"
  chip-pill:
    backgroundColor: "{colors.crisp-white}"
    textColor: "{colors.jet-black}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 14px"
  chip-pill-active:
    backgroundColor: "{colors.amber-gold}"
    textColor: "{colors.jet-black}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 14px"
  nav-pill:
    backgroundColor: "{colors.crisp-white}"
    textColor: "{colors.oxford-navy}"
    rounded: "{rounded.pill}"
    height: "38px"
    padding: "0 12px"
  nav-pill-active:
    backgroundColor: "{colors.amber-gold}"
    textColor: "{colors.jet-black}"
    rounded: "{rounded.pill}"
    height: "38px"
    padding: "0 12px"
  card-quad-image:
    backgroundColor: "{colors.crisp-white}"
    textColor: "{colors.jet-black}"
    rounded: "{rounded.xl}"
    padding: "12px 14px"
  card-project:
    backgroundColor: "{colors.crisp-white}"
    textColor: "{colors.jet-black}"
    rounded: "{rounded.card}"
    padding: "14px 16px 16px 16px"
  card-interaction:
    backgroundColor: "{colors.crisp-white}"
    textColor: "{colors.jet-black}"
    rounded: "{rounded.lg}"
    padding: "8px 12px 8px 10px"
  input-field:
    backgroundColor: "{colors.crisp-white}"
    textColor: "{colors.jet-black}"
    rounded: "{rounded.md}"
    height: "42px"
    padding: "0 14px"
---

# Design System: Nano Banana Studio

## Overview

**Creative North Star: "The Oxford & Amber Chamfered Atelier"**

Nano Banana Studio is designed as a tactile, architectural art-direction workstation framed inside a deep Oxford Navy (`#14213d`) desktop shell. Rather than mimicking a generic dark-mode SaaS dashboard or a cluttered node-graph IDE, the interface pairs a recessed Oxford Navy window frame with a Platinum (`#e5e5e5`) drafting canvas and Crisp White (`#ffffff`) 45°-chamfered cards (`clip-path: polygon(...)`) accented in Amber Gold (`#fca311`).

Structural clarity replaces decorative container nesting. Major workspace zones in the Studio—the `224px` vertical branching timeline on the left, the center `2×2` quad-generation grid, and the right `40%` prompt and parameter studio—are separated by crisp Oxford Navy hairline dividers (`1.5px solid rgba(20, 33, 61, 0.22)`) directly on the Platinum surface. Elevated chamfered cards are reserved strictly for the collapsible left navigation sidebar, Gallery project cards, Modifiers category cards, the four generated images in the 2×2 grid, and individual interaction nodes along the branching timeline.

**Key Characteristics:**
- Full-window desktop frame in Oxford Navy (`#14213d`) with custom Tauri titlebar controls, an inline-editable active project pill, and a rounded Platinum (`#e5e5e5`) canvas.
- Fixed full-viewport geometry (`100vw × 100vh`, zero outer page scroll) with a collapsible chamfered sidebar (`204px` expanded / `68px` collapsed) and 3-column Studio split (`224px` vertical branching timeline | `2×2` quad generation grid | `40%` prompt and parameter studio).
- Architectural hairline dividers (`1.5px solid rgba(20, 33, 61, 0.22)`) between workspace sections instead of outer wrapper cards.
- Strictly scoped 45°-chamfered card surfaces (`#ffffff` framed by `#14213d` / `#fca311` polygon borders) reserved for the sidebar, Gallery projects, Modifiers categories, the 4 quad-generation images, and timeline interaction items.
- High-contrast Amber Gold (`#fca311`) signal hierarchy for active states, selection borders, and branch lineage badges, paired with two-step Crimson (`#d62828`) destructive confirmation.

## Colors

### Primary
- **Oxford Navy** (`#14213d`): Serves as the outer desktop shell, primary structural border, primary pill button fill, and secondary typography ink.
- **Jet Black** (`#000000`): High-contrast primary display/title ink and active hover accent border.

### Secondary
- **Amber Gold** (`#fca311`): Highlights active navigation items, selected quad card rings (`3px`), active parameter and category filter chips, numeric count badges, and origin-turn highlights in the timeline.

### Neutral & Semantic
- **Platinum Canvas** (`#e5e5e5`): Primary interior workspace canvas across Studio, Gallery, and Modifiers views.
- **Crisp White** (`#ffffff`): Surface fill for chamfered cards, text inputs, and floating action overlays.
- **Oxford Structural Divider** (`rgba(20, 33, 61, 0.22)`): Hairline `1.5px` dividers separating workspace columns and sections.
- **Crimson Confirmation** (`#d62828`): Reserved for two-step destructive confirmation buttons (`Confirm Remove?` / `Confirm Delete?`).

## Typography

**Display & Body Font:** Plus Jakarta Sans (with `-apple-system, BlinkMacSystemFont, sans-serif` fallback)
**Label/Mono Font:** JetBrains Mono and Plus Jakarta Sans for uppercase UI labels

### Hierarchy
- **Display** (`600` weight, `1.6rem`, `1.1` line-height, `-0.03em` letter-spacing): Numeric telemetry readouts and primary focal counters (`font-variant-numeric: tabular-nums`).
- **Headline** (`800` weight, `0.92rem`, `1.15` line-height, `-0.02em` letter-spacing): Sidebar brand header (`Nano Banana // Atelier Studio`).
- **Title** (`700`–`800` weight, `0.86rem`–`1.05rem`, `1.2` line-height, `-0.02em` letter-spacing): Project titles in Gallery cards, quad slot titles, and category headers.
- **Body** (`500` weight, `0.8rem`, `1.4` line-height): Prompt editor textarea, lightbox prompt inspection copy, and card prompt descriptions.
- **Label** (`700` weight, `0.7rem`–`0.72rem`, `0.04em` letter-spacing, uppercase): Section headers (`TIMELINE`, `LATEST PROJECT`, `VISUAL DIRECTION LIBRARY`) and parameter group titles.

### Named Rules
**The Tabular Telemetry Rule.** All turn numbers (`#1`, `#2`), aspect ratio labels (`1:1`, `16:9`), and counter badges enforce `font-variant-numeric: tabular-nums` so layout width never jitters across iterations.

## Layout

The application operates as a fixed full-viewport desktop environment (`100vw × 100vh`, `overflow: hidden`) wrapped inside `.ref-desktop-shell` (`padding: 0 10px 10px 10px` over `#14213d`). Below `.ref-window-titlebar` (`36px` height), `.ref-canvas-surface` (`border-radius: 20px`, `padding: 14px 18px`, `gap: 16px`) houses the collapsible `.ref-sidebar` and `.ref-workspace-main`:

1. **Studio (`/` and `/create` — `.ref-studio-columns-layout`)**:
   - **Left Column (`224px` — `.ref-studio-side-timeline`)**: Vertically scrollable branching interaction timeline separated by a right `1.5px solid rgba(20, 33, 61, 0.22)` divider.
   - **Center Column (`1.38fr` — `.ref-studio-left-images-60`)**: Renders the `2×2` quad image grid (`grid-template-columns: repeat(2, minmax(0, 1fr))`, `gap: 14px`) with top-right floating inspect/download overlays (`⤢`, `↓`) and bottom workflow actions (`Select`, `⚡ Delta`, `🧬 Pin DNA`).
   - **Right Column (`minmax(320px, 0.92fr)` — `.ref-studio-right-params-40`)**: Stacks the dual-mode Prompt Editor (`✦ Compose Scene` / `⚡ Surgical Delta`) and the `2×2 Matrix & Parameters` panel separated by a horizontal `1.5px solid rgba(20, 33, 61, 0.22)` divider.
2. **Gallery (`/gallery` — `.ref-studio-three-part-layout`)**:
   - **Top 15% Bar (`.ref-studio-top-interactions`)**: Houses the `Latest Project` quick-resume card, search bar with live status toast slot, and category filter pills.
   - **Bottom 85% Grid (`.ref-projects-cards-grid`)**: Responsive grid of chamfered project cards (`grid-template-columns: repeat(auto-fill, minmax(290px, 1fr))`, `gap: 20px`).
3. **Modifiers (`/modifiers` — `.ref-modifiers-split-layout`)**:
   - **Left 60% Panel**: Chamfered search/filter bar + 2-column grid of category cards.
   - **Right 40% Panel**: Gemini AI category/modifier generator + manual category/modifier creation forms.

## Motion & Choreography

- **Focal Moment (`cubic-bezier(0.16, 1, 0.3, 1)`)**:
  - **Directional Pipeline Signal (`refFlowSignalPulse`)**: Active and selected flow wires emit a directional SVG signal pulse (`stroke-dasharray: 6 10`) tracing `01 Thinking → 02 Drafts → 03 Refining → 04 Result`.
  - **Stage-Staggered Card Settle (`refFlowCardSettle`, `260ms`)**: Pipeline step cards settle into place with subtle sibling stagger (`0ms`, `45ms`, `90ms`, `135ms`).
  - **Critic Rubric Bar Reveal (`refRubricScaleReveal`, `420ms`)**: Rubric evaluation bars scale smoothly from `scaleX(0)` to `scaleX(1)` (`transform-origin: left center`).
- **Spatial Continuity (`320ms`)**:
  - Programmatic camera transitions (**Organize**, **Fit**, **Zoom Presets**, and **Iteration Focus**) glide smoothly via `.is-camera-gliding`, while manual drag/wheel panning bypasses transitions for zero-latency manipulation.
  - Floating Inspector and Parameters modals enter with a `220ms cubic-bezier(0.16, 1, 0.3, 1)` scale-and-rise choreography.
- **Reduced Motion (`@media (prefers-reduced-motion: reduce)`)**:
  - Disables spatial transforms, camera glides, and continuous signal loops while preserving instant opacity and color state feedback.

## Do's and Don'ts

### Do:
- **Do** restrict colors to the Oxford & Amber Atelier palette (`#14213d`, `#fca311`, `#e5e5e5`, `#ffffff`, `#000000`, plus `#d62828` for two-step destructive confirmation).
- **Do** separate major workspace zones using `1.5px solid rgba(20, 33, 61, 0.22)` structural dividers directly on the `#e5e5e5` canvas.
- **Do** preserve the `100vw × 100vh` zero-scroll outer desktop viewport constraint while keeping slim `5px` scrollbars on internal scrollable strips.

### Don't:
- **Don't** force-switch between `✦ Compose Scene` and `⚡ Surgical Delta` without explicit user intent, or execute hidden prompts when `deltaInput` is empty.
- **Don't** execute destructive deletes (Gallery projects or Modifier categories) on a single unconfirmed click.
- **Don't** populate new projects with mocked images; empty slots in the 2×2 grid must render honest blueprint states until generation begins.
