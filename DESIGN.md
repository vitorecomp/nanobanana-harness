---
name: Nano Banana Studio
description: Local-first Cool-Slate Neo-Brutalist Flow Atelier for multi-turn Nano Banana image creation and rubric-driven Goal Harness evolution
colors:
  atelier-ink: "#0d1b2a"
  atelier-navy: "#1b263b"
  atelier-slate: "#415a77"
  atelier-steel: "#778da9"
  atelier-canvas: "#e0e1dd"
  atelier-surface: "#f7f8f6"
  atelier-white: "#ffffff"
  atelier-danger: "#9e2a2b"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 500
    lineHeight: 1.45
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.atelier-navy}"
    textColor: "{colors.atelier-white}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.atelier-ink}"
    textColor: "{colors.atelier-white}"
  button-outline:
    backgroundColor: "{colors.atelier-white}"
    textColor: "{colors.atelier-ink}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 12px"
  button-outline-hover:
    backgroundColor: "{colors.atelier-canvas}"
    textColor: "{colors.atelier-ink}"
  chip-box:
    backgroundColor: "{colors.atelier-white}"
    textColor: "{colors.atelier-navy}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 12px"
  chip-box-active:
    backgroundColor: "{colors.atelier-steel}"
    textColor: "{colors.atelier-ink}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 12px"
  nav-item:
    backgroundColor: "{colors.atelier-white}"
    textColor: "{colors.atelier-navy}"
    rounded: "{rounded.md}"
    height: "38px"
    padding: "0 12px"
  nav-item-active:
    backgroundColor: "{colors.atelier-steel}"
    textColor: "{colors.atelier-ink}"
    rounded: "{rounded.md}"
    height: "38px"
    padding: "0 12px"
  card-flow-node:
    backgroundColor: "{colors.atelier-white}"
    textColor: "{colors.atelier-ink}"
    rounded: "{rounded.lg}"
    padding: "12px"
  card-project:
    backgroundColor: "{colors.atelier-white}"
    textColor: "{colors.atelier-ink}"
    rounded: "{rounded.lg}"
    padding: "12px 16px 16px 16px"
  input-field:
    backgroundColor: "{colors.atelier-white}"
    textColor: "{colors.atelier-ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
---

# Design System: Nano Banana Studio

## Overview

**Creative North Star: "The Cool-Slate Neo-Brutalist Flow Atelier"**

Nano Banana Studio is designed as a tactile, architectural drafting table framed inside a Deepest Ink (`#0d1b2a`) desktop shell. Rather than defaulting to generic dark-card SaaS chrome or soft-blurred glassmorphism, the interface pairs a Warm Alabaster (`#e0e1dd`) drafting canvas with Crisp White (`#ffffff`) rounded-box cards anchored by `1.5px solid #0d1b2a` structural borders and crisp zero-blur offset shadows (`3px 4px 0 #0d1b2a` to `6px 8px 0 #0d1b2a`).

Every interactive element—navigation items, toolbar controls, canvas branch ports, filter chips, and card actions—follows a unified **boxed rounded-border language** (`4px`–`16px`), explicitly rejecting circular (`50%`) and stadium capsule (`9999px`) pills. Across both the Studio Flow Canvas (`/create`) and the 4-stage Goal Harness (`/harness`), orthogonal SVG wires with directional signal pulses trace creative lineage directly across the dotted alabaster plane.

**Key Characteristics:**
- Full-viewport desktop shell (`100vw × 100vh`, zero outer scroll) in Deepest Ink (`#0d1b2a`) framing a rounded Warm Alabaster (`#e0e1dd`) canvas, adapting below `768px` into a full-width workspace with a bottom navigation rail.
- Strict 5-step Cool-Slate Atelier palette (`#0d1b2a`, `#1b263b`, `#415a77`, `#778da9`, `#e0e1dd`) plus `#ffffff` elevated surfaces and `#9e2a2b` two-step destructive confirmation.
- Tactile Neo-Brutalist depth via zero-blur bottom-right offset shadows (`--ref-shadow-hard-*`) paired with `1.5px` ink borders.
- Strictly boxed controls with rounded corners (`4px`–`14px`)—never circular icon buttons or `9999px` stadium pills.
- Self-hosted `Plus Jakarta Sans` and `JetBrains Mono` typography enforcing a strict `12px` (`0.75rem`) legibility floor and `tabular-nums` telemetry alignment.

## Colors

The palette is a disciplined 5-step architectural cool-slate ramp balanced against a warm alabaster drafting surface so generated artwork retains accurate perceptual color balance without chromatic cast.

