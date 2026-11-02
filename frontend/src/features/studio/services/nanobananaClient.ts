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
    ? ` (Proporção ${params.aspectRatio})`
    : "";
  const modSuffix =
    params.modifierLabels && params.modifierLabels.length > 0
      ? `, ${params.modifierLabels.join(", ")}`
      : "";

  const fallbackVariations: QuadPromptVariation[] = [
    {
      label: "1 • Prompt Base",
      prompt: `${cleanBase}${styleSuffix}${modSuffix}${ratioSuffix}`,
    },
    {
      label: "2 • Ênfase: Luz & Atmosfera",
      prompt: `${cleanBase} — com foco dramático na iluminação volumétrica, contraste de sombras, atmosfera imersiva e gradação de cor cinematográfica${styleSuffix}${modSuffix}${ratioSuffix}`,
    },
    {
      label: "3 • Ênfase: Composição & Lente",
      prompt: `${cleanBase} — com ênfase no enquadramento editorial dinâmico, perspectiva de lente, profundidade de campo e geometria espacial da cena${styleSuffix}${modSuffix}${ratioSuffix}`,
    },
    {
      label: "4 • Ênfase: Textura & Detalhes",
      prompt: `${cleanBase} — com ênfase máxima em micro-texturas de superfície, nitidez de materiais, expressão do sujeito e riqueza de detalhes finos${styleSuffix}${modSuffix}${ratioSuffix}`,
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
      "Você é um especialista em engenharia de prompts visuais para geração de imagens.",
      "Analise o prompt base do usuário e identifique 3 partes ou elementos distintos da cena descrita.",
      "Crie 3 novas versões completas do prompt (mantendo o idioma do usuário), cada uma dando ênfase especial a uma dessas partes da cena.",
      params.styleLabel ? `Estilo visual selecionado: ${params.styleLabel}.` : "",
      params.aspectRatio
        ? `Proporção da imagem (Aspect Ratio): ${params.aspectRatio}.`
        : "",
      params.modifierLabels?.length
        ? `Modificadores ativos: ${params.modifierLabels.join(", ")}.`
        : "",
      'Retorne APENAS um JSON válido no formato: {"variations": [{"title": "curto título da ênfase 1 (máx 3 palavras)", "prompt": "..."}, {"title": "curto título da ênfase 2 (máx 3 palavras)", "prompt": "..."}, {"title": "curto título da ênfase 3 (máx 3 palavras)", "prompt": "..."}]}',
      `Prompt base do usuário: "${cleanBase}"`,
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
        label: "1 • Prompt Base",
        prompt: `${cleanBase}${styleSuffix}${modSuffix}${ratioSuffix}`,
      },
      {
        label: vList[0]?.title
          ? `2 • Ênfase: ${vList[0].title}`
          : fallbackVariations[1].label,
        prompt: (
          vList[0]?.prompt ||
          parsed.v1 ||
          fallbackVariations[1].prompt
        ).trim(),
      },
      {
        label: vList[1]?.title
          ? `3 • Ênfase: ${vList[1].title}`
          : fallbackVariations[2].label,
        prompt: (
          vList[1]?.prompt ||
          parsed.v2 ||
          fallbackVariations[2].prompt
        ).trim(),
      },
      {
        label: vList[2]?.title
          ? `4 • Ênfase: ${vList[2].title}`
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
}): Promise<QuadGeneratedSlot[]> {
  const variations = await generateFourPromptVariations({
    apiKey: params.apiKey,
    basePrompt: params.basePrompt,
    styleLabel: params.styleLabel,
    modifierLabels: params.modifierLabels,
    aspectRatio: params.aspectRatio,
  });

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
    variations.map((v) =>
      generateWithNanoBanana({
        apiKey: trimmedKey,
        model: params.model,
        prompt: v.prompt,
        referenceImage: params.referenceImage,
      })
    )
  );

  return variations.map((v, idx) => {
    const res = settled[idx];
    if (res.status === "fulfilled") {
      return {
        label: v.label,
        prompt: v.prompt,
        imageUrl: res.value.imageDataUrl,
        mimeType: res.value.mimeType,
        base64Data: res.value.base64Data,
      };
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
