/**
 * Nano Banana Direct Browser Client (Zero-Storage Architecture)
 *
 * SECURITY INVARIANT:
 * - The user's Gemini API key is passed as an in-memory function argument from React `useState`.
 * - It is NEVER written to persistent storage or sent to any backend server.
 * - All requests go directly from the user's browser to Google's Generative Language API.
 */

import {
  GenerateNanoBananaRequest,
  GenerateNanoBananaResult,
  InlineImagePart,
  ModifierCategory,
  ModifierOption,
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

  parts.push({
    text: prompt,
  });

  const payload = {
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": trimmedKey,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

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

/**
 * Takes the user's base prompt and asks Gemini to create 3 additional versions
 * with different emphases on each part of the prompt (Lighting/Atmosphere,
 * Composition/Camera, and Details/Subject), returning 4 prompts total.
 */
export async function generateFourPromptVariations(params: {
  apiKey: string;
  basePrompt: string;
  styleLabel?: string;
  modifierLabels?: string[];
  aspectRatio?: string;
}): Promise<QuadPromptVariation[]> {
  const cleanBase = params.basePrompt.trim();
  const styleSuffix = params.styleLabel ? ` [${params.styleLabel}]` : "";
  const ratioSuffix = params.aspectRatio
    ? ` (Aspect Ratio ${params.aspectRatio})`
    : "";
  const modSuffix =
    params.modifierLabels && params.modifierLabels.length > 0
      ? `, ${params.modifierLabels.join(", ")}`
      : "";

  const fallbackVariations: QuadPromptVariation[] = [
    {
      label: "1 • Base Prompt",
      prompt: `${cleanBase}${styleSuffix}${modSuffix}${ratioSuffix}`,
    },
    {
      label: "2 • Emphasis: Light & Atmosphere",
      prompt: `${cleanBase} — with dramatic focus on volumetric lighting, shadow contrast, immersive atmosphere, and cinematic color grading${styleSuffix}${modSuffix}${ratioSuffix}`,
    },
    {
      label: "3 • Emphasis: Composition & Lens",
      prompt: `${cleanBase} — with emphasis on dynamic editorial framing, lens perspective, depth of field, and spatial scene geometry${styleSuffix}${modSuffix}${ratioSuffix}`,
    },
    {
      label: "4 • Emphasis: Texture & Details",
      prompt: `${cleanBase} — with maximum emphasis on surface micro-textures, material sharpness, subject expression, and fine detail richness${styleSuffix}${modSuffix}${ratioSuffix}`,
    },
  ];

  const trimmedKey = params.apiKey.trim();
  if (!trimmedKey) {
    return fallbackVariations;
  }

  try {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    const systemPrompt = [
      "You are an expert in visual prompt engineering for image generation.",
      "Analyze the user's base prompt and identify 3 distinct parts or elements of the described scene.",
      "Create 3 complete new versions of the prompt (in English), each giving special emphasis to one of those parts of the scene.",
      params.styleLabel ? `Selected visual style: ${params.styleLabel}.` : "",
      params.aspectRatio
        ? `Image aspect ratio: ${params.aspectRatio}.`
        : "",
      params.modifierLabels?.length
        ? `Active modifiers: ${params.modifierLabels.join(", ")}.`
        : "",
      'Return ONLY valid JSON in the format: {"variations": [{"title": "short emphasis title 1 (max 3 words)", "prompt": "..."}, {"title": "short emphasis title 2 (max 3 words)", "prompt": "..."}, {"title": "short emphasis title 3 (max 3 words)", "prompt": "..."}]}',
      `User base prompt: "${cleanBase}"`,
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
      variations?: Array<{ title?: string; prompt?: string }>;
      v1?: string;
      v2?: string;
      v3?: string;
    };

    const vList = Array.isArray(parsed.variations) ? parsed.variations : [];

    return [
      {
        label: "1 • Base Prompt",
        prompt: `${cleanBase}${styleSuffix}${modSuffix}${ratioSuffix}`,
      },
      {
        label: vList[0]?.title
          ? `2 • Emphasis: ${vList[0].title}`
          : fallbackVariations[1].label,
        prompt: (
          vList[0]?.prompt ||
          parsed.v1 ||
          fallbackVariations[1].prompt
        ).trim(),
      },
      {
        label: vList[1]?.title
          ? `3 • Emphasis: ${vList[1].title}`
          : fallbackVariations[2].label,
        prompt: (
          vList[1]?.prompt ||
          parsed.v2 ||
          fallbackVariations[2].prompt
        ).trim(),
      },
      {
        label: vList[2]?.title
          ? `4 • Emphasis: ${vList[2].title}`
          : fallbackVariations[3].label,
        prompt: (
          vList[2]?.prompt ||
          parsed.v3 ||
          fallbackVariations[3].prompt
        ).trim(),
      },
    ];
  } catch {
    return fallbackVariations;
  }
}

export async function generateQuadWithNanoBanana(params: {
  apiKey: string;
  model: GenerateNanoBananaRequest["model"];
  basePrompt: string;
  styleLabel?: string;
  modifierLabels?: string[];
  aspectRatio?: string;
  referenceImage?: InlineImagePart | null;
  onVariationsReady?: (variations: QuadPromptVariation[]) => void;
  onSlotCompleted?: (index: number, slot: QuadGeneratedSlot) => void;
}): Promise<QuadGeneratedSlot[]> {
  const variations = await generateFourPromptVariations({
    apiKey: params.apiKey,
    basePrompt: params.basePrompt,
    styleLabel: params.styleLabel,
    modifierLabels: params.modifierLabels,
    aspectRatio: params.aspectRatio,
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