### Primary
- **Deepest Ink** (`#0d1b2a`): Outer Tauri window frame, primary structural borders (`1.5px`), zero-blur hard offset shadows, and highest-emphasis headline/body ink (`--atelier-ink`).
- **Slate Navy** (`#1b263b`): Primary solid CTA button fills, active parameter tab fills, and secondary structural typography (`--atelier-navy`).

### Secondary
- **Steel Blue** (`#778da9`): Active navigation selection fill, selected filter chips, canvas output branch ports (`+`), active flow wire pulses, and winner score pills (`--atelier-steel`).
- **Mid Slate** (`#415a77`): Muted metadata copy, inactive parameter labels, and active vault status indicators (`--atelier-slate`).

### Neutral
- **Warm Alabaster Canvas** (`#e0e1dd`): Primary workspace drafting floor, dotted Flow Canvas background, and subtle hover fills (`--atelier-canvas`).
- **Tinted Card Surface** (`#f7f8f6`): Secondary inset panels, modal footers, and read-only prompt wells (`--atelier-surface`).
- **Crisp White** (`#ffffff`): Elevated Flow Canvas step cards, Gallery project cards, sidebar navigation buttons, and text inputs (`--atelier-white`).
- **Atelier Crimson** (`#9e2a2b`): Reserved strictly for two-step destructive confirmation states and missing-key warning dots (`--atelier-danger`).

### Named Rules
**The Cool-Slate Purity Rule.** Every UI chrome surface, border, badge, and shadow derives from `#0d1b2a`, `#1b263b`, `#415a77`, `#778da9`, `#e0e1dd`, `#f7f8f6`, and `#ffffff` (with `#9e2a2b` for destructive confirmation)—never legacy neon lime, solar amber, or untinted gray.

**The Dark-Tab Contrast Rule.** When Slate Navy (`#1b263b`) fills an active tab, sub-labels render in Warm Alabaster (`#e0e1dd`, `11.2:1` contrast) rather than Steel Blue (`#778da9`, `4.45:1`) so `12px` metadata exceeds WCAG AAA.

**The Cool-Slate Dark Atelier Rule (`data-theme="dark"`).** Toggling **Dark Theme** in Studio Settings maps semantic tokens to a 5-step Cool-Slate dark elevation ramp—Obsidian shell (`#060d16`), Deepest Ink canvas (`#0d1b2a`), Oxford card/control surfaces (`#152235` / `#1b263b`), machined slate borders (`#3d5573`) with `#050b12` Neo-Brutalist hard shadows, luminous Silver Lake Blue accents (`#8da4c2`), and Alabaster primary solid CTAs (`#e8ecf2` with `#060d16` ink)—persisted across SQLite `app_vault` and `localStorage` with zero flash of unstyled light theme.

## Typography

**Display & Body Font:** Plus Jakarta Sans (self-hosted via `next/font`, with `-apple-system, BlinkMacSystemFont, sans-serif` fallback)
**Label/Mono Font:** JetBrains Mono (self-hosted via `next/font`, with `ui-monospace, SFMono-Regular, monospace` fallback)

**Character:** Geometric, high-x-height grotesque headlines (`700`–`800` weight) paired with crisp monospace numeric telemetry so node headers, rubric scores, and multi-line scene prompts scan effortlessly at workstation density.

### Hierarchy
- **Display** (`800` weight, `1.5rem`, `1.1` line-height, `-0.03em` letter-spacing): Rubric score readouts (`94/100`) and focal numeric counters.
- **Headline** (`800` weight, `0.92rem`, `1.15` line-height, `-0.02em` letter-spacing): Sidebar brand lockup (`Nano Banana / Atelier Studio`) and modal headers.
- **Title** (`800` weight, `0.86rem`–`0.88rem`, `1.25` line-height, `-0.02em` letter-spacing): Inline-editable Flow Toolbar `<h1>` titles, Gallery card `<h2>` titles (`text-wrap: nowrap; text-overflow: ellipsis`), and Modifier category titles.
- **Body** (`500` weight, `0.82rem`, `1.45` line-height): Prompt editor textareas, Critic diagnosis summaries (`max-width: 65ch`), and Lightbox prompt inspection copy.
- **Label** (`700`–`800` weight, `0.75rem`, `1.2` line-height, `0.02em` letter-spacing): Turn badges (`#1.1`), round pills (`ROUND 01 • LATEST`), aspect ratio tags (`3:4`), and form labels.

### Named Rules
**The 12px Floor Rule.** No text element, badge, storage path, or pill in the interface renders below `0.75rem` (`12px`).

**The Tabular Telemetry Rule.** All turn identifiers, zoom percentages (`92%`), rubric weights (`25%`), and scores (`94/100`) enforce `font-variant-numeric: tabular-nums` in `JetBrains Mono` so counters never jitter across rounds.

## Layout

