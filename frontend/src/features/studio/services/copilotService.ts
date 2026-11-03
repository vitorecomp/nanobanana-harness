/**
 * Service for the Native Tauri v2 (Rust + Local SQLite) Interactive Co-Pilot Engine
 *
 * SECURITY INVARIANT:
 * - Never transmits the user's Gemini / Nano Banana API key to any external server.
 */

import { invokeTauriCommand } from "@/core/tauri/tauriBridge";
import {
  AnalyzePromptResponse,
  BootstrapResponse,
  RefinePromptResponse,
} from "../types/studio.types";

export const DEFAULT_BOOTSTRAP_DATA: BootstrapResponse = {
  style_presets: [
    {
      id: "editorial-anime",
      title: "Editorial Anime (Crypko)",
      description:
        "High-precision cel-shaded linework with Japanese editorial art direction, crisp ink contours, and high-contrast color blocks.",
      prompt_tokens:
        "high-craft editorial anime illustration, crisp cel-shaded linework, graphic flat shadow blocks, warm cream paper texture, dynamic character design",
      aspect_ratio: "3:4",
    },
    {
      id: "analog-35mm",
      title: "35mm Analog Photography",
      description:
        "Organic Kodak Portra 400 film grain, luminous 35mm f/1.4 optics, natural depth of field, and rich cinematic color grading.",
      prompt_tokens:
        "35mm analog film photography, Kodak Portra 400 color science, natural halation, shallow depth of field f/1.8, authentic street documentary framing",
      aspect_ratio: "4:3",
    },
    {
      id: "neo-brutalist",
      title: "Neo-Brutalist Graphic Poster",
      description:
        "Bold Swiss grid geometry, high-contrast typography, flat ink planes, and acid-yellow (#F2FA3C) accents over warm cream.",
      prompt_tokens:
        "swiss neo-brutalist graphic illustration, bold carbon black ink outlines, acid yellow #F2FA3C accents on warm bone paper, architectural framing",
      aspect_ratio: "1:1",
    },
    {
      id: "cyberpunk-3d",
      title: "Cyberpunk 3D Concept Render",
      description:
        "Dense futuristic atmosphere with volumetric lighting, wet surface reflections, and industrial techwear design.",
      prompt_tokens:
        "cinematic sci-fi concept art, volumetric atmospheric lighting, utilitarian techwear details, anamorphic lens flare, high dynamic range",
      aspect_ratio: "16:9",
    },
    {
      id: "botanical-watercolor",
      title: "Botanical Watercolor & Ink",
      description:
        "Translucent mineral pigment washes paired with fine technical dip-pen ink linework on cold-pressed cotton paper.",
      prompt_tokens:
        "botanical architectural watercolor with fine technical pen ink linework, cold-press cotton paper texture, translucent mineral pigments",
      aspect_ratio: "3:4",
    },
  ],
  modifier_categories: [
    {
      id: "camera",
      title: "Camera & Lens",
      options: [
        {
          id: "lens-35mm",
          label: "35mm Street Editorial",
          token: "35mm wide-normal lens showing character and street environment",
        },
        {
          id: "lens-85mm",
          label: "85mm f/1.4 Portrait Prime",
          token: "85mm portrait telephoto lens, creamy background separation",
        },
        {
          id: "isometric-tele",
          label: "135mm Compressed Telephoto",
          token: "135mm telephoto compression, graphic flattened background layers",
        },
        {
          id: "anamorphic-50mm",
          label: "50mm Anamorphic Cinema",
          token: "50mm anamorphic cinema lens, oval bokeh and horizontal flare",
        },
      ],
    },
    {
      id: "clothing",
      title: "Clothing & Wardrobe",
      options: [
        {
          id: "techwear-urban",
          label: "Urban Utilitarian Techwear",
          token: "functional matte black techwear jacket, tactical straps, waterproof cargo silhouette",
        },
        {
          id: "editorial-tailoring",
          label: "Minimalist Editorial Tailoring",
          token: "structured oversized wool coat, crisp architectural tailoring, luxury editorial drape",
        },
        {
          id: "cyber-kimono",
          label: "Contemporary Street Kimono",
          token: "layered modern street kimono with graphic textile patterns and wide obi belt",
        },
        {
          id: "vintage-90s-street",
          label: "90s Vintage Streetwear",
          token: "heavyweight boxy vintage bomber jacket, distressed denim, retro sneakers",
        },
      ],
    },
    {
      id: "angle",
      title: "Angle & Framing",
      options: [
        {
          id: "low-angle-24mm",
          label: "24mm Heroic Low Angle",
          token: "dynamic low-angle heroic perspective looking slightly up",
        },
        {
          id: "birds-eye-top",
          label: "Overhead Bird's-Eye View",
          token: "high overhead bird's-eye view looking straight down with geometric ground alignment",
        },
        {
          id: "dutch-tilt",
          label: "Dynamic Dutch Angle",
          token: "tilted editorial dutch angle creating kinetic tension and diagonal energy",
        },
        {
          id: "rule-of-thirds",
          label: "Asymmetric Rule of Thirds",
          token: "off-center editorial magazine composition with negative space",
        },
        {
          id: "centered-iconic",
          label: "Iconic Center-Framed Poster",
          token: "bold symmetrical center-framed character study",
        },
      ],
    },
    {
      id: "lighting",
      title: "Lighting & Mood",
      options: [
        {
          id: "golden-hour",
          label: "Warm Golden Hour",
          token: "warm golden hour rim lighting, long atmospheric shadows",
        },
        {
          id: "acid-rim",
          label: "Amber Rim Light",
          token: "sharp warm amber rim light, deep ink chiaroscuro shadows",
        },
        {
          id: "studio-softbox",
          label: "Diffused Editorial Softbox",
          token: "soft diffused editorial studio key light, clean shadow separation",
        },
        {
          id: "neon-rain",
          label: "Neon Nocturne & Reflections",
          token: "wet asphalt neon reflections, nocturnal cyan and amber glow",
        },
      ],
    },
    {
      id: "palette",
      title: "Atmosphere & Color",
      options: [
        {
          id: "diagonal-action",
          label: "Dynamic Diagonal Motion",
          token: "dynamic diagonal leading lines, mid-stride motion energy",
        },
        {
          id: "pastel-teal-warm",
          label: "Pastel Teal Sky & Warm Ochre",
          token: "soft pastel teal sky, warm ochre and olive utility tones",
        },
        {
          id: "monochrome-duotone",
          label: "High-Contrast Graphic Duotone",
          token: "high-contrast monochrome black ink with isolated amber gold highlights",
        },
      ],
    },
  ],
  interactive_workflow_steps: [
    {
      step: 1,
      title: "Base Concept & Visual Diagnosis",
      subtitle: "Python Co-Pilot (:8000)",
      description:
        "Write your initial visual concept in plain English. The Python engine (Flask + SQLAlchemy) diagnoses missing visual dimensions (lighting, optics, atmosphere, framing) without ever receiving your API key.",
    },
    {
      step: 2,
      title: "Guided Art Direction",
      subtitle: "Questions & Variations",
      description:
        "Answer one-click guided questions or pick from 3 directorial variations tailored to enrich your Master Prompt in real time.",
    },
    {
      step: 3,
      title: "Direct Browser Generation",
      subtitle: "Nano Banana (Zero-Storage)",
      description:
        "Your browser dispatches the Master Prompt directly to `generativelanguage.googleapis.com` (`gemini-2.5-flash-image`) using the key held strictly in volatile React RAM (`useState`).",
    },
    {
      step: 4,
      title: "Multi-Turn Refinement & Publishing",
      subtitle: "Conversational Evolution",
      description:
        "Each generated image feeds back as a multimodal visual reference (`inlineData`) for the next turn: shift the lighting, add neon rain, or reframe while preserving character identity, then publish to the Community Gallery.",
    },
  ],
  quick_iteration_chips: [
    {
      id: "dramatic-light",
      label: "Make lighting more dramatic",
      instruction:
        "Make the lighting more dramatic with chiaroscuro contrast and an acid-yellow rim light",
    },
    {
      id: "neon-night",
      label: "Switch to neon Tokyo night",
      instruction:
        "Transform the setting into a rainy nocturnal Tokyo street with neon reflections on wet asphalt",
    },
    {
      id: "closeup-85mm",
      label: "85mm cinematic close-up",
      instruction:
        "Move the camera closer for a dramatic 85mm f/1.4 close-up portrait while preserving character identity",
    },
    {
      id: "acid-visor",
      label: "Add acid-yellow visor (#F2FA3C)",
      instruction:
        "Add a translucent tactical visor in acid-yellow (#F2FA3C) and graphic insignia on the jacket",
    },
  ],
};

