# Processing Pipelines — Nano Banana Studio 🍌✦

This document details the **5 Core Processing Pipelines** that power **Nano Banana Studio**, from incoming reverse-proxy routing at the **Nginx Gateway**, through **Local Dev (`usr_local_dev`) / Google / Facebook OAuth** authentication, heuristic prompt engineering in **Python (Flask + SQLAlchemy)**, direct browser-to-Google image generation via **Nano Banana (`gemini-2.5-flash-image`)** using a volatile RAM key, to transactional persistence in **PostgreSQL 16** and the **RustFS S3 Bucket**.

---

## Pipeline 1: Heuristic Diagnostics & Interactive Prompt Co-Pilot (`POST /api/interactive/analyze`)

This pipeline transforms a brief natural-language idea into a structured, cinema-grade art-direction package.

```mermaid
flowchart TD
    Input["1. User Input in Studio\n(idea, style_id, modifiers, history)"] --> Guard["2. zero_storage_api_key_guard Middleware\n(Verifies absence of api_key / AIza...)"]
    Guard --> Detect["3. Semantic Detection of 5 Visual Dimensions\n(subject, environment, lighting, camera, mood)"]
    Detect --> Score["4. Completeness Score Calculation (0–100%)\nBase + Dimension Bonuses + Modifiers + History"]
    Score --> Questions["5. Interactive Guided Question Selection\nPrioritizes missing dimensions with 4 clickable chips each"]
    Questions --> Master["6. Master Prompt Synthesis\nCombines Idea + Style Preset Tokens + Modifiers + Guided Answers"]
    Master --> Variations["7. Generation of 3 Complete Prompt Variations\n1. Editorial (3:4) | 2. Cinematic (16:9) | 3. 85mm Close-up (1:1)"]
    Variations --> Output["8. JSON Response to Frontend\n(completeness_score, guided_questions, variations, master_prompt)"]
```

### Internal Processing Steps (`backend/app/services/copilot_service.py`):
1. **Normalization & Bilingual Lexical Matching**: The user's `idea` and accumulated `history` tokens are evaluated against bilingual (Portuguese/English) visual vocabularies.
2. **Dimensional Assessment**: The engine checks five visual dimensions:
   - `subject` (character details, wardrobe, expression)
   - `environment` (setting, architecture, backdrop)
   - `lighting` (rim light, golden hour, chiaroscuro, neon reflections)
   - `camera` (focal length, depth of field, framing angle)
   - `mood` (atmosphere and color palette)
3. **Heuristic Scoring (`completeness_score`)**: Computes a `0–100%` score reflecting how well-specified the visual direction is.
4. **Master Prompt & Variations Synthesis**: Injects the selected style preset's `prompt_tokens` (e.g., *Editorial Anime Crypko*) and builds 3 distinct variations ready for immediate generation.

---

## Pipeline 2: Conversational Multi-Turn Refinement (`POST /api/interactive/refine`)

Once an initial frame is generated, the user can evolve it across multiple turns while preserving character identity:

```mermaid
sequenceDiagram
    autonumber
    actor U as User in Studio
    participant FE as Next.js Frontend
    participant BE as Flask Backend (prompts.py)

    U->>FE: Clicks quick chip or types edit command\n(e.g. "Change time to rainy neon night with acid-yellow visor")
    FE->>BE: POST /api/interactive/refine\n{ current_prompt, instruction, style_id, modifiers }
    BE->>BE: 1. Analyzes edit intent (lighting, camera, weather, color accent)
    BE->>BE: 2. Preserves core character & style descriptors from current_prompt
    BE->>BE: 3. Builds edit_instruction with character consistency lock\n("Preserve character identity, facial features, and pose while...")
    BE->>BE: 4. Selects 4 contextual follow-up suggestions (next_suggestions)
    BE-->>FE: 200 OK { refined_prompt, edit_instruction, explanation, next_suggestions }
```

---

## Pipeline 3: Direct Browser-to-Google Nano Banana Generation & Editing (`Zero-Storage`)

