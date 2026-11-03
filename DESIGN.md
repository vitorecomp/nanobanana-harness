---
name: Nano Banana Studio
description: Estúdio desktop e web de direção de arte interativa e geração multi-turno 2×2 com Google Nano Banana
colors:
  jet-black: "#000000"
  oxford-navy: "#14213d"
  amber-gold: "#fca311"
  platinum-canvas: "#e5e5e5"
  crisp-white: "#ffffff"
  oxford-ink-muted: "rgba(20, 33, 61, 0.62)"
  oxford-divider: "rgba(20, 33, 61, 0.22)"
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
    backgroundColor: "{colors.prussian-ink}"
    textColor: "{colors.warm-parchment}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 18px"
  button-primary-hover:
    backgroundColor: "{colors.crimson-vermilion}"
    textColor: "#FFFFFF"
  chip-pill:
    backgroundColor: "rgba(255, 255, 255, 0.45)"
    textColor: "{colors.prussian-ink}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 14px"
  chip-pill-active:
    backgroundColor: "{colors.solar-amber}"
    textColor: "{colors.prussian-ink}"
    rounded: "{rounded.pill}"
    height: "36px"
    padding: "0 14px"
  nav-pill:
    backgroundColor: "rgba(234, 226, 183, 0.16)"
    textColor: "{colors.warm-parchment}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 14px"
  nav-pill-active:
    backgroundColor: "{colors.solar-amber}"
    textColor: "{colors.prussian-ink}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 14px"
  card-quad-image:
    backgroundColor: "{colors.ivory-card-surface}"
    textColor: "{colors.prussian-ink}"
    rounded: "{rounded.xl}"
    padding: "12px 14px"
  card-project:
    backgroundColor: "{colors.ivory-card-surface}"
    textColor: "{colors.prussian-ink}"
    rounded: "{rounded.card}"
    padding: "18px 20px"
  card-interaction:
    backgroundColor: "{colors.ivory-card-surface}"
    textColor: "{colors.prussian-ink}"
    rounded: "{rounded.lg}"
    padding: "6px 12px 6px 8px"
  input-field:
    backgroundColor: "{colors.ivory-card-elevated}"
    textColor: "{colors.prussian-ink}"
    rounded: "{rounded.md}"
    height: "42px"
    padding: "0 14px"
  bottom-scrubber-dock:
    backgroundColor: "{colors.parchment-dock}"
    textColor: "{colors.prussian-ink}"
    rounded: "{rounded.pill}"
    height: "56px"
    padding: "6px 14px"
---

# Design System: Nano Banana Studio

## Overview

**Creative North Star: "The Warm Prussian Atelier"**

Nano Banana Studio is designed as a tactile, sunlit art-direction workstation framed inside a deep Prussian-blue architectural shell. Rather than mimicking a generic dark-mode SaaS dashboard or a cluttered node-graph IDE, the interface pairs a recessed Prussian Ink outer bezel with a warm parchment drafting canvas joined by an organic sculpted folder tab and S-curve bridge. Every interaction feels physical, grounded, and deliberate—inviting illustrators and concept artists to compare four simultaneous scene interpretations and trace their creative lineage without visual fatigue.

Structural clarity replaces decorative container nesting. Major workspace zones—the top 15% timeline and filter header, the 60% active quad-generation canvas, and the 40% prompt and parameter studio—are separated by crisp Prussian hairline dividers directly on the parchment surface. Elevated cards are reserved strictly for the artifacts that represent creative output: Gallery projects, the four generated images in the 2×2 grid, and individual interaction nodes along the branching timeline.

The system explicitly rejects nested card-in-card containers, full-page scrollbars, pure #000000 black or washed-out neutral grays, and decorative gradients. All surfaces, borders, and typographic hierarchies derive harmonically from the five-color atelier palette.

**Key Characteristics:**
- Sculpted desktop frame in Prussian Ink (`#003049`) housing a Warm Parchment (`#eae2b7`) canvas with a raised left title tab and smooth S-curve SVG transition.
- Fixed full-viewport geometry (`100vw × 100vh`, zero page scroll) partitioned into a 15% top context bar, an 85% main workspace, and a floating pill dock at the bottom.
- Architectural hairline dividers (`1.5px solid rgba(0, 48, 73, 0.2)`) between workspace sections instead of outer wrapper cards.
- Strictly scoped card surfaces (`#f5f0d5` and `#fbf8e8`) reserved solely for Gallery projects, the 4 quad-generation images, and timeline interaction items.
- Warm solar signal hierarchy using Solar Amber (`#fcbf49`) for active states, Tangerine Signal (`#f77f00`) for branch lineage and focus rings, and Crimson Vermilion (`#d62828`) for primary action hover and destructive confirmation.

