/**
 * Nano Banana Direct Browser Client (Zero-Storage Architecture)
 *
 * SECURITY INVARIANT:
 * - The user's Gemini API key is passed as an in-memory function argument from React `useState`.
 * - It is NEVER written to persistent storage or sent to any backend server.
 * - All requests go directly from the user's browser to Google's Generative Language API.
 */

import {
  CreationFlowMode,
  ExplorationMatrixAxis,
  GenerateNanoBananaRequest,
  GenerateNanoBananaResult,
  InlineImagePart,
  ModelGenerationParams,
  ModifierCategory,
  ModifierOption,
  PreservationLocks,
} from "../types/studio.types";

interface GeminiCandidatePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiCandidatePart[];
    };
    finishReason?: string;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export function parseDataUrl(dataUrl: string): InlineImagePart | null {
  if (!dataUrl.startsWith("data:")) {
    return null;
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }
  return {
    mimeType: match[1],
    data: match[2],
  };
}

export async function imageUrlToInlinePart(
  url: string
): Promise<InlineImagePart | null> {
  if (url.startsWith("data:")) {
    return parseDataUrl(url);
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<InlineImagePart | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(parseDataUrl(reader.result));
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateWithNanoBanana({
  apiKey,
  model,
  prompt,
  referenceImage,
  secondaryReferenceImage,
  modelParams,
}: GenerateNanoBananaRequest): Promise<GenerateNanoBananaResult> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error(
      "API Key missing in volatile RAM. Enter your Gemini API Key or enable Interactive Simulation Mode."
    );
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (referenceImage && referenceImage.data) {
    parts.push({
      inlineData: {
        mimeType: referenceImage.mimeType || "image/png",
        data: referenceImage.data,
      },
    });
  }

  if (secondaryReferenceImage && secondaryReferenceImage.data) {
    parts.push({
      inlineData: {
        mimeType: secondaryReferenceImage.mimeType || "image/png",
        data: secondaryReferenceImage.data,
      },
    });
  }

  parts.push({
    text: prompt,
  });

  const generationConfig: Record<string, unknown> = {
    responseModalities: ["TEXT", "IMAGE"],
  };
  if (
    typeof modelParams?.temperature === "number" &&
    Number.isFinite(modelParams.temperature)
  ) {
    generationConfig.temperature = modelParams.temperature;
  }
  if (
    typeof modelParams?.topP === "number" &&
    Number.isFinite(modelParams.topP)
  ) {
    generationConfig.topP = modelParams.topP;
  }
  if (
    typeof modelParams?.seed === "number" &&
    Number.isFinite(modelParams.seed)
  ) {
    generationConfig.seed = Math.round(modelParams.seed);
  }

  const payload = {
    contents: [
      {
        parts,
      },
    ],
    generationConfig,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": trimmedKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  let data: GeminiGenerateContentResponse;
  try {
    data = (await response.json()) as GeminiGenerateContentResponse;
  } catch {
    throw new Error(
      `Failed to decode response from Google Gemini API (HTTP ${response.status}).`
    );
  }

  if (!response.ok || data.error) {
    const errMsg =
      data.error?.message ||
      `HTTP ${response.status} error while calling Google Gemini API directly.`;
    throw new Error(errMsg);
  }

  const candidateParts = data.candidates?.[0]?.content?.parts ?? [];
  let foundImage: { mimeType: string; data: string } | null = null;
  const textFragments: string[] = [];

  for (const part of candidateParts) {
    if (part.inlineData && part.inlineData.data) {
      foundImage = {
        mimeType: part.inlineData.mimeType || "image/png",
        data: part.inlineData.data,
      };
    }
    if (part.text) {
      textFragments.push(part.text);
    }
  }

  if (!foundImage) {
    const fallbackReason =
      textFragments.join(" ").trim() ||
      data.candidates?.[0]?.finishReason ||
      "No image inlineData block returned by the model.";
    throw new Error(`Model responded without an image: ${fallbackReason}`);
  }

  const mimeType = foundImage.mimeType;
  const base64Data = foundImage.data;
  const imageDataUrl = `data:${mimeType};base64,${base64Data}`;

  return {
    imageDataUrl,
    mimeType,
    base64Data,
    modelText: textFragments.join("\n").trim() || undefined,
    modelUsed: model,
    mode: "direct-api",
  };
}

export interface QuadPromptVariation {
  label: string;
  prompt: string;
}

export interface QuadGeneratedSlot {
  label: string;
  prompt: string;
  imageUrl: string;
  mimeType: string;
  base64Data: string;
}

export const DEFAULT_ENHANCE_SYSTEM_PROMPT = [
  "You are an expert Art Director and Prompt Architect for Google Gemini 2.5 Flash Image ('Nano Banana').",
  "Gemini 2.5 Flash Image produces vastly superior artwork when given a cohesive, natural-language paragraph describing:",
  "1. Subject identity, expression, posture, and wardrobe materials.",
  "2. Spatial environment, foreground/background layering, and atmosphere.",
  "3. Camera framing, lens focal length, and lighting direction/color temperature.",
  "Rewrite and expand the user's idea into ONE rich, vivid paragraph in English (45 to 80 words). Do NOT use bullet points, markdown, or comma-tag soup.",
].join("\n");

export const DEFAULT_VARIATION_SYSTEM_PROMPT = [
  "You are an expert Visual Director and Prompt Engineer for Google Gemini 2.5 Flash Image ('Nano Banana').",
  "Create distinct, cohesive scene prompt variations in English based on the user's prompt.",
  "Keep Variation #1 faithful to the core scene, and give each subsequent variation a distinct directorial emphasis (camera optics/framing, lighting mood, atmospheric environment, material texture, or expressive staging) while keeping subject continuity.",
].join("\n");

function interpolatePromptTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) =>
    key in vars ? vars[key] : match
  );
}