This is the critical privacy pipeline: generative execution occurs **100% between the user's browser and Google's Gemini API**, never passing through Nginx or the Python backend.

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant RAM as React useState (Browser RAM)
    participant NBClient as Browser Client (src/lib/nanobanana.ts)
    participant GoogleAPI as Google Gemini API (gemini-2.5-flash-image)

    U->>NBClient: Clicks "Generate with Nano Banana" (or "Apply Multi-Turn Edit")
    NBClient->>RAM: Reads volatile apiKey from memory
    alt No API Key & Interactive Simulation Mode enabled
        NBClient-->>U: Returns simulated interactive showcase frame (/showcase/step-1..3.png)
    else With Gemini API Key in RAM
        opt Multi-Turn Edit (Turn >= 2 with previous reference frame)
            NBClient->>NBClient: Extracts raw Base64 & mimeType from reference image (inlineData)
        end
        NBClient->>NBClient: Builds payload { contents: [{ parts: [inlineData?, { text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }
        NBClient->>GoogleAPI: POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent\nHeader: x-goog-api-key: <RAM_KEY> | cache: "no-store"
        GoogleAPI-->>NBClient: 200 OK (candidates[0].content.parts -> inlineData.data Base64 PNG)
        NBClient->>NBClient: Converts Base64 into data:image/png;base64,...
        NBClient-->>U: Renders frame on Live Canvas & appends node to Interactive Timeline
    end
```

---

## Pipeline 4: Transactional Persistence (PostgreSQL via SQLAlchemy + RustFS Bucket) & Later Consultation

Whenever a user in the Studio (either auto-provisioned `usr_local_dev` in Local Dev mode when `REQUIRE_AUTH=false`, or authenticated via Google/Facebook when `REQUIRE_AUTH=true`) generates or refines an image, the frontend automatically triggers the persistence pipeline:

```mermaid
flowchart TB
    Start["Frame Rendered on Studio Live Canvas\n(Turn #N)"] --> CheckAuth{"Active User Profile\n(usr_local_dev or Google/FB)?"}
    CheckAuth -- "No" --> LocalOnly["Keeps turn in volatile browser tab timeline only"]
    CheckAuth -- "Yes" --> PostTurn["POST /api/conversations/<conv_id>/turns\n(Sends prompt, score, modifiers, and image_data_url)"]

    subgraph BackendPipeline["Modular Python Flask + SQLAlchemy Processing (app/api/v1/ + app/services/ + app/models/)"]
        PostTurn --> EnsureUser["1. Ensures User row exists in PostgreSQL (e.g. usr_local_dev in Dev)"]
        EnsureUser --> EnsureConv["2. Verifies/Creates row in CONVERSATIONS\n(if conv_id == 'new' or not found)"]
        EnsureConv --> DecodeImg["3. Decodes image_data_url\n(Base64 data:image/png or showcase asset)"]
        DecodeImg --> UploadRustFS["4. Uploads PNG via S3 API to RustFS Bucket (http://rustfs:9000)\nBucket: nanobanana-images\nKey: {user_id}/{conv_id}/turn-{n}-{uuid}.png"]
        UploadRustFS --> InsertTurn["5. INSERT INTO conversation_turns in PostgreSQL via SQLAlchemy\n(Stores master_prompt, edit_instruction, image_bucket_key, image_url)"]
        InsertTurn --> UpdateConv["6. UPDATE conversations\n(Increments turn_count, updates latest_prompt, preview_image_url, updated_at)"]
    end

    UpdateConv --> Badge["Studio displays badge:\n'✓ Saved in Postgres + RustFS Bucket'"]

    subgraph LaterQuery["Later Consultation Pipeline (History & Bucket Gallery)"]
        Badge -.-> QueryConvs["GET /api/conversations?user_id={id}\nLists conversations ordered by updated_at DESC"]
        Badge -.-> QueryGallery["GET /api/users/{id}/gallery\nLists all stored bucket images + prompts for user"]
        QueryGallery --> StreamImg["GET /api/bucket/nanobanana-images/{user}/{conv}/turn-{n}-{uuid}.png\nStreams binary PNG directly from RustFS"]
    end
```

---

## Pipeline 5: Nginx Reverse Proxy Gateway Routing (`Port Pad` Dev & Prod)

To unify access across all services without CORS friction or port collisions, an **Nginx (`nginx:1.27-alpine`)** gateway fronts the stack in both **Development (`compose.dev.yaml`, Port Pad `+10000`)** and **Production (`compose.prod.yaml`, Port Pad `+20000`)**:

```mermaid
flowchart LR
    Browser["User Browser"]

    subgraph NginxGateway["Nginx Gateway (nginx/nginx.conf)\nDev: :18080 | Prod: :28080"]
        R_Root["Location /\n(WebSocket + HTTP 1.1)"]
        R_API["Location /api/\n(client_max_body_size 50M)"]
        R_S3["Location /s3/\n(Direct Bucket Proxy)"]
        R_Console["Location /rustfs-console/\n(RustFS Web UI)"]
        R_Health["Location /nginx-health"]
    end

    subgraph InternalServices["Internal Container / K8s Network"]
        FE["frontend:3000\n(Next.js)"]
        BE["backend:8000\n(Flask + SQLAlchemy)"]
        RFS_S3["rustfs:9000\n(RustFS S3 API)"]
        RFS_UI["rustfs:9001\n(RustFS Console)"]
        PG[("postgres:5432\n(PostgreSQL 16)")]
    end

    GoogleGemini["Google Nano Banana API\ngenerativelanguage.googleapis.com"]

    Browser -->|"GET /"| R_Root --> FE
    Browser -->|"POST /api/auth/google\nPOST /api/interactive/*\nPOST /api/conversations/*"| R_API --> BE
    Browser -->|"GET /s3/nanobanana-images/..."| R_S3 --> RFS_S3
    Browser -->|"GET /rustfs-console/"| R_Console --> RFS_UI
    BE --> PG
    BE --> RFS_S3

    Browser ===>|"DIRECT HTTPS CALL (x-goog-api-key in RAM)\nBypasses Nginx & Backend"| GoogleGemini
```
