"""Interactive Creation Co-Pilot & Prompt Engine service for Nano Banana Studio."""

from __future__ import annotations

from typing import Any


STYLE_PRESETS: list[dict[str, str]] = [
    {
        "id": "editorial-anime",
        "title": "Editorial Anime (Crypko)",
        "description": (
            "High-precision cel-shaded linework with Japanese editorial art direction, "
            "crisp ink contours, and high-contrast color blocks over a warm bone-cream canvas."
        ),
        "prompt_tokens": (
            "high-craft editorial anime illustration, crisp cel-shaded linework, "
            "graphic flat shadow blocks, warm cream paper aesthetic, character design sheet quality, "
            "bold ink outlines, acid-yellow and carbon-black accents"
        ),
        "aspect_ratio": "3:4",
    },
    {
        "id": "analog-35mm",
        "title": "35mm Analog Photography",
        "description": (
            "Organic Kodak Portra 400 film stock texture, subtle silver-halide grain, "
            "classic 35mm f/1.4 Summilux optics, and natural highlight halation."
        ),
        "prompt_tokens": (
            "35mm analog film photography, Kodak Portra 400 film stock, subtle organic film grain, "
            "natural halation on highlights, Leica M6 35mm f/1.4 Summilux lens, authentic color grading"
        ),
        "aspect_ratio": "4:3",
    },
    {
        "id": "neo-brutalist",
        "title": "Neo-Brutalist Graphic Poster",
        "description": (
            "Swiss grid geometry, integrated industrial typography, 45° architectural chamfers, "
            "and stark contrast between carbon black (#0B0B0B), editorial cream, and acid yellow (#F2FA3C)."
        ),
        "prompt_tokens": (
            "neo-brutalist graphic editorial illustration, Swiss grid composition, "
            "stark carbon-black ink lines, acid-yellow #F2FA3C accent blocks, warm bone paper background, "
            "print screenprint texture, high-impact visual hierarchy"
        ),
        "aspect_ratio": "1:1",
    },
    {
        "id": "cyberpunk-3d",
        "title": "Cyberpunk 3D Concept Render",
        "description": (
            "Translucent polycarbonate surfaces, ray-traced global illumination, "
            "specular wet-asphalt reflections, and futuristic urban techwear detailing."
        ),
        "prompt_tokens": (
            "stylized 3D cyberpunk concept render, Octane render quality, subsurface scattering, "
            "anodized industrial materials, wet asphalt neon reflections, volumetric fog, "
            "futuristic techwear visor details"
        ),
        "aspect_ratio": "16:9",
    },
    {
        "id": "cinematic-concept",
        "title": "Widescreen Cinematic Concept",
        "description": (
            "Feature-film matte painting art direction, Panavision anamorphic optics, "
            "epic environmental scale, and multi-plane atmospheric depth."
        ),
        "prompt_tokens": (
            "widescreen cinematic concept art, Panavision anamorphic lens flare, "
            "dramatic environmental storytelling, layered atmospheric depth, painterly brushwork "
            "with crisp focal detail, film still composition"
        ),
        "aspect_ratio": "16:9",
    },
    {
        "id": "botanical-watercolor",
        "title": "Botanical Watercolor & Ink",
        "description": (
            "Translucent pigment washes on cold-pressed 300gsm cotton rag paper paired with "
            "fine technical dip-pen cross-hatching."
        ),
        "prompt_tokens": (
            "archival botanical watercolor and fine technical ink drawing, cold-pressed 300gsm cotton paper, "
            "luminous translucent pigment washes, delicate cross-hatching, natural history illustration"
        ),
        "aspect_ratio": "3:4",
    },
]