On desktop (`≥ 960px`), `.ref-desktop-shell` occupies `100vw × 100vh` (`overflow: hidden`, `padding: 0 10px 10px 10px`) below the `36px` Tauri `.ref-window-titlebar`. Inside `.ref-canvas-surface` (`border-radius: 20px`, `padding: 14px 18px`, `gap: 16px`):

1. **Collapsible Left Sidebar (`.ref-sidebar`)**: `204px` expanded / `68px` collapsed, stacking the brand mark at the top, workspace navigation (`Studio`, `Goal Harness`, `Gallery`, `Modifiers`, `+ New Project`) in the middle, and `Vault Status`, `Settings`, and the `« Collapse` button at the bottom.
2. **Studio Flow (`/create` — `.ref-flow-studio-layout`)**: Full-width dotted Flow Canvas (`touch-action: none`) with a single-row floating `.ref-flow-toolbar` (`12px` inset): inline-editable `<h1>` project title expanding across the left, and `Auto-Organize`, `Fit View`, `Zoom`, and `+ New Step` anchored on the right.
3. **Goal Harness (`/harness` — `.ref-harness-flow-layout`)**: `minmax(0, 1fr) 384px` split pairing the 4-stage pipeline Flow Canvas on the left with the scrollable Goal, Refinement (`+ Fix:` full-width suggestion chips + bottom `Anchor Winner` toggle), and Iteration History dock on the right.
4. **Projects Gallery (`/gallery`)**: Compact `360px` search input on the left with `[All] [Studio] [Goal Harness]` filter buttons directly to its right, above an `auto-fill` (`minmax(290px, 1fr)`) grid of `356px` min-height cards with bottom-aligned action rows.
5. **Adaptive Breakpoints**: Below `960px`, split views (`.ref-harness-flow-layout`, `.ref-modifiers-split-layout`) stack vertically and the sidebar auto-collapses; below `768px`, `.ref-sidebar` converts into a horizontal bottom navigation bar so `.ref-workspace-main` claims `100%` width.

## Elevation & Depth

Nano Banana Studio uses **structural Neo-Brutalist elevation**: crisp `1.5px solid #0d1b2a` borders paired with zero-blur bottom-right offset shadows in Deepest Ink (`#0d1b2a`). Interactive buttons translate `(1px, 1px)` on `:active` while stepping down one shadow tier for physical keycap feedback.

### Shadow Vocabulary
- **Micro Control (`--ref-shadow-hard-xs`)** (`box-shadow: 2px 3px 0 #0d1b2a`): Compact chips, badges, and pressed button states.
- **Standard Control (`--ref-shadow-hard-sm`)** (`box-shadow: 3px 4px 0 #0d1b2a`): Sidebar navigation buttons, card action buttons (`Open`, `Remove`), and status boxes.
- **Floating Toolbar & Card (`--ref-shadow-hard-md`)** (`box-shadow: 4px 5px 0 #0d1b2a`): Floating Flow Toolbars, Gallery project cards, and focused textareas.
- **Canvas Step Node (`--ref-shadow-hard-canvas`)** (`box-shadow: 6px 8px 0 #0d1b2a`): Immutable Flow Canvas step cards (`8px 10px 0 #0d1b2a` on hover/selection).

### Named Rules
**The Tactile Press Rule.** Buttons carry a `1.5px solid #0d1b2a` border and hard offset shadow at rest, shifting `transform: translate(1px, 1px)` on `:active`—never diffuse ambient glow halos.

## Shapes

All geometry follows a **4px/8px modular boxed scale**:
- **Micro Insets (`4px`)**: Custom scrollbar tracks/thumbs (`8px` wide), switch thumbs (`18×18px`), and compact inline count badges (`16px` tall).
- **Buttons, Chips & Ports (`8px`)**: Primary solid buttons, white outline buttons, filter chips, `28×28px` canvas branch `+` ports, and zoom controls.
- **Sidebar Items & Inputs (`10px`–`12px`)**: Sidebar navigation buttons, search inputs, and prompt textareas.
- **Flow Toolbars, Step Cards & Modals (`14px`–`20px`)**: Floating canvas toolbars (`14px`), Flow step cards and Gallery cards (`16px`), and the outer workspace canvas (`20px`).

### Named Rules
**The Boxed Button Rule.** Circular (`border-radius: 50%`) and stadium pill (`border-radius: 9999px`) shapes are banned across all buttons, ports, switches, and chips; every interactive control is a rounded box (`4px`–`14px`).

## Components