/**
 * Expands a short user prompt into a rich, cinematic visual narrative optimized
 * for Gemini 2.5 Flash Image ("Nano Banana"), emphasizing spatial relationships,
 * material textures, optical focal length, and lighting direction.
 */
export async function enhanceNarrativeWithGemini(params: {
  apiKey: string;
  rawIdea: string;
  modifierLabels?: string[];
  aspectRatio?: string;
  hasReferenceImage?: boolean;
  preservationLocks?: PreservationLocks;
  customSystemPrompt?: string;
}): Promise<string> {
  const cleanIdea = params.rawIdea.trim();
  if (!cleanIdea) return "";

  const lockLead = params.hasReferenceImage
    ? buildPreservationPrefix(params.preservationLocks, true, false)
    : "";
  const modHint =
    params.modifierLabels && params.modifierLabels.length > 0
      ? `, featuring ${params.modifierLabels.join(", ")}`
      : "";

  const fallbackNarrative = finalizeExactImageModelPrompt({
    prompt: `${lockLead}${cleanIdea} — composed with intentional foreground-to-background depth, tactile surface materiality, expressive subject posture, and directional cinematic illumination${modHint}.`,
    modifierLabels: params.modifierLabels,
    aspectRatio: params.aspectRatio,
    preservationLocks: params.preservationLocks,
    hasReferenceImage: params.hasReferenceImage,
  });

  const trimmedKey = params.apiKey.trim();
  if (!trimmedKey) {
    return fallbackNarrative;
  }

  try {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    const resolvedInstruction = interpolatePromptTemplate(
      params.customSystemPrompt?.trim() || DEFAULT_ENHANCE_SYSTEM_PROMPT,
      {
        prompt: cleanIdea,
        modifiers: params.modifierLabels?.join(", ") || "",
        aspect_ratio: params.aspectRatio || "",
      }
    );
    const systemPrompt = [
      resolvedInstruction,
      params.hasReferenceImage
        ? "A reference image will be supplied alongside this prompt. Frame the scene so it transforms or extends the reference seamlessly."
        : "",
      lockLead ? `Mandatory preservation instruction to include: "${lockLead.trim()}"` : "",
      params.modifierLabels?.length
        ? `Incorporate these optical/lighting modifiers naturally: ${params.modifierLabels.join(", ")}.`
        : "",
      params.aspectRatio ? `Target aspect ratio: ${params.aspectRatio}.` : "",
      "Return ONLY the enhanced prompt text without surrounding quotes or commentary.",
      `User idea: "${cleanIdea}"`,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": trimmedKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
      }),
      cache: "no-store",
    });

    if (!response.ok) return fallbackNarrative;
    const data = (await response.json()) as GeminiGenerateContentResponse;
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join(" ")
        .trim() || "";
    const cleaned = text ? text.replace(/^["']|["']$/g, "").trim() : "";
    if (!cleaned) return fallbackNarrative;

    return finalizeExactImageModelPrompt({
      prompt: cleaned,
      modifierLabels: params.modifierLabels,
      aspectRatio: params.aspectRatio,
      preservationLocks: params.preservationLocks,
      hasReferenceImage: params.hasReferenceImage,
    });
  } catch {
    return fallbackNarrative;
  }
}

function buildPreservationPrefix(
  locks?: PreservationLocks,
  hasReferenceImage?: boolean,
  hasDualAnchor?: boolean
): string {
  if (!locks) return "";
  const kept: string[] = [];
  if (locks.keepCharacter) {
    kept.push(
      hasDualAnchor
        ? "exact character identity, facial features, hair, and proportions from Reference Image 1 (Canonical Character DNA)"
        : "exact character identity, facial features, hair, and proportions"
    );
  }
  if (locks.keepPose) {
    kept.push(
      hasDualAnchor
        ? "camera angle, subject pose, and spatial framing from Reference Image 2 (Active Scene Frame)"
        : "camera angle, subject pose, and spatial framing"
    );
  }
  if (locks.keepBackground) {
    kept.push(
      hasDualAnchor
        ? "background environment, architecture, and setting geometry from Reference Image 2 (Active Scene Frame)"
        : "background environment, architecture, and setting geometry"
    );
  }
  if (kept.length === 0) return "";
  const refLead = hasDualAnchor
    ? "Using Reference Image 1 (Canonical Character DNA) and Reference Image 2 (Active Scene Frame), strictly preserve the "
    : hasReferenceImage
    ? "Using the provided reference image, strictly preserve the "
    : "Strictly preserve the ";
  return `${refLead}${kept.join("; ")}. `;
}

export interface CategorySweepItem {
  label: string;
  token: string;
}

