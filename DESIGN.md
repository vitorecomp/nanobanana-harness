# DESIGN.md — Editorial Neo-Brutalist Design System Specification 🍌✦

This document specifies the visual language, color tokens, typography scale, structural geometry, and **Impeccable Craft Floor** invariants implemented in **Nano Banana Studio** (`frontend/src/app/globals.css`).

---

## 1. Aesthetic Direction: Editorial Neo-Brutalist Studio

The visual identity of **Nano Banana Studio** is inspired by high-precision Japanese editorial character-generation studios (*Crypko reference aesthetic*):
- **Graphic India-Ink Contrast on Warm Cream Paper**: Warm bone/cream surfaces (`#E9E7DF`) framed by crisp structural carbon-black borders (`#0B0B0B`) and electric acid-banana yellow accents (`#F2FA3C`).
- **Chamfered Architectural Geometry**: Deliberate 45° corner chamfers (`clip-path`), folder-tabbed cards, a top-center notched black navigation bar integrated into the outer monitor bezel, and a central rotating circular text seal around a 20-point starburst button.

---

## 2. Color Token Catalog (CSS Custom Properties)

Defined in `:root` inside `frontend/src/app/globals.css`:

| CSS Token | Hex Value | Visual Role & Contrast Ratio |
| :--- | :--- | :--- |
| `--bg-surround` | `#C4C4C0` | Cool architectural gray viewport surround outside the main monitor bezel. |
| `--bg-canvas` | `#E9E7DF` | Primary warm editorial cream/bone canvas inside the monitor frame. |
| `--bg-surface` | `#FFFFFF` | Crisp white surface for info cards, modals, and studio workspace panels. |
| `--bg-surface-warm` | `#F5F3EC` | Subtle warm secondary surface for inactive chips and supporting panels. |
| `--ink-primary` | `#0B0B0B` | Deep carbon black for headlines, body text, structural borders, and navbar (`> 16:1` contrast on `#E9E7DF`). |
| `--ink-secondary` | `#363530` | Warm-tinted dark charcoal for supporting copy (`> 8.5:1` contrast on `#E9E7DF`, exceeding the WCAG AA `4.5:1` floor). |
| `--ink-muted` | `#525049` | Warm-tinted medium-dark gray for technical metadata and labels (`> 5.4:1` contrast on `#E9E7DF`). |
| `--accent-banana` | `#F2FA3C` | **Acid Banana Yellow** for primary CTAs, vertical pills, accent strips, and active states (always paired with `#0B0B0B` ink for `> 17:1` contrast). |
| `--accent-teal` | `#5E7A6E` | Editorial slate-teal for secondary status badges and workflow indicators. |

---

## 3. Typography & Modular Scale

Loaded via `next/font/google` in `frontend/src/app/layout.tsx`:

1. **Display Headline (`--font-display`: `'Anton'`, fallback `'Impact'`, sans-serif)**:
   - Used for the monumental 2-line uppercase hero headline (`CRIAÇÃO INTERATIVA` / `COM NANO BANANA`) and section headers.
   - Tight tracking (`letter-spacing: -0.02em`), tight leading (`line-height: 0.94`), `text-transform: uppercase`.
2. **Editorial Body & UI Controls (`--font-sans`: `'Plus Jakarta Sans'`, sans-serif)**:
   - Used for explanatory copy, buttons, guided questions, and studio controls.
   - Reading measure strictly constrained to **`60ch–72ch`** (`max-width: 65ch`) for optimal legibility.
3. **Technical Tokens & Prompt Engineering (`--font-mono`: `'JetBrains Mono'`, monospace)**:
   - Used for displaying the synthesized *Master Prompt*, S3 bucket keys (`nanobanana-images/...`), port badges, completeness scores (`font-variant-numeric: tabular-nums`), and model identifiers (`gemini-2.5-flash-image`).

---

## 4. Signature Structural Geometry

1. **Outer Monitor Frame (`8px solid #0B0B0B`, `border-radius: 36px`)**:
   - Wraps the entire application canvas over the `#C4C4C0` surround, giving the interface the tactile presence of a dedicated hardware drafting station.
2. **Top-Center Notched Black Navbar (`Navbar.tsx`)**:
   - Drops down from the top border with smooth angled diagonal shoulders, housing white navigation links in the center, the `nanobanana✦` brand mark on the top-left cream canvas, and the `Entrar com Google` pill / authenticated user badge on the top-right.
3. **Central Rotating Circular Text Seal & 20-Point Starburst (`HeroSection.tsx`)**:
   - Positioned at the focal center of the hero layout, featuring a rotating SVG text ring (`PROCESSO INTERATIVO • NANO BANANA GOOGLE • ZERO ARMAZENAMENTO •`) surrounding a 20-point black starburst CTA button (`INICIAR CRIAÇÃO ★`).
4. **Bottom-Left 45°-Chamfered Scene Card + Acid-Yellow Vertical Pill**:
   - Artwork card with 45° diagonal cut corners displaying `/showcase/hero-scene.png` and an overlapping right-edge `#F2FA3C` vertical pill button (`CRIAR AGORA`).
5. **Top-Right 45°-Chamfered Portrait Card + Acid-Yellow Vertical Strip**:
   - Tall portrait card displaying `/showcase/hero-portrait.png` paired with a `44px`-wide `#F2FA3C` vertical strip on the right edge (`★ ★` at top, `↑` at bottom).
6. **Bottom-Right Folder-Tabbed Info Card**:
   - Crisp white card with a 45° top-left step-down notch and a top-right black `○ ○ ○` window control tab explaining the interactive process and Zero-Storage guarantee.

---

## 5. Impeccable Craft Floor Compliance

Every component in `frontend/src/` enforces the **Impeccable Craft Floor**:
- **WCAG AA Contrast Floor (`>= 4.5:1`)**: Secondary and muted text colors are tinted toward the warm cream hue (`#363530`, `#525049`) so no washed-out gray ever appears on `#E9E7DF`.
- **Minimum `44x44px` Touch Targets**: All interactive buttons, guided question chips, timeline nodes, and navbar links enforce at least `44px` hit dimensions.
- **Zero Anti-Patterns**:
  - Zero gradient text (`background-clip: text`).
  - Zero generic blurry drop shadows: uses crisp neo-brutalist offset shadows (`box-shadow: 4px 4px 0px #0B0B0B`).
  - Zero thick colored side-stripe borders (`border-left: 4px solid`): uses full `1.5px solid #0B0B0B` structural borders and geometric chamfers.
  - Zero repetitive eyebrow kickers above every heading: uses editorial step indices (`01`–`04`) and direct typographic hierarchy.
