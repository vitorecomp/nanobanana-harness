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

export function simulateNanoBananaTurn(
  turnNumber: number,
  prompt: string
): GenerateNanoBananaResult {
  const lower = prompt.toLowerCase();

  let selectedPath = "/showcase/step-1-base.png";
  let note =
    "Interactive Simulation Turn #1: Base concept rendered in Editorial Anime style with crisp cel-shaded linework.";

  if (
    turnNumber >= 3 ||
    lower.includes("neon") ||
    lower.includes("cyber") ||
    lower.includes("rain") ||
    lower.includes("acid") ||
    lower.includes("visor")
  ) {
    selectedPath = "/showcase/step-3-cyber.png";
    note =
      "Multi-Turn Interactive Simulation: Added acid-yellow (#F2FA3C) tactical visor, nocturnal Tokyo atmosphere, and rain reflections while preserving character identity.";
  } else if (
    turnNumber === 2 ||
    lower.includes("golden") ||
    lower.includes("sunset") ||
    lower.includes("dramatic") ||
    lower.includes("tokyo") ||
    lower.includes("street")
  ) {
    selectedPath = "/showcase/step-2-lighting.png";
    note =
      "Multi-Turn Interactive Simulation: Lighting evolved into dramatic Golden Hour sunlight with urban street perspective in the background.";
  }

  return {
    imageDataUrl: selectedPath,
    mimeType: "image/png",
    base64Data: "",
    modelText: note,
    modelUsed: "gemini-2.5-flash-image (Simulation)",
    mode: "simulation",
  };
}

export function getShowcaseFallbackDataUrl(srcPath: string): string {
  const isStep3 = srcPath.includes("step-3") || srcPath.includes("cyber");
  const isStep2 = srcPath.includes("step-2") || srcPath.includes("lighting");

  const bg = isStep3 ? "#141824" : isStep2 ? "#D98A4E" : "#E9E7DF";
  const accent = isStep3 ? "#F2FA3C" : isStep2 ? "#FDE047" : "#5E7A6E";
  const label = isStep3
    ? "TURN #3 • ACID VISOR & NEON RAIN"
    : isStep2
    ? "TURN #2 • GOLDEN HOUR IN TOKYO"
    : "TURN #1 • EDITORIAL ANIME BASE";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
    <rect width="800" height="500" fill="${bg}"/>
    <circle cx="400" cy="230" r="165" fill="${accent}" stroke="#0B0B0B" stroke-width="5"/>
    <path d="M250 500 L300 315 Q400 285 500 315 L550 500 Z" fill="#374B4A" stroke="#0B0B0B" stroke-width="6"/>
    <circle cx="400" cy="210" r="72" fill="#FADEC8" stroke="#0B0B0B" stroke-width="6"/>
    ${
      isStep3
        ? '<rect x="336" y="188" width="128" height="32" rx="8" fill="#F2FA3C" stroke="#0B0B0B" stroke-width="4"/>'
        : '<rect x="340" y="142" width="120" height="28" rx="12" fill="#4A5568" stroke="#0B0B0B" stroke-width="4"/>'
    }
    <rect x="24" y="432" width="420" height="44" rx="22" fill="#0B0B0B"/>
    <text x="48" y="460" fill="#F2FA3C" font-family="monospace" font-weight="bold" font-size="16">${label}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