function buildMatrixFallbackVariations(params: {
  effectiveCorePrompt: string;
  matrixAxis: ExplorationMatrixAxis;
  modSuffix: string;
  ratioSuffix: string;
  isSurgicalDelta: boolean;
  categorySweepTitle?: string;
  categorySweepOptions?: CategorySweepItem[];
}): QuadPromptVariation[] {
  const {
    effectiveCorePrompt,
    matrixAxis,
    modSuffix,
    ratioSuffix,
    isSurgicalDelta,
    categorySweepTitle,
    categorySweepOptions,
  } = params;
  const tail = `${modSuffix}${ratioSuffix}`;

  if (
    matrixAxis.startsWith("cat:") &&
    categorySweepOptions &&
    categorySweepOptions.length > 0
  ) {
    const catShort = (categorySweepTitle || "Modifier").split(" (")[0];
    return [0, 1, 2, 3].map((idx) => {
      const opt =
        categorySweepOptions[idx % categorySweepOptions.length] ||
        categorySweepOptions[0];
      const shortLabel = opt.label.split(" (")[0];
      return {
        label: `${idx + 1} • ${catShort}: ${shortLabel}`,
        prompt: `${effectiveCorePrompt} — featuring ${opt.token || opt.label}${tail}`,
      };
    });
  }

  switch (matrixAxis) {
    case "camera-angles":
      return [
        {
          label: "1 • Camera: 24mm Establishing Wide",
          prompt: `${effectiveCorePrompt} — captured as a 24mm wide establishing shot showcasing full environmental scale and spatial context${tail}`,
        },
        {
          label: "2 • Camera: 50mm Medium Editorial",
          prompt: `${effectiveCorePrompt} — captured as a 50mm eye-level medium editorial portrait balancing subject presence and surroundings${tail}`,
        },
        {
          label: "3 • Camera: 85mm Intimate Close-Up",
          prompt: `${effectiveCorePrompt} — captured with an 85mm f/1.4 portrait lens, shallow depth of field, razor-sharp focus on eyes and micro-expressions${tail}`,
        },
        {
          label: "4 • Camera: 35mm Low-Angle Hero",
          prompt: `${effectiveCorePrompt} — captured from a dramatic 35mm low-angle hero perspective looking upward with dynamic foreshortening${tail}`,
        },
      ];

    case "lighting-setups":
      return [
        {
          label: "1 • Light: Golden Hour Rim",
          prompt: `${effectiveCorePrompt} — bathed in warm late-afternoon golden-hour sunlight with luminous rim highlights and long atmospheric shadows${tail}`,
        },
        {
          label: "2 • Light: Chiaroscuro Noir",
          prompt: `${effectiveCorePrompt} — lit with high-contrast chiaroscuro key lighting, deep sculpted shadows, and moody cinematic drama${tail}`,
        },
        {
          label: "3 • Light: Diffused Overcast Mist",
          prompt: `${effectiveCorePrompt} — illuminated by soft overcast skylight filtering through atmospheric mist with delicate tonal gradations${tail}`,
        },
        {
          label: "4 • Light: Dual-Tone Neon & Amber",
          prompt: `${effectiveCorePrompt} — lit with cybernetic dual-tone cyan key light and warm amber practical reflections on surfaces${tail}`,
        },
      ];

    case "wardrobe-variants":
      return [
        {
          label: "1 • Wardrobe: Tailored Technical",
          prompt: `${effectiveCorePrompt} — dressed in bespoke structured technical outerwear with matte ballistic fabric, brass fasteners, and layered collar${tail}`,
        },
        {
          label: "2 • Wardrobe: Ceremonial Artisanal",
          prompt: `${effectiveCorePrompt} — wearing draped artisanal garments with embroidered raw silk, weathered leather strapping, and heirloom textures${tail}`,
        },
        {
          label: "3 • Wardrobe: Minimalist Avant-Garde",
          prompt: `${effectiveCorePrompt} — styled in sculptural minimalist avant-garde monochrome tailoring with clean architectural silhouettes${tail}`,
        },
        {
          label: "4 • Wardrobe: Weathered Field Gear",
          prompt: `${effectiveCorePrompt} — outfitted in lived-in expedition field attire with waxed canvas, patina metal clasps, and rain-worn travel cloak${tail}`,
        },
      ];

    case "storyboard-4":
      return [
        {
          label: "1 • Beat I: Arrival & Establishing",
          prompt: `${effectiveCorePrompt} — Storyboard Frame 1 (Opening Beat): The subject arrives and surveys the environment in an establishing wide composition${tail}`,
        },
        {
          label: "2 • Beat II: Tension & Discovery",
          prompt: `${effectiveCorePrompt} — Storyboard Frame 2 (Rising Action): Medium tracking shot as the subject notices a key detail and prepares to act${tail}`,
        },
        {
          label: "3 • Beat III: Decisive Climax",
          prompt: `${effectiveCorePrompt} — Storyboard Frame 3 (Climax Beat): Dynamic close-range action angle capturing the peak emotional and kinetic moment${tail}`,
        },
        {
          label: "4 • Beat IV: Aftermath & Horizon",
          prompt: `${effectiveCorePrompt} — Storyboard Frame 4 (Resolution Beat): Contemplative pull-back shot in the aftermath with lingering atmospheric mood${tail}`,
        },
      ];

    case "auto-director":
    default:
      if (isSurgicalDelta) {
        return [
          {
            label: "1 • Surgical Edit: Direct Precision",
            prompt: `${effectiveCorePrompt}${tail}`,
          },
          {
            label: "2 • Surgical Edit: Subtle Nuance",
            prompt: `${effectiveCorePrompt} — executed with subtle, seamless photographic integration and natural lighting continuity${tail}`,
          },
          {
            label: "3 • Surgical Edit: Bold Art Direction",
            prompt: `${effectiveCorePrompt} — executed with bold editorial contrast, heightened atmospheric mood, and rich material definition${tail}`,
          },
          {
            label: "4 • Surgical Edit: Fine Detail & Texture",
            prompt: `${effectiveCorePrompt} — executed with ultra-crisp micro-textures, refined surface reflections, and optical clarity${tail}`,
          },
        ];
      }
      return [
        {
          label: "1 • Base Prompt",
          prompt: `${effectiveCorePrompt}${tail}`,
        },
        {
          label: "2 • Emphasis: Light & Atmosphere",
          prompt: `${effectiveCorePrompt} — with dramatic focus on volumetric lighting, shadow contrast, immersive atmosphere, and cinematic color grading${tail}`,
        },
        {
          label: "3 • Emphasis: Composition & Lens",
          prompt: `${effectiveCorePrompt} — with emphasis on dynamic editorial framing, lens perspective, depth of field, and spatial scene geometry${tail}`,
        },
        {
          label: "4 • Emphasis: Texture & Details",
          prompt: `${effectiveCorePrompt} — with maximum emphasis on surface micro-textures, material sharpness, subject expression, and fine detail richness${tail}`,
        },
      ];
  }
}