## Colors

The palette balances a deep nautical Prussian foundation against sun-warmed parchment surfaces and three graduated solar-to-vermilion signal accents.

### Primary
- **Prussian Ink** (`#003049`): Serves as the outer desktop shell, primary typography ink, active card selection ring (`2px`), and primary pill button fill. Every text element on parchment is anchored in Prussian Ink to guarantee high-contrast editorial legibility.
- **Crimson Vermilion** (`#d62828`): High-energy primary action hover state (`.ref-dark-pill-btn:hover`) and project removal hover accent on Gallery cards.

### Secondary
- **Solar Amber** (`#fcbf49`): Highlights active navigation tabs, active parameter and category filter chips, numeric count badges, and origin-turn halo rings in the timeline.

### Tertiary
- **Tangerine Signal** (`#f77f00`): Marks branching lineage badges (`de #X ➔`), timeline connector arrows, input focus borders, and card hover outlines.

### Neutral
- **Warm Parchment** (`#eae2b7`): Primary interior workspace canvas across Studio and Gallery views, as well as pill badge fills and modal backgrounds.
- **Ivory Cream Surface** (`#f5f0d5`): Default matte surface for the three permitted card types (quad image cards, Gallery project cards, and timeline interaction cards).
- **Elevated Ivory Cream** (`#fbf8e8`): Elevated surface for selected quad image cards, hovered project cards, and text inputs at rest.
- **Parchment Dock** (`#f7f2da`): Floating bottom scrubber and project bar container.
- **Prussian Ink Secondary** (`rgba(0, 48, 73, 0.78)`): Supporting prompt snippets, captions, and secondary labels on parchment.
- **Prussian Ink Muted** (`rgba(0, 48, 73, 0.56)`): Empty-state placeholders and subtle metadata hints.
- **Prussian Structural Divider** (`rgba(0, 48, 73, 0.2)`): Hairline `1.5px` dividers separating the top 15% bar and the 60% / 40% studio split.

### Named Rules
**The Prussian Contrast Rule.** All dark typography, structural borders, and primary button fills use Prussian Ink (`#003049`) or its alpha steps—never pure `#000000` black or untinted gray.
**The Solar Signal Rule.** Solar Amber (`#fcbf49`), Tangerine Signal (`#f77f00`), and Crimson Vermilion (`#d62828`) are reserved for interactive states, lineage badges, and focal CTAs; they must never flood large background zones.

## Typography

**Display Font:** Plus Jakarta Sans (with `-apple-system, BlinkMacSystemFont, sans-serif` fallback)
**Body Font:** Plus Jakarta Sans (with `-apple-system, BlinkMacSystemFont, sans-serif` fallback)
**Label/Mono Font:** JetBrains Mono (available for technical paths and tabular telemetry) and Plus Jakarta Sans for uppercase UI labels

**Character:** Clean geometric humanist sans-serif set with tight negative tracking on titles and crisp medium-to-bold weights (`500`–`800`) that stay legible at compact desktop densities on warm parchment.

### Hierarchy
- **Display** (`600` weight, `1.6rem`, `1.1` line-height, `-0.03em` letter-spacing): Numeric telemetry readouts and primary focal counters (`font-variant-numeric: tabular-nums`).
- **Headline** (`500` weight, `1.12rem`, `1.1` line-height, `-0.025em` letter-spacing): Sculpted top-left folder tab brand title (`NANOBANANA // STUDIO`).
- **Title** (`700` weight, `1.05rem`, `1.2` line-height, `-0.02em` letter-spacing): Project titles in Gallery cards and active project header inputs.
- **Body** (`500` weight, `0.8rem`, `1.4` line-height): Prompt editor textarea, lightbox prompt inspection copy, and card prompt descriptions (clamped to 2–3 lines in cards).
- **Label** (`700` weight, `0.72rem`, `0.04em` letter-spacing, uppercase): Section headers (`INTERAÇÕES DO PROJETO`, `ÚLTIMO PROJETO TRABALHADO`), variant badges (`Variação 1..4`), and parameter group titles.