MODIFIER_CATEGORIES: list[dict[str, Any]] = [
    {
        "id": "lighting",
        "title": "Lighting",
        "options": [
            {
                "id": "golden-hour",
                "label": "Warm Golden Hour",
                "token": "warm golden hour rim lighting, long expressive cast shadows, sun-drenched atmosphere",
            },
            {
                "id": "acid-rim",
                "label": "Acid-Yellow Rim Light",
                "token": "sharp acid-yellow #F2FA3C rim light, high-contrast chiaroscuro ink shadows",
            },
            {
                "id": "studio-softbox",
                "label": "Diffused Editorial Softbox",
                "token": "soft diffused editorial studio lighting, clean catchlights, balanced tonal separation",
            },
            {
                "id": "neon-rain",
                "label": "Neon Nocturne & Reflections",
                "token": "nocturnal cyberpunk neon glow, wet pavement specular reflections, cyan and amber highlights",
            },
        ],
    },
    {
        "id": "camera",
        "title": "Camera & Lens",
        "options": [
            {
                "id": "lens-35mm",
                "label": "35mm Street Editorial",
                "token": "35mm editorial street lens, natural perspective, environmental context",
            },
            {
                "id": "lens-85mm",
                "label": "85mm f/1.4 Portrait Prime",
                "token": "85mm f/1.4 prime portrait lens, shallow depth of field, tack-sharp eye focus",
            },
            {
                "id": "low-angle-24mm",
                "label": "24mm Heroic Low Angle",
                "token": "24mm wide-angle low heroic camera angle, dynamic foreshortening, commanding presence",
            },
            {
                "id": "isometric-tele",
                "label": "135mm Compressed Telephoto",
                "token": "135mm telephoto compression, graphic flattened background layers, poster-like framing",
            },
        ],
    },
    {
        "id": "composition",
        "title": "Composition",
        "options": [
            {
                "id": "rule-of-thirds",
                "label": "Asymmetric Rule of Thirds",
                "token": "asymmetric rule-of-thirds editorial framing, intentional negative space for graphic balance",
            },
            {
                "id": "centered-iconic",
                "label": "Iconic Center-Framed Poster",
                "token": "bold symmetrical center-framed portrait, direct gaze, graphic poster layout",
            },
            {
                "id": "diagonal-action",
                "label": "Dynamic Diagonal Motion",
                "token": "dynamic diagonal leading lines, mid-stride motion energy, flowing garments",
            },
            {
                "id": "layered-depth",
                "label": "3-Plane Foreground/Background",
                "token": "multi-plane foreground/midground/background depth, out-of-focus foreground framing elements",
            },
        ],
    },
    {
        "id": "palette",
        "title": "Color Palette",
        "options": [
            {
                "id": "cream-ink-acid",
                "label": "Cream, Carbon Ink & Acid Yellow",
                "token": "warm bone cream #E9E7DF, deep carbon black #0B0B0B, and electric acid-yellow #F2FA3C accents",
            },
            {
                "id": "pastel-teal-warm",
                "label": "Pastel Teal Sky & Warm Ochre",
                "token": "pastel teal sky tones paired with warm sunlit ochre, cream, and muted slate shadows",
            },
            {
                "id": "monochrome-duotone",
                "label": "High-Contrast Graphic Duotone",
                "token": "high-contrast graphic duotone palette, stark ink blacks with selective signal-yellow highlights",
            },
            {
                "id": "cyber-nocturne",
                "label": "Midnight Indigo & Sodium Amber",
                "token": "deep midnight indigo shadows, sodium-vapor amber streetlamps, electric lime reflections",
            },
        ],
    },
    {
        "id": "mood",
        "title": "Atmosphere",
        "options": [
            {
                "id": "confident-explorer",
                "label": "Sunlit Confident Explorer",
                "token": "breezy optimistic urban adventure mood, confident relaxed posture, crisp daylight clarity",
            },
            {
                "id": "mysterious-noir",
                "label": "Cinematic Neo-Noir Tension",
                "token": "enigmatic neo-noir tension, moody shadow play, introspective cinematic atmosphere",
            },
            {
                "id": "kinetic-editorial",
                "label": "Kinetic Tokyo Zine Energy",
                "token": "high-fashion Tokyo street magazine energy, bold attitude, graphic poise",
            },
            {
                "id": "serene-contemplative",
                "label": "Contemplative Poetic Stillness",
                "token": "quiet poetic stillness, gentle breeze, evocative emotional resonance",
            },
        ],
    },
]