export function buildLocalFallbackAnalysis(
  idea: string,
  styleId: string,
  modifiers: string[]
): AnalyzePromptResponse {
  const cleanIdea =
    idea.trim() ||
    "A futuristic urban explorer with aviator goggles walking down a sunlit street";
  const style =
    DEFAULT_BOOTSTRAP_DATA.style_presets.find((s) => s.id === styleId) ||
    DEFAULT_BOOTSTRAP_DATA.style_presets[0];

  const allOptions = DEFAULT_BOOTSTRAP_DATA.modifier_categories.flatMap(
    (c) => c.options
  );
  const resolvedTokens = modifiers.map((m) => {
    const found = allOptions.find((o) => o.id === m || o.label === m);
    return found ? found.token : m;
  });

  const detected = ["subject", "style"];
  const missing: string[] = [];

  const lower = (cleanIdea + " " + resolvedTokens.join(" ")).toLowerCase();
  if (
    lower.includes("light") ||
    lower.includes("sun") ||
    lower.includes("golden") ||
    lower.includes("neon") ||
    lower.includes("shadow")
  ) {
    detected.push("lighting");
  } else {
    missing.push("lighting");
  }

  if (
    lower.includes("35mm") ||
    lower.includes("85mm") ||
    lower.includes("24mm") ||
    lower.includes("close") ||
    lower.includes("lens")
  ) {
    detected.push("camera");
  } else {
    missing.push("camera");
  }

  if (
    lower.includes("street") ||
    lower.includes("city") ||
    lower.includes("tokyo") ||
    lower.includes("backdrop")
  ) {
    detected.push("environment");
  } else {
    missing.push("environment");
  }

  const score = Math.min(
    98,
    Math.max(45, 42 + detected.length * 12 + modifiers.length * 6)
  );

  const modifierSuffix =
    resolvedTokens.length > 0 ? `, ${resolvedTokens.join(", ")}` : "";
  const masterPrompt = `${cleanIdea}. Style: ${style.prompt_tokens}${modifierSuffix}, sharp focus, cohesive color grading, masterpiece composition.`;

  return {
    completeness_score: score,
    missing_dimensions: missing,
    detected_dimensions: detected,
    guided_questions: [
      {
        id: "q-lighting",
        dimension: "lighting",
        question: "What lighting atmosphere should elevate this scene?",
        options: [
          {
            label: "Warm Golden Hour Sunlight",
            prompt_addition:
              "bathed in warm late-afternoon golden hour sunlight with long expressive shadows",
          },
          {
            label: "Acid-Yellow Rim Light (#F2FA3C)",
            prompt_addition:
              "dramatic acid-yellow (#F2FA3C) rim lighting with deep carbon-black ink shadows",
          },
          {
            label: "Diffused Studio Key Light",
            prompt_addition:
              "diffused editorial studio lighting highlighting fabric textures and crisp linework",
          },
          {
            label: "Rainy Cyberpunk Neon Night",
            prompt_addition:
              "urban neon reflections shimmering on wet asphalt at night",
          },
        ],
      },
      {
        id: "q-camera",
        dimension: "camera",
        question: "Which camera framing and optical lens should we apply?",
        options: [
          {
            label: "85mm Editorial Portrait",
            prompt_addition:
              "medium portrait framing on an 85mm f/1.4 lens with creamy background separation",
          },
          {
            label: "35mm Street Perspective",
            prompt_addition:
              "35mm street lens revealing surrounding architecture and dynamic posture",
          },
          {
            label: "Dramatic Close-Up",
            prompt_addition:
              "tight close-up focusing on the eyes, aviator goggles, and structured collar",
          },
        ],
      },
      {
        id: "q-detail",
        dimension: "environment",
        question: "Which graphic element or environmental detail should stand out?",
        options: [
          {
            label: "Overhead Lines & Pastel Teal Sky",
            prompt_addition:
              "urban utility poles silhouetted against a clean pastel teal sky",
          },
          {
            label: "Utility Jacket & Goggles",
            prompt_addition:
              "structured olive-and-cream utility jacket with aviator goggles resting on forehead",
          },
          {
            label: "Acid-Yellow #F2FA3C Graphic Accents",
            prompt_addition:
              "graphic signage details and insignia in vibrant acid-yellow (#F2FA3C)",
          },
        ],
      },
    ],
    variations: [
      {
        id: "var-editorial",
        title: "Flagship Editorial Cover",
        focus: "Crypko-inspired graphic composition and crisp ink contrast",
        full_prompt: `${cleanIdea}, ${style.prompt_tokens}${modifierSuffix}, bold ink linework, warm bone backdrop #E9E7DF, acid-yellow #F2FA3C graphic accents, magazine cover framing.`,
        recommended_aspect_ratio: "3:4",
      },
      {
        id: "var-cinematic",
        title: "Cinematic Street Narrative",
        focus: "Sunlit urban avenue depth and atmospheric perspective",
        full_prompt: `${cleanIdea}, wide 35mm street perspective, ${style.prompt_tokens}${modifierSuffix}, pastel teal sky, sunlit architectural facades, dynamic walking pose, rich cel-shaded shadows.`,
        recommended_aspect_ratio: "16:9",
      },
      {
        id: "var-closeup",
        title: "Intimate Character Close-Up (85mm)",
        focus: "Expressive gaze, protective eyewear, and garment textures",
        full_prompt: `Intimate 85mm close-up portrait of ${cleanIdea}, ${style.prompt_tokens}${modifierSuffix}, detailed expressive eyes, utility collar and goggles, crisp ink contours.`,
        recommended_aspect_ratio: "1:1",
      },
    ],
    master_prompt: masterPrompt,
  };
}