### Named Rules
**The Tabular Telemetry Rule.** All turn numbers (`#1`, `#2`), aspect ratio labels (`1:1`, `16:9`), and counter badges enforce `font-variant-numeric: tabular-nums` so layout width never jitters across iterations.

## Layout

The application operates as a fixed full-viewport desktop environment (`100vw × 100vh`, `overflow: hidden`) wrapped inside `.ref-desktop-shell` (`padding: 6px 12px 12px 12px` over `#003049`). Inside the raised folder-tab header (`.ref-folder-topbar`, `42px` height), the main rounded canvas (`.ref-canvas-surface`, `padding: 20px 28px 16px 28px`, `gap: 16px`) divides every screen into three vertical regions:

1. **Top 15% Context Bar (`.ref-studio-top-interactions`)**: Fixed at `15%` height (`min-height: 68px`, `max-height: 110px`), separated from the workspace below by a bottom `1.5px solid rgba(0, 48, 73, 0.2)` divider.
   - In the **Studio**, it houses the horizontally scrollable branching interaction timeline.
   - In the **Gallery**, it houses the Last Worked Project card (`min-width: 240px`), the rounded search bar (`max-width: 380px`), and the horizontal strip of category filter pills.
2. **Center 85% Workspace**:
   - In the **Studio (`.ref-studio-bottom-split`)**, a `60fr 40fr` CSS Grid split separated by a vertical `1.5px solid rgba(0, 48, 73, 0.2)` divider (`padding-right: 18px` on the left, `padding-left: 18px` on the right). The left `60%` renders the `2×2` quad image grid (`grid-template-columns: repeat(2, minmax(0, 1fr))`, `gap: 14px`); the right `40%` stacks the Prompt Editor and Parameters sections separated by a horizontal `1.5px solid rgba(0, 48, 73, 0.2)` divider.
   - In the **Gallery (`.ref-projects-cards-grid`)**, an auto-filling responsive card grid (`grid-template-columns: repeat(auto-fill, minmax(290px, 1fr))`, `gap: 20px`).
3. **Bottom Floating Pill Bar (`.ref-bottom-scrubber-bar`)**: Fixed `56px` height capsule (`padding: 6px 14px`) anchoring the editable current Project Name pill on the left and the `+ Novo Projeto` primary action button on the right.

### Named Rules
**The Zero-Scroll Viewport Rule.** The outer document (`html, body`) and `.ref-desktop-shell` are strictly locked to `100vw × 100vh` with `overflow: hidden`. Only dedicated internal strips (timeline history, Gallery card grid, or compact parameter groups) may scroll internally when content exceeds viewport bounds.
**The Structural Divider Rule.** Workspace regions are separated exclusively by `1.5px solid rgba(0, 48, 73, 0.2)` borders on the Warm Parchment canvas. Never wrap the top 15% bar, the 60% image zone, or the 40% parameter panel in an outer card container.

## Elevation & Depth

Nano Banana Studio uses a flat-by-default architectural hierarchy where structural dividers organize the canvas and soft ambient shadows are reserved exclusively for the three interactive card types, the floating bottom dock, and modal overlays.

### Shadow Vocabulary
- **Quad & Interaction Card Rest** (`box-shadow: 0 4px 16px rgba(0, 48, 73, 0.05)`): Subtle lift separating the 4 generated image cards from the Warm Parchment canvas.
- **Selected Quad Card Ring** (`box-shadow: 0 0 0 2px #003049, 0 8px 22px rgba(0, 48, 73, 0.12)`): High-confidence selection lock combining a `2px` Prussian Ink structural ring with deeper ambient lift.
- **Gallery Project Card Rest & Hover** (`box-shadow: 0 6px 20px rgba(0, 48, 73, 0.06)` at rest; `0 10px 28px rgba(0, 48, 73, 0.12)` with `transform: translateY(-2px)` on hover): Tactile elevation for browsable project archives.
- **Floating Bottom Scrubber Dock** (`box-shadow: 0 6px 22px rgba(24, 26, 23, 0.05)`): Anchors the bottom project bar slightly above the parchment floor.
- **Modal & Lightbox Overlay** (`box-shadow: 0 24px 60px rgba(0, 48, 73, 0.35)` over `backdrop-filter: blur(8px)` and `rgba(0, 48, 73, 0.68)`): Deep theatrical focus for the Lightbox and API Key / Folder Configuration modal.