INTERACTIVE_WORKFLOW_STEPS: list[dict[str, Any]] = [
    {
        "step": 1,
        "title": "1. Base Concept & Visual Diagnosis",
        "subtitle": "Python Co-Pilot (Flask)",
        "description": (
            "Describe your initial visual concept in natural language. The Python heuristic engine "
            "evaluates visual completeness (0–100%) and pinpoints missing art-direction dimensions like lighting, "
            "optics, framing, and mood — without ever requesting or touching your API key."
        ),
        "badge": "Structural Diagnosis",
    },
    {
        "step": 2,
        "title": "2. Guided Art Direction",
        "subtitle": "Interactive Questions & Presets",
        "description": (
            "Answer tailored one-click art-direction prompts or pick from 3 curated directorial variations "
            "(Editorial Cover, Cinematic Street, Character Close-up). Every choice enriches your Master Prompt "
            "in real time with optical vocabulary tuned for Nano Banana."
        ),
        "badge": "Guided Co-Creation",
    },
    {
        "step": 3,
        "title": "3. Direct Browser Generation via Nano Banana",
        "subtitle": "Zero-Storage • 100% RAM Key",
        "description": (
            "When you click Generate, your browser dispatches the HTTPS request directly to Google Gemini "
            "(`gemini-2.5-flash-image`) using the key held strictly in volatile React state (`useState`). "
            "Zero bytes of your API key ever touch disk or pass through our backend."
        ),
        "badge": "Zero-Storage Privacy",
    },
    {
        "step": 4,
        "title": "4. Multi-Turn Conversational Refinement & Publishing",
        "subtitle": "Continuous Visual Evolution",
        "description": (
            "With your frame on the timeline, apply one-click refinement chips ('Make lighting more dramatic', "
            "'Switch to Tokyo neon night') or custom edits. Nano Banana receives the prior frame + refined prompt "
            "to evolve the scene while preserving character identity, ready to publish to the Community Gallery."
        ),
        "badge": "Multi-Turn Iteration",
    },
]


QUICK_ITERATION_CHIPS: list[dict[str, str]] = [
    {
        "id": "dramatic-light",
        "label": "Make lighting more dramatic",
        "instruction": "Make the lighting more dramatic with chiaroscuro contrast and an acid-yellow rim light",
    },
    {
        "id": "neon-night",
        "label": "Switch to neon Tokyo night",
        "instruction": "Transform the setting into a nocturnal Tokyo street with neon reflections on wet asphalt",
    },
    {
        "id": "closeup-85mm",
        "label": "85mm cinematic close-up",
        "instruction": "Move the camera closer for an 85mm f/1.4 cinematic close-up portrait while keeping the expression",
    },
    {
        "id": "acid-yellow-accents",
        "label": "Highlight acid-yellow accents",
        "instruction": "Add graphic details and a translucent visor in acid-yellow (#F2FA3C) with crisp ink outlines",
    },
    {
        "id": "golden-hour-street",
        "label": "Bathe in warm Golden Hour light",
        "instruction": "Bathe the scene in warm golden hour sunlight with a pastel teal sky in the background",
    },
    {
        "id": "wide-angle-action",
        "label": "Dynamic 24mm low angle",
        "instruction": "Reframe with a heroic 24mm low-angle lens showcasing the surrounding street architecture",
    },
]