export async function fetchBootstrap(): Promise<{
  data: BootstrapResponse;
  online: boolean;
}> {
  return {
    data: DEFAULT_BOOTSTRAP_DATA,
    online: true,
  };
}

export async function analyzeWithCopilot(params: {
  idea: string;
  style_id: string;
  modifiers: string[];
  step?: number;
}): Promise<{ data: AnalyzePromptResponse; online: boolean }> {
  try {
    const tauriData = await invokeTauriCommand<AnalyzePromptResponse>(
      "tauri_analyze_prompt",
      {
        idea: params.idea,
        styleId: params.style_id,
        modifiers: params.modifiers,
      }
    );
    if (tauriData) {
      return { data: tauriData, online: true };
    }
  } catch {
    // Fallback to embedded TypeScript Co-Pilot
  }

  return {
    data: buildLocalFallbackAnalysis(
      params.idea,
      params.style_id,
      params.modifiers
    ),
    online: true,
  };
}

export async function refineWithCopilot(params: {
  current_prompt: string;
  instruction: string;
  style_id?: string;
  modifiers?: string[];
}): Promise<{ data: RefinePromptResponse; online: boolean }> {
  try {
    const tauriData = await invokeTauriCommand<RefinePromptResponse>(
      "tauri_refine_prompt",
      {
        currentPrompt: params.current_prompt,
        instruction: params.instruction,
      }
    );
    if (tauriData) {
      return { data: tauriData, online: true };
    }
  } catch {
    // Fallback to embedded TypeScript Co-Pilot
  }

  const editInstruction = `Preserve the main character design, pose, and composition from the reference image, and apply the following visual modification: ${params.instruction}. Maintain crisp cel-shaded linework and editorial color harmony.`;
  const refinedPrompt = `${params.current_prompt} — [Multi-Turn Edit: ${params.instruction}]`;
  return {
    data: {
      refined_prompt: refinedPrompt,
      edit_instruction: editInstruction,
      explanation:
        "Local Co-Pilot structured a multi-turn edit instruction to preserve visual consistency from the prior frame.",
      next_suggestions: DEFAULT_BOOTSTRAP_DATA.quick_iteration_chips,
    },
    online: true,
  };
}