### Named Rules
**The Scoped Elevation Rule.** Only Gallery project cards, the 4 quad-generation cards, timeline interaction cards, the bottom pill dock, and modals carry background fills or shadows; all surrounding layout sections remain flat and transparent on `#eae2b7`.

## Shapes

The form language pairs diagonal chamfered card geometry with pill-shaped controls and crisp hairline dividers:
- **Outer Canvas & Modals (`28px` radius)**: `.ref-canvas-surface`, `.ref-modal-card`, and `.ref-lightbox-card` use `28px` corners (with `border-top-left-radius: 0` on the main canvas where it meets the raised `20px` top-left title tab and S-curve SVG bridge).
- **Chamfered & Rounded Cards (`22px` 45° top-left/bottom-right chamfers + `13px` top-right/bottom-left radius)**: `.ref-quad-image-card`, `.ref-project-card`, and `.ref-interaction-history-item` (`12px` chamfer) use a double-layer `::before` / `::after` `clip-path: polygon(...)` combined with `border-top-right-radius: 13px` and `border-bottom-left-radius: 13px`, framing a top rounded artwork box (`13px`–`14px` radius), middle metadata + dot indicators (`.ref-mura-dots`), and bottom solid/outlined action pills.
- **Inputs & Textareas (`14px` radius)**: Rounded rectangular fields with `1px`–`1.5px` Prussian Ink alpha borders that shift to Tangerine Signal (`#f77f00`) on focus.
- **Pills & Action Buttons (`999px` radius)**: All buttons, navigation links, style/modifier chips, lineage tags, and the bottom scrubber dock use full capsule geometry.

## Components

### Buttons
Tactile capsule buttons with immediate color-shift feedback.
- **Shape:** Full pill (`border-radius: 999px`), `40px` height for primary actions (`.ref-dark-pill-btn`), `30px` diameter for circular icon actions (`.ref-card-expand-circle`).
- **Primary (`.ref-dark-pill-btn`):** Prussian Ink (`#003049`) background with Warm Parchment (`#eae2b7`) text, `600` weight, `0.8rem` font size, `padding: 0 18px`.
- **Hover / Focus:** Primary buttons shift background to Crimson Vermilion (`#d62828`) with `#FFFFFF` text. Circular card action buttons (`⤢` expand / `✕` delete) shift from `#eae2b7` to Tangerine Signal (`#f77f00`) on quad cards or Crimson Vermilion (`#d62828`) on Gallery delete buttons with `transform: scale(1.05)`.

### Chips
Compact capsule selectors used for style presets, aspect ratios, scene modifiers, and visual reference toggles.
- **Style (`.ref-pill-chip`):** `36px` height, `padding: 0 14px`, `border-radius: 999px`, `1px solid rgba(0, 48, 73, 0.16)`, semi-translucent ivory fill (`rgba(255, 255, 255, 0.45)`), Prussian Ink text (`0.78rem`, `500` weight).
- **State:** Hover tints background with Solar Amber (`rgba(252, 191, 73, 0.35)`) and border with Tangerine Signal (`#f77f00`). Active state (`.ref-pill-chip.active`) locks to solid Solar Amber (`#fcbf49`) fill, Tangerine Signal (`#f77f00`) border, and bold (`700`) Prussian Ink text.

### Cards / Containers
Strictly limited to the three artifact card types.
- **Corner Style:** `24px` on Studio quad image cards (`.ref-quad-image-card`), `26px` on Gallery project cards (`.ref-project-card`), and `16px` on timeline interaction items (`.ref-interaction-history-item`).
- **Background:** Ivory Cream Surface (`#f5f0d5`) at rest; Elevated Ivory Cream (`#fbf8e8`) when hovered or selected.
- **Shadow Strategy:** Subtle ambient shadow at rest (`0 4px 16px rgba(0, 48, 73, 0.05)`), upgrading to a `2px` solid `#003049` ring on active selection or a `2px` `#fcbf49` halo with `#f77f00` border on origin-turn highlights (`.origin-highlight`).
- **Border:** `1.5px solid rgba(0, 48, 73, 0.15)` at rest; `#f77f00` on hover; `#003049` when selected.
- **Internal Padding:** `12px 14px` for quad image cards, `18px 20px` for Gallery project cards, and `6px 12px 6px 8px` for timeline interaction cards.