_DIMENSION_KEYWORDS: dict[str, list[str]] = {
    "lighting": [
        "light", "lighting", "shadow", "sunlit", "sun", "glow", "rim", "chiaroscuro",
        "golden hour", "neon", "night", "nocturnal", "softbox", "sunset", "dusk",
        "luz", "iluminação", "sol", "sombra",
    ],
    "camera": [
        "lens", "camera", "close-up", "closeup", "portrait", "35mm", "85mm",
        "24mm", "135mm", "angle", "framing", "wide", "macro", "telephoto", "dof",
        "lente", "câmera", "retrato", "ângulo",
    ],
    "environment": [
        "street", "city", "tokyo", "background", "alley", "sky", "architecture", "interior",
        "studio", "forest", "urban", "rain", "avenue", "greenhouse", "backdrop",
        "rua", "cidade", "cenário", "fundo",
    ],
    "mood": [
        "dramatic", "calm", "serene", "mysterious", "epic", "vibrant", "futuristic",
        "nostalgic", "tense", "confident", "atmosphere", "noir", "optimistic", "kinetic",
        "dramático", "atmosfera",
    ],
    "composition": [
        "composition", "centered", "symmetrical", "diagonal", "thirds", "perspective",
        "foreground", "layered", "silhouette", "framing", "dynamic", "pose",
        "composição", "perspectiva",
    ],
}


_QUESTION_BANK: dict[str, dict[str, Any]] = {
    "lighting": {
        "id": "q-lighting",
        "dimension": "lighting",
        "question": "What lighting atmosphere should define this scene?",
        "options": [
            {
                "label": "Warm Golden Hour Sunlight",
                "prompt_addition": "bathed in warm late-afternoon golden hour light with long expressive cast shadows",
            },
            {
                "label": "Acid-Yellow (#F2FA3C) Rim & Ink Shadows",
                "prompt_addition": "dramatic acid-yellow (#F2FA3C) rim lighting paired with deep carbon-black ink shadows",
            },
            {
                "label": "Diffused Editorial Studio Light",
                "prompt_addition": "soft diffused editorial studio lighting highlighting fabric textures and crisp linework",
            },
            {
                "label": "Rainy Cyberpunk Neon Night",
                "prompt_addition": "nocturnal cyberpunk lighting with neon reflections shimmering across wet pavement",
            },
        ],
    },
    "camera": {
        "id": "q-camera",
        "dimension": "camera",
        "question": "Which camera framing and optical lens should we use?",
        "options": [
            {
                "label": "85mm Editorial Portrait (Medium Shot)",
                "prompt_addition": "framed as an 85mm f/1.4 editorial medium portrait with tack-sharp focus on the eyes",
            },
            {
                "label": "35mm Street Scene in Motion",
                "prompt_addition": "captured on a 35mm street lens with natural perspective and mid-stride motion",
            },
            {
                "label": "24mm Heroic Low Angle",
                "prompt_addition": "dynamic low-angle 24mm wide camera perspective emphasizing character presence",
            },
            {
                "label": "Extreme Detail Close-Up",
                "prompt_addition": "tight macro close-up highlighting eyewear visor, facial expression, and surface texture",
            },
        ],
    },
    "environment": {
        "id": "q-environment",
        "dimension": "environment",
        "question": "What environmental backdrop should anchor the composition?",
        "options": [
            {
                "label": "Sunlit Street with Pastel Teal Sky",
                "prompt_addition": "set along a sunlit urban street beneath a pastel teal sky and clean architecture",
            },
            {
                "label": "Minimalist Bone-Cream Graphic Backdrop (#E9E7DF)",
                "prompt_addition": "set against a minimalist warm bone-cream (#E9E7DF) graphic paper backdrop with subtle geometry",
            },
            {
                "label": "Futuristic Tokyo Crossing",
                "prompt_addition": "set in a futuristic Tokyo intersection with graphic signage and overhead utility lines",
            },
            {
                "label": "Brutalist Concrete Conservatory",
                "prompt_addition": "inside an architectural brutalist conservatory of board-formed concrete and glass",
            },
        ],
    },
    "mood": {
        "id": "q-mood",
        "dimension": "mood",
        "question": "Which mood and color direction should we apply?",
        "options": [
            {
                "label": "Editorial Contrast (Cream, Ink & Acid Yellow)",
                "prompt_addition": "high-impact graphic palette combining warm cream, carbon black, and acid-yellow accents",
            },
            {
                "label": "Sunlit Optimistic Adventure",
                "prompt_addition": "vibrant and confident exploration atmosphere with luminous warm tones",
            },
            {
                "label": "Cinematic Neo-Noir Tension",
                "prompt_addition": "dense, enigmatic neo-noir atmosphere with dramatic chiaroscuro light and shadow",
            },
            {
                "label": "Serene Pastel Stillness",
                "prompt_addition": "poetic, serene mood with soft tonal transitions and a gentle breeze",
            },
        ],
    },
    "composition": {
        "id": "q-composition",
        "dimension": "composition",
        "question": "How should we organize the subject focus and wardrobe details?",
        "options": [
            {
                "label": "Utility Jacket & Aviator Goggles",
                "prompt_addition": "wearing a structured high-collar utility jacket with aviator goggles resting on the forehead",
            },
            {
                "label": "Dynamic Diagonal Silhouette",
                "prompt_addition": "dynamic diagonal composition with garments flowing naturally in the wind",
            },
            {
                "label": "Iconic Magazine Cover Pose",
                "prompt_addition": "centered editorial posture looking over the shoulder with striking graphic poise",
            },
            {
                "label": "Three-Plane Layered Depth",
                "prompt_addition": "layered multi-plane composition with soft foreground elements creating depth",
            },
        ],
    },
}


