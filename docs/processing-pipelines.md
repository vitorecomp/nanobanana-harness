# Processing Pipelines — Nano Banana Atelier Studio 🍌✦

This document provides sequence diagrams and step-by-step specifications for all **5 core processing pipelines** in **Nano Banana Atelier Studio**:

1. **Dynamic Scene Expansion & 4-Quad Generation (`1 + 3`)**
2. **Surgical Delta & Dual-Anchor Preservation**
3. **Non-Destructive Branching Timeline & History Resumption**
4. **Local Filesystem Persistence & Folder Synchronization**
5. **Modifiers Studio AI Synthesis**

---

## 1. Dynamic Scene Expansion & 4-Quad Generation (`1 + 3`)

Instead of rendering a single image from a raw prompt, the system queries `gemini-2.5-flash` to evaluate the scene concept and produce 3 artistic variations giving emphasis to complementary visual aspects. All 4 variations are dispatched concurrently to `gemini-2.5-flash-image`.

```mermaid
sequenceDiagram
    autonumber
    actor Creator as User / Art Director
    participant UI as InteractiveStudio (React 19)
    participant Client as nanobananaClient.ts
    participant GeminiFlash as Google Gemini Flash (2.5-flash)
    participant GeminiImage as Google Nano Banana (2.5-flash-image)
    participant Bridge as tauriBridge.ts (IPC)
    participant Storage as OS Filesystem (~/Pictures)
    participant SQLite as Local SQLite (nanobanana.sqlite3)

    Creator->>UI: Enter concept & pick Style / Modifiers
    UI->>Client: expandScene(basePrompt, style, modifiers)
    Client->>GeminiFlash: POST /models/gemini-2.5-flash:generateContent<br/>(AIza in volatile RAM)
    GeminiFlash-->>Client: Returns JSON: [Emphasis 1, Emphasis 2, Emphasis 3]
    Client-->>UI: 4 Prompts: [Base Prompt, Var 1, Var 2, Var 3]

    par Parallel Generation (4× Concurrency)
        UI->>GeminiImage: Generate Var 0 (Base Prompt)
        UI->>GeminiImage: Generate Var 1 (Dynamic Focus A)
        UI->>GeminiImage: Generate Var 2 (Dynamic Focus B)
        UI->>GeminiImage: Generate Var 3 (Dynamic Focus C)
    end
    GeminiImage-->>UI: 4× PNG base64 buffers returned
    UI->>UI: Render 2×2 Quad Generation Matrix

    UI->>Bridge: db_save_turn(turnData, variants)
    Bridge->>Storage: Write PNGs to ~/Pictures/nanobanana/<project>/
    Bridge->>SQLite: Insert conversation_turns record
    SQLite-->>UI: Confirmation (turn #N saved)
```

---

## 2. Surgical Delta & Dual-Anchor Consistency

When iterating on an existing frame, `⚡ Surgical Delta` mode allows creators to apply targeted incremental changes without rewriting the base scene description.

```mermaid
sequenceDiagram
    autonumber
    actor Creator as User / Art Director
    participant UI as InteractiveStudio
    participant Client as nanobananaClient.ts
    participant GeminiImage as Google Nano Banana (2.5-flash-image)
    participant Bridge as tauriBridge.ts

    Creator->>UI: Select winning quad frame (`✓ Selected`)
    Creator->>UI: Click `⚡ Delta` Mode
    Creator->>UI: Enter delta directive (e.g. "add rain droplets on visor")
    Creator->>UI: Enable `🧬 Pin DNA` & Locks (`🔒 Character`, `🔒 Background`)

    UI->>Client: refineWithDelta(baseImage, deltaPrompt, locks)
    Note over Client,GeminiImage: Sends selected PNG as multimodal inlineData<br/>alongside preservation constraints
    Client->>GeminiImage: POST /models/gemini-2.5-flash-image:generateContent
    GeminiImage-->>Client: Refined PNG buffer returned
    Client-->>UI: Update active frame with preserved identity

    UI->>Bridge: db_save_turn(parent_turn_number: currentTurn)
    Bridge-->>UI: Turn saved as child of active frame
```

---

## 3. Non-Destructive Branching Timeline & Lineage Resumption

Every iteration records its parent turn (`parent_turn_number`), allowing creators to explore diverging creative directions from any point in the history.

```mermaid
flowchart TD
    Turn1["Turn #1 (Concept Initial)\n[4 Quad Variations Generated]"]
    Turn2["Turn #2 (Surgical Lighting Delta)\nParent: #1"]
    Turn3["Turn #3 (Add Rain & Atmosphere)\nParent: #2"]

    Turn1Branch["Turn #4 (Alternate Cyberpunk Palette)\nParent: #1 (de #1 ➔)"]
    Turn1BranchChild["Turn #5 (Neon Reflections)\nParent: #4 (de #4 ➔)"]

    Turn1 --> Turn2
    Turn2 --> Turn3

    Turn1 -.->|"Branch from Turn #1"| Turn1Branch
    Turn1Branch --> Turn1BranchChild
```

- Clicking any prior turn in the vertical timeline loads its exact prompts, style presets, modifiers, and all 4 quad images.
- Subsequent generations automatically register the selected turn as the parent, creating a new branch indicator (`de #X ➔`) in the timeline.

---

## 4. Local Filesystem Persistence & Folder Synchronization

High-resolution generated images are persisted directly to the operating system's filesystem, categorized by project name.

```mermaid
sequenceDiagram
    autonumber
    participant UI as InteractiveStudio
    participant Bridge as tauriBridge.ts
    participant FS as Native Filesystem
    participant SQLite as nanobanana.sqlite3

    Note over UI,FS: User renames project from "Untitled" to "Neon_Samurai"
    UI->>Bridge: db_rename_project(id, "Neon_Samurai")
    Bridge->>FS: Rename folder ~/Pictures/nanobanana/Untitled ➔ Neon_Samurai
    Bridge->>SQLite: UPDATE conversations SET title = 'Neon_Samurai'
    Bridge->>SQLite: UPDATE conversation_turns SET image_path = replace(image_path, ...)
    SQLite-->>UI: Project and folder synchronized
```

- If a project is deleted in the UI, SQLite records are removed, but the folder `~/Pictures/nanobanana/<project-name>/` remains preserved on disk to prevent accidental data loss.

---

## 5. Modifiers Studio AI Synthesis

On the `/modifiers` route, creators can curate style, camera, and lighting modifier chips, or leverage Gemini to synthesize entirely new modifier categories.

```mermaid
sequenceDiagram
    autonumber
    actor Creator as User / Art Director
    participant ModifiersUI as Modifiers Page (/modifiers)
    participant Client as nanobananaClient.ts
    participant GeminiFlash as Google Gemini Flash

    Creator->>ModifiersUI: Click "✨ AI Generate Modifiers"
    Creator->>ModifiersUI: Prompt: "1980s Retro Anime & VHS Glitch Optics"
    ModifiersUI->>Client: generateModifiers(categoryPrompt)
    Client->>GeminiFlash: POST /models/gemini-2.5-flash:generateContent
    GeminiFlash-->>Client: Returns JSON array of modifier objects (id, name, prompt_fragment)
    Client-->>ModifiersUI: Parse & preview generated modifier chips
    Creator->>ModifiersUI: Click "Save to My Modifiers"
    ModifiersUI->>ModifiersUI: Persist custom category to Local Storage & Studio Context
```