/**
 * Generates 4 prompt variations tailored to the selected CreationFlowMode
 * ("compose" vs. "surgical-delta"), ExplorationMatrixAxis, and PreservationLocks.
 */
export async function generateFourPromptVariations(params: {
  apiKey: string;
  basePrompt: string;
  modifierLabels?: string[];
  aspectRatio?: string;
  flowMode?: CreationFlowMode;
  matrixAxis?: ExplorationMatrixAxis;
  preservationLocks?: PreservationLocks;
  anchorScenePrompt?: string;
  hasReferenceImage?: boolean;
  hasDualAnchor?: boolean;
  categorySweepTitle?: string;
  categorySweepOptions?: CategorySweepItem[];
}): Promise<QuadPromptVariation[]> {
  const cleanBase = params.basePrompt.trim();
  const flowMode: CreationFlowMode = params.flowMode || "compose";
  const matrixAxis: ExplorationMatrixAxis = params.matrixAxis || "auto-director";
  const isSurgicalDelta = flowMode === "surgical-delta";

  const ratioSuffix = params.aspectRatio
    ? ` (Aspect Ratio ${params.aspectRatio})`
    : "";
  const modSuffix =
    params.modifierLabels && params.modifierLabels.length > 0
      ? `, ${params.modifierLabels.join(", ")}`
      : "";

  const lockPrefix = buildPreservationPrefix(
    params.preservationLocks,
    params.hasReferenceImage,
    params.hasDualAnchor
  );

  const effectiveCorePrompt = isSurgicalDelta
    ? `${lockPrefix}Apply ONLY this targeted modification: ${cleanBase}${
        params.anchorScenePrompt
          ? ` (Anchor scene context: ${params.anchorScenePrompt})`
          : ""
      }`
    : `${lockPrefix}${cleanBase}`;

  const fallbackVariations = buildMatrixFallbackVariations({
    effectiveCorePrompt,
    matrixAxis,
    modSuffix,
    ratioSuffix,
    isSurgicalDelta,
    categorySweepTitle: params.categorySweepTitle,
    categorySweepOptions: params.categorySweepOptions,
  });

  const trimmedKey = params.apiKey.trim();
  if (!trimmedKey) {
    return fallbackVariations;
  }

  try {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const axisInstructionMap: Record<string, string> = {
      "auto-director": isSurgicalDelta
        ? "Create 4 surgical edit prompts that apply the requested delta while respecting all preservation locks: (1) Direct Precision, (2) Subtle Integration, (3) Bold Art Direction, (4) Micro-Detail & Material Focus."
        : "Keep Variation 1 faithful to the user's base scene, and create 3 distinct directorial emphases: (2) Lighting & Atmosphere, (3) Camera Optics & Framing, (4) Material Texture & Subject Detail.",
      "camera-angles":
        "Create 4 variations of the exact same scene and character across 4 distinct cinema camera setups: (1) 24mm Establishing Wide Shot, (2) 50mm Medium Eye-Level Editorial, (3) 85mm Intimate Close-Up Portrait, (4) 35mm Dramatic Low-Angle Hero Shot.",
      "lighting-setups":
        "Create 4 variations of the exact same scene and composition across 4 distinct lighting designs: (1) Golden Hour Rim Sunlight, (2) High-Contrast Chiaroscuro Noir, (3) Soft Diffused Overcast Mist, (4) Dual-Tone Cybernetic Neon & Warm Practicals.",
      "wardrobe-variants":
        "Preserve the exact same character face, pose, camera angle, and background, but explore 4 distinct wardrobe/costume designs: (1) Structured Technical Outerwear, (2) Artisanal Ceremonial Draped Silk & Leather, (3) Minimalist Avant-Garde Tailoring, (4) Weathered Expedition Field Gear.",
      "storyboard-4":
        "Create a cohesive 4-frame sequential storyboard starring the exact same character in the same world: (1) Beat I: Arrival / Establishing, (2) Beat II: Discovery / Rising Tension, (3) Beat III: Decisive Action Climax, (4) Beat IV: Contemplative Aftermath.",
    };

    const customCategoryInstruction =
      matrixAxis.startsWith("cat:") &&
      params.categorySweepOptions &&
      params.categorySweepOptions.length > 0
        ? `Create 4 variations of the exact same scene and character, testing these 4 specific "${
            params.categorySweepTitle || "Modifier"
          }" options across the 4 frames: ${[0, 1, 2, 3]
            .map((i) => {
              const opt =
                params.categorySweepOptions![
                  i % params.categorySweepOptions!.length
                ];
              return `(${i + 1}) ${opt.label}: "${opt.token}"`;
            })
            .join(", ")}.`
        : axisInstructionMap[matrixAxis] || axisInstructionMap["auto-director"];

    const systemPrompt = [
      "You are an expert Visual Director and Prompt Engineer for Google Gemini 2.5 Flash Image ('Nano Banana').",
      customCategoryInstruction,
      lockPrefix ? `Mandatory preservation rule for all 4 prompts: "${lockPrefix.trim()}"` : "",
      isSurgicalDelta && params.anchorScenePrompt
        ? `Original anchor scene context: "${params.anchorScenePrompt}"`
        : "",
      params.aspectRatio ? `Image aspect ratio: ${params.aspectRatio}.` : "",
      params.modifierLabels?.length
        ? `Active optical/scene modifiers: ${params.modifierLabels.join(", ")}.`
        : "",
      'Return ONLY valid JSON in the format: {"variations": [{"label": "1 • Short Title", "prompt": "Complete descriptive English prompt..."}, {"label": "2 • Short Title", "prompt": "..."}, {"label": "3 • Short Title", "prompt": "..."}, {"label": "4 • Short Title", "prompt": "..."}]}',
      isSurgicalDelta
        ? `User surgical edit delta instruction: "${cleanBase}"`
        : `User scene prompt: "${cleanBase}"`,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": trimmedKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return fallbackVariations;
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const rawText =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim() || "";

    if (!rawText) return fallbackVariations;

    const parsed = JSON.parse(rawText) as {
      variations?: Array<{ label?: string; title?: string; prompt?: string }>;
    };

    const vList = Array.isArray(parsed.variations) ? parsed.variations : [];
    if (vList.length < 4) {
      return fallbackVariations;
    }

    return [0, 1, 2, 3].map((idx) => {
      const item = vList[idx];
      const rawLabel = (item?.label || item?.title || "").trim();
      const numberedLabel = rawLabel
        ? /^\d/.test(rawLabel)
          ? rawLabel
          : `${idx + 1} • ${rawLabel}`
        : fallbackVariations[idx].label;
      return {
        label: numberedLabel,
        prompt: (item?.prompt || fallbackVariations[idx].prompt).trim(),
      };
    });
  } catch {
    return fallbackVariations;
  }
}

export async function generateQuadWithNanoBanana(params: {
  apiKey: string;
  model: GenerateNanoBananaRequest["model"];
  basePrompt: string;
  modifierLabels?: string[];
  aspectRatio?: string;
  referenceImage?: InlineImagePart | null;
  secondaryReferenceImage?: InlineImagePart | null;
  flowMode?: CreationFlowMode;
  matrixAxis?: ExplorationMatrixAxis;
  preservationLocks?: PreservationLocks;
  anchorScenePrompt?: string;
  categorySweepTitle?: string;
  categorySweepOptions?: CategorySweepItem[];
  onVariationsReady?: (variations: QuadPromptVariation[]) => void;
  onSlotCompleted?: (index: number, slot: QuadGeneratedSlot) => void;
}): Promise<QuadGeneratedSlot[]> {
  const hasDualAnchor =
    Boolean(params.referenceImage?.data) &&
    Boolean(params.secondaryReferenceImage?.data);

  const variations = await generateFourPromptVariations({
    apiKey: params.apiKey,
    basePrompt: params.basePrompt,
    modifierLabels: params.modifierLabels,
    aspectRatio: params.aspectRatio,
    flowMode: params.flowMode,
    matrixAxis: params.matrixAxis,
    preservationLocks: params.preservationLocks,
    anchorScenePrompt: params.anchorScenePrompt,
    hasReferenceImage: Boolean(params.referenceImage?.data),
    hasDualAnchor,
    categorySweepTitle: params.categorySweepTitle,
    categorySweepOptions: params.categorySweepOptions,
  });

  if (params.onVariationsReady) {
    params.onVariationsReady(variations);
  }

  const trimmedKey = params.apiKey.trim();
  if (!trimmedKey) {
    // Do NOT create mocked images — leave imageUrl empty when no API key is configured
    return variations.map((v) => ({
      label: v.label,
      prompt: v.prompt,
      imageUrl: "",
      mimeType: "image/png",
      base64Data: "",
    }));
  }

  const settled = await Promise.allSettled(
    variations.map(async (v, idx) => {
      const result = await generateWithNanoBanana({
        apiKey: trimmedKey,
        model: params.model,
        prompt: v.prompt,
        referenceImage: params.referenceImage,
        secondaryReferenceImage: params.secondaryReferenceImage,
      });
      const completedSlot: QuadGeneratedSlot = {
        label: v.label,
        prompt: v.prompt,
        imageUrl: result.imageDataUrl,
        mimeType: result.mimeType,
        base64Data: result.base64Data,
      };
      if (params.onSlotCompleted) {
        params.onSlotCompleted(idx, completedSlot);
      }
      return completedSlot;
    })
  );

  return variations.map((v, idx) => {
    const res = settled[idx];
    if (res.status === "fulfilled") {
      return res.value;
    }
    return {
      label: v.label,
      prompt: v.prompt,
      imageUrl: "",
      mimeType: "image/png",
      base64Data: "",
    };
  });
}

/**
 * Ensures a prompt string contains all active creation parameters (reference preservation
 * locks, selected modifiers, and target aspect ratio) idempotently without
 * duplicating clauses that are already present in the text.
 */
export function finalizeExactImageModelPrompt(params: {
  prompt: string;
  modifierLabels?: string[];
  aspectRatio?: string;
  preservationLocks?: PreservationLocks;
  hasReferenceImage?: boolean;
}): string {
  let result = params.prompt.trim();
  if (!result) return "";

  const lockPrefix = params.hasReferenceImage
    ? buildPreservationPrefix(params.preservationLocks, true, false)
    : "";

  if (lockPrefix && !/strictly preserve the/i.test(result)) {
    result = `${lockPrefix}${result}`;
  }

  const missingModifiers = (params.modifierLabels || []).filter(
    (mod) =>
      mod.trim() && !result.toLowerCase().includes(mod.trim().toLowerCase())
  );
  if (missingModifiers.length > 0) {
    const hadTrailingDot = /\.\s*$/.test(result);
    const withoutTrailingDot = result.replace(/\s*\.+$/, "");
    result = `${withoutTrailingDot}, ${missingModifiers.join(", ")}${
      hadTrailingDot ? "." : ""
    }`;
  }

  if (params.aspectRatio?.trim()) {
    const escapedRatio = params.aspectRatio
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hasRatio = new RegExp(`aspect\\s*ratio\\s*${escapedRatio}`, "i").test(
      result
    );
    if (!hasRatio) {
      result = `${result} (Aspect Ratio ${params.aspectRatio.trim()})`;
    }
  }

  return result.trim();
}

function stripTrailingPromptTags(text: string): string {
  return text
    .replace(/\s*\(Aspect Ratio [^)]+\)\s*$/i, "")
    .replace(/\s*\[[^\]]+\]\s*$/, "")
    .trim();
}