def get_style_by_id(style_id: str | None) -> dict[str, str]:
    """Return matching style preset or default to editorial-anime."""
    if style_id:
        for preset in STYLE_PRESETS:
            if preset["id"] == style_id or preset["title"].lower() == style_id.lower():
                return preset
    return STYLE_PRESETS[0]


def resolve_modifier_tokens(selected_modifiers: list[str] | None) -> tuple[list[str], set[str]]:
    """Resolve modifier IDs, labels, or raw strings into prompt tokens and covered category IDs."""
    if not selected_modifiers:
        return [], set()

    tokens: list[str] = []
    covered_categories: set[str] = set()

    option_lookup: dict[str, tuple[str, str]] = {}
    for category in MODIFIER_CATEGORIES:
        cat_id = category["id"]
        for opt in category["options"]:
            option_lookup[opt["id"].lower()] = (cat_id, opt["token"])
            option_lookup[opt["label"].lower()] = (cat_id, opt["token"])

    for mod in selected_modifiers:
        cleaned = mod.strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in option_lookup:
            cat_id, token = option_lookup[key]
            covered_categories.add(cat_id)
            if token not in tokens:
                tokens.append(token)
        else:
            if cleaned not in tokens:
                tokens.append(cleaned)

    return tokens, covered_categories