### Inputs / Fields
High-legibility ivory fields that brighten to pure white when focused.
- **Style (`.ref-input`, `.ref-params-textarea`):** `14px` border radius (`999px` for `.ref-gallery-search-input`), `1.5px solid rgba(0, 48, 73, 0.2)`, Elevated Ivory (`#fbf8e8`) background, Prussian Ink text (`0.8rem`–`0.84rem`).
- **Focus:** Border transitions to Tangerine Signal (`#f77f00`) and background shifts to `#FFFFFF`.

### Navigation
Anchored in the collapsible left Prussian Ink sidebar (`.ref-sidebar`, `194px` expanded / `64px` collapsed).
- **Style (`.ref-sidebar-nav-item`):** `40px` height rounded rectangular item (`border-radius: 12px`), `padding: 0 12px`, `1px solid rgba(234, 226, 183, 0.18)`, translucent parchment fill (`rgba(234, 226, 183, 0.08)`), Warm Parchment (`#eae2b7`) text (`0.82rem`, `600` weight).
- **Hover / Active:** Hover shifts border to Tangerine Signal (`#f77f00`) and text to Solar Amber (`#fcbf49`). Active route (`.ref-sidebar-nav-item.active`) fills with solid Solar Amber (`#fcbf49`) and extra-bold (`800`) Prussian Ink (`#003049`) text.
- **Footer Status & Config (`.ref-sidebar-footer`):** Displays live Gemini API Key status dot (`#fcbf49` active / `#d62828` missing), active filesystem output path (`~/Pictures/nanobanana`), and the `Configurações` modal trigger.

### Sculpted Folder-Tab Shell & Branching Timeline
The signature structural framing and lineage strip of Nano Banana Studio.
- **Sculpted Folder Tab (`.ref-raised-title-tab` + `.ref-tab-scurve-svg`):** A `40px`-tall Warm Parchment tab (`border-top-left-radius: 20px`) joined seamlessly to the main canvas via a `52×40px` cubic-bezier SVG bridge (`M0,0 C22,0 26,40 52,40 L0,40 Z`).
- **Branching Lineage Connectors (`.ref-interaction-arrow-connector`, `.ref-interaction-branch-badge`):** Sequential turns display a Prussian Ink arrow (`➔`), while non-linear branches display a Tangerine Signal (`#f77f00`) pill badge (`de #X ➔`) and highlight their parent turn card with a Solar Amber halo (`.origin-highlight`).

## Do's and Don'ts

### Do:
- **Do** restrict all colors strictly to the five-color Warm Prussian Atelier palette (`#003049`, `#d62828`, `#f77f00`, `#fcbf49`, `#eae2b7`) and its direct ivory/alpha derivatives (`#f5f0d5`, `#fbf8e8`, `#f7f2da`).
- **Do** separate major workspace zones (top 15% bar, left 60% quad grid, right 40% prompt/parameters) using `1.5px solid rgba(0, 48, 73, 0.2)` structural dividers directly on the `#eae2b7` canvas.
- **Do** reserve card containers exclusively for Gallery projects (`.ref-project-card`), the 4 generated quad images (`.ref-quad-image-card`), and timeline interaction nodes (`.ref-interaction-history-item`).
- **Do** maintain the `100vw × 100vh` zero-scroll desktop viewport constraint across all routes.

### Don't:
- **Don't** wrap the top 15% bar, the 60% image area, or the 40% parameter column in outer card boxes or nested container backgrounds.
- **Don't** introduce pure `#000000` black, untinted neutral grays, or legacy neon lime (`#F2FA3C` / `#ECFF3B`) into text, borders, or badges.
- **Don't** populate new projects with placeholder or mocked images; empty slots in the 2×2 grid must render honest empty states until the user triggers generation.
- **Don't** allow full-page vertical or horizontal scrollbars on `html`, `body`, or `.ref-desktop-shell`.