### Buttons
- **Shape:** Crisp rounded box (`8px`–`10px` radius) with `1.5px solid #0d1b2a` stroke and `3px 4px 0 #0d1b2a` hard shadow.
- **Primary (`.ref-mura-btn-solid`, `.ref-dark-pill-btn`):** Slate Navy (`#1b263b`) fill with Crisp White (`#ffffff`) `0.8rem` `700`-weight text; deepens to Deepest Ink (`#0d1b2a`) on hover.
- **Outline Action (`.ref-mura-btn-outline`):** Crisp White (`#ffffff`) fill with Deepest Ink (`#0d1b2a`) text and `1.5px solid #0d1b2a` border; shifts to Warm Alabaster (`#e0e1dd`) on hover and Crimson (`#9e2a2b`) on destructive confirmation.
- **Focus:** `2px solid #778da9` outline with `2px` offset on `:focus-visible`.

### Chips
- **Style:** Boxed `8px`-radius `.ref-pill-chip` (`32px`–`36px` height, `0 12px` padding) in Crisp White (`#ffffff`) with `1.5px solid #0d1b2a` border and `2px 3px 0 #0d1b2a` shadow.
- **State:** Selected `.active` state fills with Steel Blue (`#778da9`) and Deepest Ink (`#0d1b2a`) `800`-weight text. In Goal Harness refinement, `.ref-harness-quick-chips .ref-pill-chip` spans `100%` width (`padding: 8px 12px`).

### Cards / Containers
- **Corner Style:** `16px` rounded box with `1.5px solid #0d1b2a` border.
- **Background:** Crisp White (`#ffffff`) over the `#e0e1dd` canvas.
- **Shadow Strategy:** `4px 5px 0 #0d1b2a` on Gallery/Modifier cards; `6px 8px 0 #0d1b2a` on Flow Canvas nodes.
- **Gallery Card Alignment:** `.ref-project-card` enforces `min-height: 356px` with `margin-top: auto` and `justify-content: flex-end` on `.ref-mura-actions-row` so right-aligned white `Open` and `<IconTrash /> Remove` buttons align to the exact pixel across every row.

### Inputs / Fields
- **Style:** `12px` rounded box in Crisp White (`#ffffff`) with `1.5px solid #0d1b2a` border (`36px` search bar height, `0 12px` padding; `caret-color: #0d1b2a`).
- **Focus:** Shifts shadow to `4px 5px 0 #0d1b2a` with `2px solid #778da9` focus ring.

### Navigation
- **Desktop Sidebar:** Collapsible vertical card (`204px` / `68px`) with `.ref-sidebar-nav-item` boxed buttons (`38px` height, `10px` radius). The collapse toggle (`« Collapse` / `»`) sits at the bottom of `.ref-sidebar-footer` below `Settings`.
- **Mobile Rail (`< 768px`):** Converts into a full-width bottom bar (`40px` icon buttons) beneath the workspace.

### Flow Canvas & Step Cards (Signature Component)
- **Viewport (`.ref-flow-canvas-viewport`):** Dotted `#e0e1dd` infinite plane (`22px` radial grid, `touch-action: none`) driven by unified Pointer Events (`onPointerDown`/`pointermove`/`pointerup`/`pointercancel`) and GPU `translate3d(...) scale(...)` camera glides.
- **Branch Port (`.ref-flow-port.output-port-btn`):** `28×28px` (`8px` radius) Steel Blue (`#778da9`) boxed `+` port anchored to the right edge of every card (`≥ 24×24 CSS px` WCAG 2.5.8 compliant).

## Do's and Don'ts

### Do:
- **Do** reference semantic `--atelier-*` CSS custom properties (`--atelier-ink`, `--atelier-navy`, `--atelier-slate`, `--atelier-steel`, `--atelier-canvas`, `--atelier-surface`, `--atelier-white`, `--atelier-danger`) instead of hardcoded hex literals.
- **Do** use authored stroke SVGs from `AtelierIcons.tsx` (`1.8px`–`2px` stroke) for all icons, badges, and status indicators.
- **Do** use inline toolbar editing for quick project/mission renames and `useDialogFocusTrap` on true modal dialogs (`Wizard`, `Inspector`, `Lightbox`, `Settings`, `Delete Confirmation`).
- **Do** maintain `touch-action: none` and Pointer Event capture/cancel cleanup on draggable Flow Canvas surfaces, while debouncing `localStorage` and URL state sync off the `pointermove` hot path.

### Don't:
- **Don't** introduce `border-radius: 50%` circular buttons or `border-radius: 9999px` capsule pills anywhere in the UI.
- **Don't** render raw Unicode or emoji glyphs (`🏆`, `⚙`, `✦`, `🔑`, `🗑`) in place of `AtelierIcons.tsx` SVG components.
- **Don't** set any `font-size` below `0.75rem` (`12px`) or animate layout-thrashing CSS properties (`width`, `left`, `top`, `filter`).
- **Don't** persist Gemini API keys (`AIza...`) to `localStorage`, `sessionStorage`, cookies, or URL query parameters.