def analyze_prompt(
    idea: str,
    style_id: str | None = None,
    selected_modifiers: list[str] | None = None,
    history: list[str] | None = None,
    step: int | None = 1,
) -> dict[str, Any]:
    """Evaluate a raw visual idea and return completeness score, guided questions, variations, and master prompt."""
    clean_idea = (idea or "").strip()
    if not clean_idea:
        clean_idea = "Editorial anime explorer character wearing a utility jacket and aviator goggles"

    style = get_style_by_id(style_id)
    mod_tokens, covered_cats = resolve_modifier_tokens(selected_modifiers)

    combined_text = " ".join([clean_idea] + (history or []) + (selected_modifiers or [])).lower()

    detected_dimensions: list[str] = ["subject"]
    if style_id:
        detected_dimensions.append("style")

    missing_dimensions: list[str] = []
    for dim, keywords in _DIMENSION_KEYWORDS.items():
        has_keyword = any(kw in combined_text for kw in keywords)
        has_cat = dim in covered_cats or (dim == "mood" and "palette" in covered_cats)
        if has_keyword or has_cat:
            if dim not in detected_dimensions:
                detected_dimensions.append(dim)
        else:
            missing_dimensions.append(dim)

    base_score = 32 if len(clean_idea.split()) >= 3 else 20
    word_bonus = min(20, len(clean_idea.split()) * 2)
    style_bonus = 14 if style_id else 8
    dim_bonus = (len(detected_dimensions) - 1) * 7
    mod_bonus = min(18, len(mod_tokens) * 6)
    step_bonus = min(10, max(0, ((step or 1) - 1) * 4))

    completeness_score = min(100, max(15, base_score + word_bonus + style_bonus + dim_bonus + mod_bonus + step_bonus))

    ordered_dims = missing_dimensions + [
        d for d in ["lighting", "camera", "environment", "mood", "composition"] if d not in missing_dimensions
    ]
    guided_questions = [_QUESTION_BANK[d] for d in ordered_dims[:3]]

    modifier_clause = ", ".join(mod_tokens) if mod_tokens else (
        "warm golden hour sunlight, crisp editorial framing, subtle acid-yellow #F2FA3C accents"
    )
    master_prompt = (
        f"{clean_idea}. "
        f"Style: {style['prompt_tokens']}. "
        f"Art Direction & Camera: {modifier_clause}. "
        f"Ultra-clean composition, expressive character detail, high visual fidelity for Nano Banana."
    )

    variations = [
        {
            "id": "var-editorial",
            "title": "Flagship Editorial Cover",
            "focus": "Crisp ink linework, graphic shadow blocks, and acid-yellow accents",
            "full_prompt": (
                f"{clean_idea}, posed as a flagship editorial magazine cover. "
                f"{style['prompt_tokens']}, sharp 85mm portrait framing, "
                f"warm bone background (#E9E7DF) with bold carbon-black ink lines and acid-yellow (#F2FA3C) graphic accents"
                f"{', ' + ', '.join(mod_tokens) if mod_tokens else ''}."
            ),
            "recommended_aspect_ratio": style["aspect_ratio"],
        },
        {
            "id": "var-cinematic",
            "title": "Cinematic Street Narrative",
            "focus": "Environmental depth, sunlit urban avenue, and volumetric atmosphere",
            "full_prompt": (
                f"Wide cinematic street scene of {clean_idea}, walking through a sunlit urban avenue under a pastel teal sky. "
                f"{style['prompt_tokens']}, 35mm editorial street photography perspective, "
                f"warm golden hour rim lighting, rich architectural background details, layered foreground and midground depth"
                f"{', ' + ', '.join(mod_tokens) if mod_tokens else ''}."
            ),
            "recommended_aspect_ratio": "16:9",
        },
        {
            "id": "var-closeup",
            "title": "Intimate Character Close-Up",
            "focus": "Expressive gaze, goggles/collar detail, and high-contrast rim light",
            "full_prompt": (
                f"Intimate close-up character portrait of {clean_idea}, focusing on expressive eyes, utility collar, and goggles. "
                f"{style['prompt_tokens']}, 85mm f/1.4 shallow depth of field, "
                f"dramatic rim lighting with high-contrast graphic shadows and crisp surface textures"
                f"{', ' + ', '.join(mod_tokens) if mod_tokens else ''}."
            ),
            "recommended_aspect_ratio": "1:1",
        },
    ]

    return {
        "completeness_score": completeness_score,
        "missing_dimensions": missing_dimensions,
        "detected_dimensions": detected_dimensions,
        "guided_questions": guided_questions,
        "variations": variations,
        "master_prompt": master_prompt,
    }