/**
 * Builds a single consolidated prompt combining optional preservation locks,
 * core prompt text, selected modifiers, and target aspect ratio.
 */
export function buildConsolidatedScenePrompt(params: {
  basePrompt: string;
  modifierLabels?: string[];
  aspectRatio?: string;
  preservationLocks?: PreservationLocks;
  hasReferenceImage?: boolean;
}): string {
  return finalizeExactImageModelPrompt({
    prompt: params.basePrompt,
    modifierLabels: params.modifierLabels,
    aspectRatio: params.aspectRatio,
    preservationLocks: params.preservationLocks,
    hasReferenceImage: params.hasReferenceImage,
  });
}

const DYNAMIC_VARIATION_ARCHETYPES: Array<{
  title: string;
  emphasis: string;
}> = [
  {
    title: "Faithful Core Scene",
    emphasis: "",
  },
  {
    title: "Lighting & Atmosphere",
    emphasis:
      " — with heightened focus on volumetric lighting, sculpted shadow contrast, and atmospheric color depth",
  },
  {
    title: "Optical Framing & Depth",
    emphasis:
      " — composed with intentional cinema lens perspective, layered foreground-to-background depth, and crisp spatial geometry",
  },
  {
    title: "Material & Micro-Texture",
    emphasis:
      " — emphasizing tactile fabric weave, surface micro-textures, specular reflections, and expressive subject detail",
  },
  {
    title: "Wide Environmental Scale",
    emphasis:
      " — captured as an expansive 24mm establishing composition revealing surrounding architecture and horizon atmosphere",
  },
  {
    title: "Intimate Portrait Focus",
    emphasis:
      " — framed on an 85mm f/1.4 portrait lens with creamy bokeh isolating facial expression and nuanced gaze",
  },
  {
    title: "Dynamic Low-Angle Hero",
    emphasis:
      " — shot from a dramatic 35mm upward hero angle imparting monumental presence and kinetic visual tension",
  },
  {
    title: "Editorial Color & Contrast",
    emphasis:
      " — styled with bold editorial tonal contrast, rich shadow density, and warm-cool chromatic counterpoint",
  },
];