def refine_prompt(
    current_prompt: str,
    instruction: str,
    style_id: str | None = None,
    selected_modifiers: list[str] | None = None,
) -> dict[str, Any]:
    """Refine an existing prompt with an iterative user command for multi-turn Nano Banana generation."""
    base_prompt = (current_prompt or "").strip()
    user_instruction = (instruction or "").strip()

    if not base_prompt:
        base_prompt = "Editorial anime character portrait with explorer jacket and goggles"
    if not user_instruction:
        user_instruction = "Enhance lighting contrast and crispness of fine details"

    style = get_style_by_id(style_id)
    mod_tokens, _ = resolve_modifier_tokens(selected_modifiers)

    inst_lower = user_instruction.lower()
    technical_enhancements: list[str] = []

    if any(k in inst_lower for k in ["dramatic", "dramátic", "shadow", "sombra", "contrast", "chiaroscuro"]):
        technical_enhancements.append(
            "high-contrast chiaroscuro lighting, deep carbon-black shadow blocks, razor-sharp rim light"
        )
    if any(k in inst_lower for k in ["night", "noite", "neon", "tokyo", "tóquio", "rain", "chuva"]):
        technical_enhancements.append(
            "nocturnal Tokyo street ambiance, vibrant neon signage reflections on wet asphalt, atmospheric mist"
        )
    if any(k in inst_lower for k in ["yellow", "amarelo", "acid", "ácido", "visor"]):
        technical_enhancements.append(
            "electric acid-yellow (#F2FA3C) graphic highlights, glowing translucent visor details, bold ink outlines"
        )
    if any(k in inst_lower for k in ["close", "portrait", "retrato", "85mm", "face"]):
        technical_enhancements.append(
            "tight 85mm f/1.4 close-up portrait framing, tack-sharp focus on facial expression and eyewear"
        )
    if any(k in inst_lower for k in ["golden", "dourad", "sun", "sol", "sunset", "warm"]):
        technical_enhancements.append(
            "warm golden hour sunlight, long diagonal cast shadows, luminous amber and pastel teal sky palette"
        )
    if any(k in inst_lower for k in ["wide", "abert", "24mm", "architecture", "low angle", "ângulo baixo"]):
        technical_enhancements.append(
            "expansive 24mm low-angle environmental framing showcasing surrounding street architecture"
        )

    if not technical_enhancements:
        technical_enhancements.append(
            "refined compositional balance, heightened surface texture fidelity, cohesive editorial color grading"
        )

    all_additions = technical_enhancements + mod_tokens
    addition_str = ", ".join(dict.fromkeys(all_additions))

    refined_prompt = (
        f"{base_prompt} — Iterative Update: {user_instruction}. "
        f"Visual Transformation: {addition_str}. "
        f"Maintain character identity and core style ({style['title']}: {style['prompt_tokens']})."
    )

    edit_instruction = (
        f"Keep the exact character identity, facial features, and core design from the previous image, "
        f"and apply this modification: {user_instruction}. "
        f"Enhance with: {addition_str}."
    )

    explanation = (
        f"Co-Pilot preserved the character identity and '{style['title']}' style, "
        f"translating your instruction ('{user_instruction}') into optical and lighting directives "
        f"for consistent multi-turn editing in Nano Banana."
    )

    candidate_suggestions = [
        {
            "label": "Make lighting more dramatic",
            "instruction": "Make the lighting more dramatic with chiaroscuro contrast and an acid-yellow rim light",
        },
        {
            "label": "Switch to neon Tokyo night",
            "instruction": "Transform the setting into a nocturnal Tokyo street with neon reflections on wet pavement",
        },
        {
            "label": "85mm cinematic close-up",
            "instruction": "Move the camera closer for an 85mm f/1.4 close-up portrait while preserving character identity",
        },
        {
            "label": "Add acid-yellow (#F2FA3C) accents",
            "instruction": "Add graphic accents and acid-yellow (#F2FA3C) reflections on the jacket and goggles",
        },
        {
            "label": "Bathe scene in Golden Hour light",
            "instruction": "Change the lighting to warm golden hour sunlight with a pastel teal sky backdrop",
        },
        {
            "label": "Expand to 24mm low-angle shot",
            "instruction": "Expand the framing to a 24mm wide low-angle shot revealing the surrounding street",
        },
    ]

    next_suggestions: list[dict[str, str]] = []
    for item in candidate_suggestions:
        if item["label"].lower() not in inst_lower and user_instruction.lower() not in item["instruction"].lower():
            next_suggestions.append(item)
        if len(next_suggestions) == 4:
            break

    while len(next_suggestions) < 4:
        for item in candidate_suggestions:
            if item not in next_suggestions:
                next_suggestions.append(item)
            if len(next_suggestions) == 4:
                break

    return {
        "refined_prompt": refined_prompt,
        "edit_instruction": edit_instruction,
        "explanation": explanation,
        "next_suggestions": next_suggestions,
    }