/**
 * Generates `count` (1..8) distinct creative prompt variations via Gemini 2.5 Flash
 * for Step 3 review, returning the exact model-ready prompt string for each frame.
 */
export async function generatePromptVariationsWithGemini(params: {
  apiKey: string;
  count: number;
  basePrompt: string;
  modifierLabels?: string[];
  aspectRatio?: string;
  preservationLocks?: PreservationLocks;
  hasReferenceImage?: boolean;
  customSystemPrompt?: string;
}): Promise<QuadPromptVariation[]> {
  const safeCount = Math.max(1, Math.min(8, Math.round(params.count || 4)));
  const cleanBase = params.basePrompt.trim();
  const narrativeCore = stripTrailingPromptTags(cleanBase);
  const lockPrefix = params.hasReferenceImage
    ? buildPreservationPrefix(params.preservationLocks, true, false)
    : "";

  const fallbackList: QuadPromptVariation[] = Array.from(
    { length: safeCount },
    (_, idx) => {
      const archetype =
        DYNAMIC_VARIATION_ARCHETYPES[idx % DYNAMIC_VARIATION_ARCHETYPES.length];
      const candidate = `${narrativeCore}${archetype.emphasis}`.trim();
      return {
        label: `${idx + 1} • ${archetype.title}`,
        prompt: finalizeExactImageModelPrompt({
          prompt: candidate,
          modifierLabels: params.modifierLabels,
          aspectRatio: params.aspectRatio,
          preservationLocks: params.preservationLocks,
          hasReferenceImage: params.hasReferenceImage,
        }),
      };
    }
  );

  const trimmedKey = params.apiKey.trim();
  if (!trimmedKey || !cleanBase) {
    return fallbackList;
  }

  try {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const resolvedInstruction = interpolatePromptTemplate(
      params.customSystemPrompt?.trim() || DEFAULT_VARIATION_SYSTEM_PROMPT,
      {
        count: String(safeCount),
        prompt: narrativeCore,
        modifiers: params.modifierLabels?.join(", ") || "",
        aspect_ratio: params.aspectRatio || "",
      }
    );

    const systemPrompt = [
      resolvedInstruction,
      `Generate exactly ${safeCount} distinct variations.`,
      lockPrefix
        ? `Mandatory reference preservation rule for ALL ${safeCount} prompts: "${lockPrefix.trim()}"`
        : "",
      params.aspectRatio ? `Target aspect ratio: ${params.aspectRatio}.` : "",
      params.modifierLabels?.length
        ? `Incorporate these active modifiers naturally: ${params.modifierLabels.join(", ")}.`
        : "",
      `Return ONLY valid JSON with an array of ${safeCount} items in the exact format: {"variations": [{"label": "1 • Short Title", "prompt": "Complete descriptive English scene prompt..."}]}`,
      `Base prompt: "${narrativeCore}"`,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": trimmedKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return fallbackList;
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const rawText =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim() || "";

    if (!rawText) return fallbackList;

    const parsed = JSON.parse(rawText) as {
      variations?: Array<{ label?: string; title?: string; prompt?: string }>;
    };
    const vList = Array.isArray(parsed.variations) ? parsed.variations : [];
    if (vList.length === 0) {
      return fallbackList;
    }

    return Array.from({ length: safeCount }, (_, idx) => {
      const item = vList[idx];
      const rawLabel = (item?.label || item?.title || "").trim();
      const numberedLabel = rawLabel
        ? /^\d/.test(rawLabel)
          ? rawLabel
          : `${idx + 1} • ${rawLabel}`
        : fallbackList[idx].label;
      const rawCandidate = item?.prompt?.trim();
      return {
        label: numberedLabel,
        prompt: rawCandidate
          ? finalizeExactImageModelPrompt({
              prompt: rawCandidate,
              modifierLabels: params.modifierLabels,
              aspectRatio: params.aspectRatio,
              preservationLocks: params.preservationLocks,
              hasReferenceImage: params.hasReferenceImage,
            })
          : fallbackList[idx].prompt,
      };
    });
  } catch {
    return fallbackList;
  }
}

/**
 * Renders an arbitrary list of 1..8 prepared prompts in parallel via Gemini 2.5 Flash Image,
 * streaming individual slot completions via `onSlotCompleted`.
 */
export async function renderPreparedBatchWithNanoBanana(params: {
  apiKey: string;
  model: GenerateNanoBananaRequest["model"];
  items: QuadPromptVariation[];
  referenceImage?: InlineImagePart | null;
  secondaryReferenceImage?: InlineImagePart | null;
  modelParams?: ModelGenerationParams;
  onSlotCompleted?: (index: number, slot: QuadGeneratedSlot) => void;
}): Promise<QuadGeneratedSlot[]> {
  const safeItems =
    params.items.length > 0
      ? params.items
      : [{ label: "1 • Generated Frame", prompt: "Scene composition" }];

  const trimmedKey = params.apiKey.trim();
  if (!trimmedKey) {
    return safeItems.map((item) => ({
      label: item.label,
      prompt: item.prompt,
      imageUrl: "",
      mimeType: "image/png",
      base64Data: "",
    }));
  }

  const settled = await Promise.allSettled(
    safeItems.map(async (item, idx) => {
      const result = await generateWithNanoBanana({
        apiKey: trimmedKey,
        model: params.model,
        prompt: item.prompt,
        referenceImage: params.referenceImage,
        secondaryReferenceImage: params.secondaryReferenceImage,
        modelParams: params.modelParams,
      });
      const completedSlot: QuadGeneratedSlot = {
        label: item.label,
        prompt: item.prompt,
        imageUrl: result.imageDataUrl,
        mimeType: result.mimeType,
        base64Data: result.base64Data,
      };
      if (params.onSlotCompleted) {
        params.onSlotCompleted(idx, completedSlot);
      }
      return completedSlot;
    })
  );

  return safeItems.map((item, idx) => {
    const res = settled[idx];
    if (res.status === "fulfilled") {
      return res.value;
    }
    return {
      label: item.label,
      prompt: item.prompt,
      imageUrl: "",
      mimeType: "image/png",
      base64Data: "",
    };
  });
}

export function simulateNanoBananaTurn(
  turnNumber: number,
  _prompt: string
): GenerateNanoBananaResult {
  return {
    imageDataUrl: "",
    mimeType: "image/png",
    base64Data: "",
    modelText: `Turn #${turnNumber}`,
    modelUsed: "gemini-2.5-flash-image",
    mode: "simulation",
  };
}

export function getShowcaseFallbackDataUrl(_srcPath: string): string {
  return "";
}

function slugifyId(text: string, prefix: string): string {
  const clean = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return clean || `${prefix}-${Date.now().toString(36)}`;
}

function buildFallbackCategories(
  instruction: string,
  targetCategoryTitle?: string
): ModifierCategory[] {
  const clean = instruction.trim() || "Cinematic Art Direction";
  const categoryTitle =
    targetCategoryTitle?.trim() ||
    (clean.length <= 32 ? clean : `AI • ${clean.slice(0, 26)}`);
  const catId = slugifyId(categoryTitle, "cat");
  const stamp = Date.now().toString(36).slice(-4);

  const options: ModifierOption[] = [
    {
      id: `${catId}-editorial-${stamp}-1`,
      label: `${clean.slice(0, 22)} • Editorial Prime`,
      token: `${clean}, crisp editorial framing, refined material definition and high-contrast visual balance`,
    },
    {
      id: `${catId}-cinematic-${stamp}-2`,
      label: `${clean.slice(0, 22)} • Dramatic Atmosphere`,
      token: `${clean}, dramatic volumetric lighting, deep atmospheric perspective and expressive texture`,
    },
    {
      id: `${catId}-minimal-${stamp}-3`,
      label: `${clean.slice(0, 22)} • Sculptural Minimal`,
      token: `${clean}, clean sculptural silhouette, intentional negative space and studio precision`,
    },
    {
      id: `${catId}-kinetic-${stamp}-4`,
      label: `${clean.slice(0, 22)} • Kinetic Motion`,
      token: `${clean}, kinetic diagonal tension, natural motion energy and authentic documentary detail`,
    },
  ];

  return [
    {
      id: `${catId}-${stamp}`,
      title: categoryTitle,
      options,
    },
  ];
}

/**
 * Uses Gemini 2.5 Flash to generate either:
 * - New Modifier Categories with 4-5 Modifiers each (when `targetCategoryTitle` is omitted), OR
 * - New Modifiers tailored to a specific existing Category (when `targetCategoryTitle` is provided).
 */
export async function generateModifiersWithGemini(params: {
  apiKey: string;
  instruction: string;
  targetCategoryTitle?: string;
}): Promise<{ categories: ModifierCategory[]; usedAiApi: boolean }> {
  const trimmedKey = params.apiKey.trim();
  const cleanInstruction = params.instruction.trim();
  const fallback = buildFallbackCategories(
    cleanInstruction,
    params.targetCategoryTitle
  );

  if (!trimmedKey) {
    return { categories: fallback, usedAiApi: false };
  }

  try {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const systemTask = params.targetCategoryTitle
      ? `You are a visual art-direction assistant for an AI image studio.
The user wants to generate new visual modifiers for the existing category "${params.targetCategoryTitle}" based on this request: "${cleanInstruction}".
Return ONLY a valid JSON array with 1 category object matching this exact schema:
[
  {
    "title": "${params.targetCategoryTitle}",
    "options": [
      {
        "label": "Short English display name (max 28 chars)",
        "token": "Detailed English visual prompt modifier phrase to append to image generation prompts (10-18 words)"
      }
    ]
  }
]
Generate 4 distinct, high-craft options.`
      : `You are a visual art-direction assistant for an AI image studio.
The user wants to create new modifier categories and modifiers based on this request: "${cleanInstruction}" (examples of categories: Camera & Lens, Clothing & Wardrobe, Angle & Framing, Lighting, Pose, Environment, Texture, etc.).
Return ONLY a valid JSON array of 1 to 3 category objects matching this exact schema:
[
  {
    "title": "Category Title in English (e.g. Cyberpunk Wardrobe, Cinematic Angles, etc.)",
    "options": [
      {
        "label": "Short English display name (max 28 chars)",
        "token": "Detailed English visual prompt modifier phrase to append to image generation prompts (10-18 words)"
      }
    ]
  }
]
Each category must contain 4 distinct, high-craft options.`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": trimmedKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemTask }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.75,
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return { categories: fallback, usedAiApi: false };
    }

    const data = (await res.json()) as GeminiGenerateContentResponse;
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(rawText) as Array<{
      title?: string;
      options?: Array<{ label?: string; token?: string }>;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { categories: fallback, usedAiApi: false };
    }

    const stamp = Date.now().toString(36).slice(-4);
    const normalized: ModifierCategory[] = parsed
      .map((cat, cIdx) => {
        const title = String(
          cat.title || params.targetCategoryTitle || `AI Category #${cIdx + 1}`
        ).trim();
        const catSlug = slugifyId(title, `cat-${cIdx}`);
        const opts: ModifierOption[] = Array.isArray(cat.options)
          ? cat.options
              .filter((o) => o && (o.label || o.token))
              .map((o, oIdx) => {
                const label = String(o.label || `Modifier #${oIdx + 1}`).trim();
                const token = String(o.token || label).trim();
                return {
                  id: `${catSlug}-${slugifyId(label, `mod-${oIdx}`)}-${stamp}-${oIdx}`,
                  label,
                  token,
                };
              })
          : [];
        return {
          id: `${catSlug}-${stamp}-${cIdx}`,
          title,
          options: opts,
        };
      })
      .filter((c) => c.options.length > 0);

    if (normalized.length === 0) {
      return { categories: fallback, usedAiApi: false };
    }

    return { categories: normalized, usedAiApi: true };
  } catch {
    return { categories: fallback, usedAiApi: false };
  }
}
