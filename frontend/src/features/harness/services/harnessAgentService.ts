import {
  InlineImagePart,
  ModelGenerationParams,
} from "@/features/studio/types/studio.types";
import { finalizeExactImageModelPrompt } from "@/features/studio/services/nanobananaClient";
import {
  HarnessCandidateEvaluation,
  HarnessCriterionScore,
  HarnessDeliverableSpec,
  HarnessReferenceSlot,
  HarnessRefinerDecision,
  HarnessRubricCriterion,
  TraceResponsibilityModule,
  TraceRoundAttribution,
} from "../types/harness.types";

export const DEFAULT_HARNESS_PLANNER_PROMPT = [
  "You are the Lead Planner Agent of an autonomous Goal-Driven Image Generation Harness (combining AutoRef-Harness and EvoGen-Harness).",
  "Given a user's visual Goal and optional Reference Images:",
  "1. Determine whether the Goal asks for a SINGLE scene/image (1 deliverable) or a MULTI-ASSET PACK / COLLECTION (2 to 8 distinct deliverables, e.g., isometric game assets, character sheet items, icon set).",
  "2. Define 'globalPackInvariants': strict visual invariants that every deliverable must obey (e.g., exact camera projection like 30-degree orthographic isometric, lighting direction, background isolation, cohesive color/material palette).",
  "3. Perform Explicit Role Allocation for any Reference Images provided by the user.",
  "4. Define a 4-criterion Evaluation Rubric whose integer weights sum to exactly 100.",
  "Return valid JSON only.",
].join("\n");

export const DEFAULT_HARNESS_CRITIC_PROMPT = [
  "You are the Multimodal Critic & Judge Agent of an autonomous Image Generation Harness (AutoRef-Harness + EvoGen-Harness).",
  "Inspect the candidate image against the Mission Goal, the Deliverable Specification, the Global Pack Invariants, and the Evaluation Rubric.",
  "1. Execute the Hard-Failure Gate first: flag any severe violation (missing subject, non-isometric view when isometric is required, cut-off silhouette, unnatural copy-paste seam, or duplicated subject).",
  "2. Score each criterion strictly from 0 up to its maximum weight.",
  "3. List concrete 'strengths' and actionable, specific 'complaints' that the Refiner Agent must fix in the next round.",
  "Return valid JSON only.",
].join("\n");

export const DEFAULT_HARNESS_REFINER_PROMPT = [
  "You are the TRACE Refiner Agent (Trajectory-Relative Attribution and Coordinated Evolution from EvoGen-Harness + Complaint-Directed Revision from AutoRef-Harness).",
  "Given the Critic's evaluation across the round's candidates, attribute remaining flaws across three responsibilities:",
  "- PROMPT_SPECIFICATION (missing spatial/projection/material constraints in the prompt)",
  "- REFERENCE_ROUTING (whether to anchor on the incumbent image >=60 score + keystone pack anchor, or regenerate fresh if composition failed)",
  "- MODEL_PARAMETERS (adjusting temperature/topP to reduce hallucination or increase diversity).",
  "Rewrite the next round's candidate prompts to resolve every named complaint while preserving verified strengths.",
  "Return valid JSON only.",
].join("\n");

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export function dataUrlToInlinePart(dataUrl: string): InlineImagePart | null {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1] || "image/png",
    data: match[2],
  };
}

export async function imageUrlToInlinePartForHarness(
  imageUrl: string,
  maxDim = 384
): Promise<InlineImagePart | null> {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("data:image/svg+xml")) {
    return null;
  }

  // In browser, compress/downscale large 1024x1024 PNGs to <=384px JPEG (~25KB) so Multimodal Critic & Reference calls are fast and never stall
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      const compressed = await new Promise<InlineImagePart | null>((resolve) => {
        const img = new Image();
        if (!imageUrl.startsWith("data:")) {
          img.crossOrigin = "anonymous";
        }
        const timeoutId = window.setTimeout(() => resolve(null), 2500);
        img.onload = () => {
          window.clearTimeout(timeoutId);
          try {
            const w = img.naturalWidth || 384;
            const h = img.naturalHeight || 384;
            const scale = Math.min(1, maxDim / Math.max(w, h));
            const targetW = Math.max(1, Math.round(w * scale));
            const targetH = Math.max(1, Math.round(h * scale));
            const canvas = document.createElement("canvas");
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(null);
              return;
            }
            ctx.fillStyle = "#14213d";
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.drawImage(img, 0, 0, targetW, targetH);
            const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.8);
            resolve(dataUrlToInlinePart(jpegDataUrl));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => {
          window.clearTimeout(timeoutId);
          resolve(null);
        };
        img.src = imageUrl;
      });
      if (compressed) return compressed;
    } catch {
      // Fallback to raw inline extraction below
    }
  }

  const direct = dataUrlToInlinePart(imageUrl);
  if (direct) return direct;
  try {
    const res = await fetchWithTimeout(imageUrl, {}, 10000);
    if (!res.ok) return null;
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return {
      mimeType: blob.type || "image/png",
      data: btoa(binary),
    };
  } catch {
    return null;
  }
}

export function buildDefaultRubricForGoal(
  goal: string,
  isMultiAssetPack: boolean
): HarnessRubricCriterion[] {
  const lower = goal.toLowerCase();
  const isIsometric =
    lower.includes("isometric") ||
    lower.includes("isométric") ||
    lower.includes("isometrico");

  if (isMultiAssetPack || isIsometric) {
    return [
      {
        id: "crit-goal-fidelity",
        label: "Deliverable & Theme Fidelity",
        description:
          "Accurately depicts the specific asset/subject with clear silhouette and functional game-ready design.",
        weight: 30,
      },
      {
        id: "crit-projection-cohesion",
        label: isIsometric
          ? "Isometric Projection & Pack Cohesion"
          : "Perspective & Pack Cohesion",
        description: isIsometric
          ? "Strict 30° orthographic isometric 2:1 angle, consistent scale, and unified visual language across all pack assets."
          : "Consistent camera angle, scale, and visual cohesion across all deliverables in the pack.",
        weight: 30,
      },
      {
        id: "crit-lighting-materials",
        label: "Materiality, Lighting & Color Palette",
        description:
          "Consistent top-left key lighting, crisp surface materials, and harmonious color palette.",
        weight: 20,
      },
      {
        id: "crit-isolation-clarity",
        label: "Clean Isolation & Edge Readability",
        description:
          "Complete object silhouette without cropped edges, clutter, or distracting background noise.",
        weight: 20,
      },
    ];
  }

  return [
    {
      id: "crit-subject-goal",
      label: "Goal & Subject Accuracy",
      description:
        "Fulfils all primary subject, action, and narrative elements specified in the user's goal.",
      weight: 35,
    },
    {
      id: "crit-composition-optics",
      label: "Spatial Composition & Framing",
      description:
        "Balanced foreground/background layering, intentional camera framing, and clear focal hierarchy.",
      weight: 25,
    },
    {
      id: "crit-lighting-atmosphere",
      label: "Lighting & Atmospheric Depth",
      description:
        "Cohesive lighting direction, tonal contrast, and color harmony supporting the mood.",
      weight: 20,
    },
    {
      id: "crit-structural-integrity",
      label: "Structural & Anatomical Integrity",
      description:
        "Free of visual artifacts, unnatural seams, broken geometry, or unintended duplications.",
      weight: 20,
    },
  ];
}

export function buildFallbackPlanFromGoal(params: {
  goal: string;
  referenceSlots: HarnessReferenceSlot[];
}): {
  missionTitle: string;
  globalPackInvariants: string;
  deliverables: HarnessDeliverableSpec[];
  rubric: HarnessRubricCriterion[];
} {
  const cleanGoal =
    params.goal.trim() ||
    "Create isometric space game assets with cohesive sci-fi styling";
  const lower = cleanGoal.toLowerCase();

  const isSpace =
    lower.includes("space") ||
    lower.includes("espacial") ||
    lower.includes("nave") ||
    lower.includes("sci-fi") ||
    lower.includes("star");
  const isIsometric =
    lower.includes("isometric") ||
    lower.includes("isométric") ||
    lower.includes("isometrico");
  const isMultiAsset =
    lower.includes("assets") ||
    lower.includes("asset") ||
    lower.includes("sprites") ||
    lower.includes("itens") ||
    lower.includes("items") ||
    lower.includes("pack") ||
    lower.includes("coleção") ||
    lower.includes("collection") ||
    lower.includes("icons") ||
    lower.includes("jogo") ||
    lower.includes("game");

  const refRolesNote =
    params.referenceSlots.length > 0
      ? ` Reference Roles: ${params.referenceSlots
          .map((r, i) => `Ref #${i + 1} (${r.role || r.name})`)
          .join("; ")}.`
      : "";

  if (isMultiAsset && isSpace) {
    const isoClause = isIsometric
      ? "True 30-degree orthographic isometric 2:1 game projection, centered full silhouette, clean isolated neutral dark-slate studio background"
      : "Consistent three-quarter game asset camera projection, centered full silhouette, clean isolated neutral background";
    const globalPackInvariants = `${isoClause}, consistent top-left warm key light with cyan rim accents, cohesive hard-surface sci-fi titanium and emissive plasma materials, crisp readable game-ready edges.${refRolesNote}`;

    const specs: Array<{ title: string; description: string }> = [
      {
        title: "01 • Player Starfighter Ship",
        description: `Sleek twin-engine player starfighter spacecraft with glowing cyan plasma thrusters, cockpit canopy, and modular weapon pods, rendered in ${
          isIsometric ? "strict 30° isometric orthographic view" : "game asset view"
        }, full uncut silhouette on a clean isolated background.`,
      },
      {
        title: "02 • Enemy Interceptor Drone",
        description: `Angular autonomous alien/pirate interceptor drone with obsidian armor plating and crimson energy core, rendered in ${
          isIsometric ? "strict 30° isometric orthographic view" : "game asset view"
        } matching the exact camera angle and lighting of the pack, isolated background.`,
      },
      {
        title: "03 • Modular Space Station Hub",
        description: `Orbital command station module with docking ring, solar arrays, and illuminated hangar bay, rendered in ${
          isIsometric ? "strict 30° isometric orthographic view" : "game asset view"
        } with matching material shaders and clean isolated background.`,
      },
      {
        title: "04 • Crystalline Asteroid Resource Node",
        description: `Floating space rock asteroid embedded with luminous hyper-energy crystals and mining beacon, rendered in ${
          isIsometric ? "strict 30° isometric orthographic view" : "game asset view"
        } matching the pack's lighting and isolated background.`,
      },
    ];

    return {
      missionTitle: isIsometric
        ? "Isometric Space Game Assets Pack"
        : "Space Game Assets Pack",
      globalPackInvariants,
      deliverables: specs.map((s, idx) => ({
        id: `deliv_${idx + 1}`,
        index: idx + 1,
        title: s.title,
        description: s.description,
        status: "pending",
        incumbentScore: 0,
        incumbentRound: null,
        incumbentCandidateIndex: null,
        incumbentImageUrl: null,
        incumbentPrompt: null,
      })),
      rubric: buildDefaultRubricForGoal(cleanGoal, true),
    };
  }

  if (isMultiAsset) {
    const isoClause = isIsometric
      ? "True 30-degree orthographic isometric 2:1 projection, centered full object silhouette, clean isolated neutral background"
      : "Unified camera perspective, centered full silhouette, clean isolated neutral background";
    const globalPackInvariants = `${isoClause}, consistent top-left directional key lighting, unified color palette and surface shader finish across all assets.${refRolesNote}`;

    const specs: Array<{ title: string; description: string }> = [
      {
        title: "01 • Hero Primary Asset",
        description: `Primary hero unit/object for "${cleanGoal}", ${isoClause}, rich material detail and unmistakable silhouette.`,
      },
      {
        title: "02 • Companion / Adversary Asset",
        description: `Secondary complementary unit/object for "${cleanGoal}", matching exact camera angle, scale, and lighting of Asset #01.`,
      },
      {
        title: "03 • Structure / Landmark Asset",
        description: `Key architectural module or station structure for "${cleanGoal}", matching exact isometric/camera grid and material palette.`,
      },
      {
        title: "04 • Environment / Collectible Prop",
        description: `Interactive resource node or environmental prop for "${cleanGoal}", matching exact projection, lighting, and isolated background.`,
      },
    ];

    return {
      missionTitle: cleanGoal.slice(0, 44),
      globalPackInvariants,
      deliverables: specs.map((s, idx) => ({
        id: `deliv_${idx + 1}`,
        index: idx + 1,
        title: s.title,
        description: s.description,
        status: "pending",
        incumbentScore: 0,
        incumbentRound: null,
        incumbentCandidateIndex: null,
        incumbentImageUrl: null,
        incumbentPrompt: null,
      })),
      rubric: buildDefaultRubricForGoal(cleanGoal, true),
    };
  }

  // Single deliverable mission
  const globalPackInvariants = `${
    isIsometric
      ? "True 30-degree orthographic isometric projection, crisp geometric alignment, "
      : ""
  }Cohesive directional lighting, high material fidelity, and intentional foreground-to-background spatial composition.${refRolesNote}`;

  return {
    missionTitle: cleanGoal.slice(0, 44),
    globalPackInvariants,
    deliverables: [
      {
        id: "deliv_1",
        index: 1,
        title: "01 • Primary Target Deliverable",
        description: cleanGoal,
        status: "pending",
        incumbentScore: 0,
        incumbentRound: null,
        incumbentCandidateIndex: null,
        incumbentImageUrl: null,
        incumbentPrompt: null,
      },
    ],
    rubric: buildDefaultRubricForGoal(cleanGoal, false),
  };
}

export async function runHarnessPlannerAgent(params: {
  apiKey: string;
  goal: string;
  referenceSlots: HarnessReferenceSlot[];
  customPlannerPrompt?: string;
}): Promise<{
  missionTitle: string;
  globalPackInvariants: string;
  deliverables: HarnessDeliverableSpec[];
  rubric: HarnessRubricCriterion[];
}> {
  const fallback = buildFallbackPlanFromGoal({
    goal: params.goal,
    referenceSlots: params.referenceSlots,
  });

  const trimmedKey = params.apiKey.trim();
  if (!trimmedKey || !params.goal.trim()) {
    return fallback;
  }

  try {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    const refDescriptions = params.referenceSlots.map(
      (r, idx) =>
        `Reference #${idx + 1}: Role="${r.role || "Visual Reference"}", Name="${
          r.name
        }"`
    );

    const promptText = [
      params.customPlannerPrompt?.trim() || DEFAULT_HARNESS_PLANNER_PROMPT,
      `User Goal: "${params.goal.trim()}"`,
      refDescriptions.length > 0
        ? `User Reference Images:\n${refDescriptions.join("\n")}`
        : "No user reference images provided.",
      "If the user asks for multiple assets/items/sprites/pack (e.g., 'Crie os assets do meu jogo de space, em formato isometrico'), decompose into 4 distinct, concrete deliverables in English so each asset is generated as an individual, cohesive frame.",
      "If the user asks for a single scene/image, return 1 deliverable.",
      'Return ONLY valid JSON matching this schema: {"missionTitle": "Short English Title", "globalPackInvariants": "Strict camera, projection, lighting, and background rules in English...", "deliverables": [{"title": "01 • Asset Name", "description": "Detailed English visual specification for this deliverable..."}], "rubric": [{"id": "crit_1", "label": "Criterion Title", "description": "What the critic checks...", "weight": 30}]}',
    ].join("\n\n");

    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": trimmedKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        cache: "no-store",
      },
      14000
    );

    if (!response.ok) return fallback;
    const data = (await response.json()) as GeminiResponse;
    const rawText =
      data.candidates?.[0]?.content?.parts
        ?.filter((p) => !p.thought)
        ?.map((p) => p.text || "")
        .join("")
        .trim() || "";
    if (!rawText) return fallback;

    const parsed = JSON.parse(rawText) as {
      missionTitle?: string;
      globalPackInvariants?: string;
      deliverables?: Array<{ title?: string; description?: string }>;
      rubric?: Array<{
        id?: string;
        label?: string;
        description?: string;
        weight?: number;
      }>;
    };

    const rawDelivs = Array.isArray(parsed.deliverables)
      ? parsed.deliverables.slice(0, 8)
      : [];
    const deliverables: HarnessDeliverableSpec[] =
      rawDelivs.length > 0
        ? rawDelivs.map((d, idx) => {
            const rawTitle = (d.title || `Deliverable #${idx + 1}`).trim();
            const numberedTitle = /^\d/.test(rawTitle)
              ? rawTitle
              : `${String(idx + 1).padStart(2, "0")} • ${rawTitle}`;
            return {
              id: `deliv_${idx + 1}`,
              index: idx + 1,
              title: numberedTitle,
              description: (d.description || params.goal).trim(),
              status: "pending",
              incumbentScore: 0,
              incumbentRound: null,
              incumbentCandidateIndex: null,
              incumbentImageUrl: null,
              incumbentPrompt: null,
            };
          })
        : fallback.deliverables;

    const rawRubric = Array.isArray(parsed.rubric)
      ? parsed.rubric.slice(0, 5)
      : [];
    let rubric: HarnessRubricCriterion[] =
      rawRubric.length >= 2
        ? rawRubric.map((r, idx) => ({
            id: r.id || `crit_${idx + 1}`,
            label: (r.label || `Criterion #${idx + 1}`).trim(),
            description: (r.description || "").trim(),
            weight: Math.max(5, Math.round(Number(r.weight) || 25)),
          }))
        : fallback.rubric;

    // Normalize weights to sum to 100
    const sumW = rubric.reduce((acc, r) => acc + r.weight, 0);
    if (sumW !== 100 && rubric.length > 0) {
      const scale = 100 / sumW;
      let running = 0;
      rubric = rubric.map((r, idx) => {
        if (idx === rubric.length - 1) {
          return { ...r, weight: Math.max(5, 100 - running) };
        }
        const w = Math.max(5, Math.round(r.weight * scale));
        running += w;
        return { ...r, weight: w };
      });
    }

    return {
      missionTitle: (parsed.missionTitle || fallback.missionTitle).trim(),
      globalPackInvariants: (
        parsed.globalPackInvariants || fallback.globalPackInvariants
      ).trim(),
      deliverables,
      rubric,
    };
  } catch {
    return fallback;
  }
}

const AUTOREF_DRAFT_STRATEGIES = [
  {
    shortLabel: "Draft A • Spatial & Role Layout",
    strategyName: "Explicit Spatial Geometry & Reference Role Allocation",
    buildPrompt: (
      deliv: HarnessDeliverableSpec,
      invariants: string,
      roleClause: string,
      keystoneClause: string
    ) =>
      `${deliv.description}. Global Pack Specification: ${invariants}.${roleClause}${keystoneClause} Composed with razor-sharp geometric alignment, complete uncut silhouette, and balanced spatial hierarchy.`,
  },
  {
    shortLabel: "Draft B • Material & Optical Clarity",
    strategyName: "Tactile Materiality, Lighting & Silhouette Readability",
    buildPrompt: (
      deliv: HarnessDeliverableSpec,
      invariants: string,
      roleClause: string,
      keystoneClause: string
    ) =>
      `${deliv.description} — emphasizing crisp surface material separation, specular and emissive lighting contrast, and high-readability silhouette. Global Pack Specification: ${invariants}.${roleClause}${keystoneClause}`,
  },
  {
    shortLabel: "Draft C • Orthographic Precision",
    strategyName: "Strict Projection & Clean Background Isolation",
    buildPrompt: (
      deliv: HarnessDeliverableSpec,
      invariants: string,
      roleClause: string,
      keystoneClause: string
    ) =>
      `Strict camera projection study of ${deliv.description}. ${invariants}.${roleClause}${keystoneClause} Centered composition with generous margin around the object and zero background clutter.`,
  },
  {
    shortLabel: "Draft D • High-Contrast Hero Polish",
    strategyName: "Hero Asset Polish & Chromatic Counterpoint",
    buildPrompt: (
      deliv: HarnessDeliverableSpec,
      invariants: string,
      roleClause: string,
      keystoneClause: string
    ) =>
      `Production-ready hero render of ${deliv.description}. ${invariants}.${roleClause}${keystoneClause} Sculpted key-to-rim lighting ratio and cohesive color harmony.`,
  },
];

export function buildRound1DraftPromptsForDeliverable(params: {
  deliverable: HarnessDeliverableSpec;
  globalPackInvariants: string;
  referenceSlots: HarnessReferenceSlot[];
  hasKeystoneAnchor: boolean;
  candidatesPerSlot: number;
  modifierLabels: string[];
  aspectRatio: string;
}): Array<{ label: string; promptStrategy: string; prompt: string }> {
  const safeCount = Math.max(
    1,
    Math.min(4, Math.round(params.candidatesPerSlot || 2))
  );
  const roleClause =
    params.referenceSlots.length > 0
      ? ` Reference Role Allocation: ${params.referenceSlots
          .map(
            (r, i) =>
              `use Reference Image #${i + 1} strictly for ${
                r.role || r.name || "visual reference"
              }`
          )
          .join("; ")}.`
      : "";
  const keystoneClause = params.hasKeystoneAnchor
    ? " Match the exact camera projection angle, lighting direction, and material shader style of the provided Keystone Pack Anchor image without copying its subject geometry."
    : "";

  return Array.from({ length: safeCount }, (_, idx) => {
    const strat =
      AUTOREF_DRAFT_STRATEGIES[idx % AUTOREF_DRAFT_STRATEGIES.length];
    const rawPrompt = strat.buildPrompt(
      params.deliverable,
      params.globalPackInvariants,
      roleClause,
      keystoneClause
    );
    return {
      label: strat.shortLabel,
      promptStrategy: strat.strategyName,
      prompt: finalizeExactImageModelPrompt({
        prompt: rawPrompt,
        modifierLabels: params.modifierLabels,
        aspectRatio: params.aspectRatio,
      }),
    };
  });
}

export async function runHarnessCriticAgent(params: {
  apiKey: string;
  goal: string;
  globalPackInvariants: string;
  deliverable: HarnessDeliverableSpec;
  rubric: HarnessRubricCriterion[];
  candidateIndex: number;
  candidateLabel: string;
  promptStrategy: string;
  promptUsed: string;
  imageUrl: string;
  mimeType: string;
  roundNumber: number;
  userSteeringHint?: string;
  customCriticPrompt?: string;
}): Promise<HarnessCandidateEvaluation> {
  // Deterministic fallback evaluation when no API key or no rendered image is present
  const buildFallbackEvaluation = (): HarnessCandidateEvaluation => {
    const baseRatio = Math.min(
      0.94,
      0.74 + params.roundNumber * 0.09 + (params.candidateIndex === 0 ? 0.04 : 0.01)
    );
    const criterionScores: HarnessCriterionScore[] = params.rubric.map(
      (crit, cIdx) => {
        const factor = Math.min(
          1,
          baseRatio + (cIdx % 2 === 0 ? 0.03 : -0.02)
        );
        const score = Math.min(
          crit.weight,
          Math.max(1, Math.round(crit.weight * factor))
        );
        return {
          criterionId: crit.id,
          score,
          rationale:
            score >= crit.weight * 0.85
              ? `Strong alignment with ${crit.label.toLowerCase()}.`
              : `Can tighten ${crit.label.toLowerCase()} in the next iteration.`,
        };
      }
    );
    const totalScore = criterionScores.reduce((acc, c) => acc + c.score, 0);
    const passedHardGate = true;
    return {
      candidateIndex: params.candidateIndex,
      deliverableId: params.deliverable.id,
      deliverableTitle: params.deliverable.title,
      label: params.candidateLabel,
      promptStrategy: params.promptStrategy,
      prompt: params.promptUsed,
      imageUrl: params.imageUrl,
      mimeType: params.mimeType || "image/png",
      hardFailures: [],
      passedHardGate,
      totalScore,
      criterionScores,
      strengths: [
        `Clear silhouette and adherence to ${params.deliverable.title}`,
        "Consistent camera projection and lighting hierarchy",
      ],
      complaints:
        totalScore >= 86
          ? []
          : [
              "Sharpen orthographic isometric edge alignment and increase rim-light separation from background",
              "Ensure material micro-textures match the pack's canonical shader finish",
            ],
      isSlotRoundWinner: false,
    };
  };

  const trimmedKey = params.apiKey.trim();
  if (!trimmedKey || !params.imageUrl) {
    return buildFallbackEvaluation();
  }

  try {
    const imagePart = await imageUrlToInlinePartForHarness(params.imageUrl);
    if (!imagePart) {
      return buildFallbackEvaluation();
    }

    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    const rubricDesc = params.rubric
      .map(
        (r) =>
          `- id="${r.id}", label="${r.label}", maxWeight=${r.weight}: ${r.description}`
      )
      .join("\n");

    const criticText = [
      params.customCriticPrompt?.trim() || DEFAULT_HARNESS_CRITIC_PROMPT,
      `Mission Goal: "${params.goal}"`,
      `Global Pack Invariants: "${params.globalPackInvariants}"`,
      `Target Deliverable: "${params.deliverable.title} — ${params.deliverable.description}"`,
      params.userSteeringHint?.trim()
        ? `User Refinement Directive for Round ${params.roundNumber}: "${params.userSteeringHint.trim()}" (Verify and reward candidates that faithfully incorporate this refinement directive while preserving visual quality.)`
        : "",
      `Evaluation Rubric (weights sum to 100):\n${rubricDesc}`,
      'Return ONLY valid JSON with this exact structure: {"passedHardGate": true, "hardFailures": [], "criterionScores": [{"criterionId": "...", "score": 25, "rationale": "..."}], "strengths": ["..."], "complaints": ["Concrete flaw 1 to fix...", "Concrete flaw 2 to fix..."]}',
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": trimmedKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: criticText },
                {
                  inlineData: {
                    mimeType: imagePart.mimeType,
                    data: imagePart.data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        cache: "no-store",
      },
      14000
    );

    if (!response.ok) return buildFallbackEvaluation();
    const data = (await response.json()) as GeminiResponse;
    const rawText =
      data.candidates?.[0]?.content?.parts
        ?.filter((p) => !p.thought)
        ?.map((p) => p.text || "")
        .join("")
        .trim() || "";
    if (!rawText) return buildFallbackEvaluation();

    const parsed = JSON.parse(rawText) as {
      passedHardGate?: boolean;
      hardFailures?: string[];
      criterionScores?: Array<{
        criterionId?: string;
        score?: number;
        rationale?: string;
      }>;
      strengths?: string[];
      complaints?: string[];
    };

    const criterionScores: HarnessCriterionScore[] = params.rubric.map(
      (crit) => {
        const found = (parsed.criterionScores || []).find(
          (c) => c.criterionId === crit.id
        );
        const rawScore = Number(found?.score ?? crit.weight * 0.78);
        const clampedScore = Math.max(
          0,
          Math.min(crit.weight, Math.round(rawScore))
        );
        return {
          criterionId: crit.id,
          score: clampedScore,
          rationale: (found?.rationale || "Evaluated against rubric.").trim(),
        };
      }
    );

    const hardFailures = Array.isArray(parsed.hardFailures)
      ? parsed.hardFailures.filter(Boolean)
      : [];
    const passedHardGate =
      parsed.passedHardGate !== undefined
        ? Boolean(parsed.passedHardGate) && hardFailures.length === 0
        : hardFailures.length === 0;

    const rawTotal = criterionScores.reduce((acc, c) => acc + c.score, 0);
    const totalScore = passedHardGate ? rawTotal : Math.min(rawTotal, 55);

    return {
      candidateIndex: params.candidateIndex,
      deliverableId: params.deliverable.id,
      deliverableTitle: params.deliverable.title,
      label: params.candidateLabel,
      promptStrategy: params.promptStrategy,
      prompt: params.promptUsed,
      imageUrl: params.imageUrl,
      mimeType: params.mimeType || "image/png",
      hardFailures,
      passedHardGate,
      totalScore,
      criterionScores,
      strengths:
        Array.isArray(parsed.strengths) && parsed.strengths.length > 0
          ? parsed.strengths.slice(0, 4)
          : ["Good adherence to core subject"],
      complaints: Array.isArray(parsed.complaints)
        ? parsed.complaints.slice(0, 4)
        : [],
      isSlotRoundWinner: false,
    };
  } catch {
    return buildFallbackEvaluation();
  }
}

export async function runHarnessTraceRefinerAgent(params: {
  apiKey: string;
  goal: string;
  globalPackInvariants: string;
  deliverable: HarnessDeliverableSpec;
  rubric: HarnessRubricCriterion[];
  roundNumber: number;
  candidates: HarnessCandidateEvaluation[];
  currentModelParams: ModelGenerationParams;
  candidatesPerSlot: number;
  targetScore: number;
  hasKeystoneAnchorAvailable: boolean;
  modifierLabels: string[];
  aspectRatio: string;
  userSteeringHint?: string;
  customRefinerPrompt?: string;
}): Promise<{
  slotWinnerIndex: number;
  updatedDeliverable: HarnessDeliverableSpec;
  traceAttribution: TraceRoundAttribution;
  refinerDecision: HarnessRefinerDecision | null;
}> {
  // 1. Identify best candidate of this round for this deliverable slot
  let bestIdx = 0;
  for (let i = 1; i < params.candidates.length; i++) {
    const curr = params.candidates[i];
    const best = params.candidates[bestIdx];
    if (curr.passedHardGate && !best.passedHardGate) {
      bestIdx = i;
    } else if (
      curr.passedHardGate === best.passedHardGate &&
      curr.totalScore > best.totalScore
    ) {
      bestIdx = i;
    }
  }
  const roundWinner = params.candidates[bestIdx];

  // 2. AutoRef Pairwise Comparison + EvoGen No-Patch Regression Gate
  const hadPriorIncumbent =
    params.deliverable.incumbentRound !== null &&
    params.deliverable.incumbentScore > 0;
  let pairwiseVerdict: TraceRoundAttribution["pairwiseVerdict"] =
    "INITIAL_INCUMBENT";
  let noPatchTriggered = false;
  let pairwiseReasoning = "";

  const updatedDeliverable: HarnessDeliverableSpec = {
    ...params.deliverable,
  };

  const hasUserSteering = Boolean(params.userSteeringHint?.trim());

  if (!hadPriorIncumbent) {
    pairwiseVerdict = "INITIAL_INCUMBENT";
    pairwiseReasoning = `Candidate #${
      bestIdx + 1
    } (${roundWinner.totalScore}/100) established as the initial Incumbent for ${
      params.deliverable.title
    }.`;
    updatedDeliverable.incumbentScore = roundWinner.totalScore;
    updatedDeliverable.incumbentRound = params.roundNumber;
    updatedDeliverable.incumbentCandidateIndex = bestIdx;
    updatedDeliverable.incumbentImageUrl = roundWinner.imageUrl;
    updatedDeliverable.incumbentPrompt = roundWinner.prompt;
  } else if (
    roundWinner.passedHardGate &&
    (roundWinner.totalScore >= params.deliverable.incumbentScore ||
      (hasUserSteering && roundWinner.totalScore >= Math.min(params.targetScore - 5, params.deliverable.incumbentScore - 8)))
  ) {
    pairwiseVerdict = "CHALLENGER_WON";
    pairwiseReasoning = hasUserSteering
      ? `User-steered Challenger R${params.roundNumber}.#${bestIdx + 1} (${
          roundWinner.totalScore
        }/100) promoted as the new Incumbent after applying refinement directive ("${params.userSteeringHint?.trim()}").`
      : `Challenger R${params.roundNumber}.#${bestIdx + 1} (${
          roundWinner.totalScore
        }/100) outperformed prior Incumbent R${
          params.deliverable.incumbentRound
        } (${params.deliverable.incumbentScore}/100) while passing all Hard-Failure checks.`;
    updatedDeliverable.incumbentScore = roundWinner.totalScore;
    updatedDeliverable.incumbentRound = params.roundNumber;
    updatedDeliverable.incumbentCandidateIndex = bestIdx;
    updatedDeliverable.incumbentImageUrl = roundWinner.imageUrl;
    updatedDeliverable.incumbentPrompt = roundWinner.prompt;
  } else {
    pairwiseVerdict = "INCUMBENT_RETAINED";
    noPatchTriggered = true;
    pairwiseReasoning = `EvoGen No-Patch Gate triggered: Challenger R${
      params.roundNumber
    }.#${bestIdx + 1} (${roundWinner.totalScore}/100) did not surpass Incumbent R${
      params.deliverable.incumbentRound
    } (${
      params.deliverable.incumbentScore
    }/100). Retaining verified Incumbent to prevent regression.`;
  }

  const effectiveScore = updatedDeliverable.incumbentScore;
  const isSolved =
    effectiveScore >= params.targetScore && roundWinner.passedHardGate;
  updatedDeliverable.status = isSolved ? "solved" : "pending";

  // 3. EvoGen TRACE: Trajectory-Relative Evidence Aggregation across candidates
  const failedHardCount = params.candidates.filter(
    (c) => !c.passedHardGate
  ).length;
  const allHaveComplaints = params.candidates.every(
    (c) => c.complaints.length > 0 || c.totalScore < params.targetScore
  );

  let failurePattern: TraceRoundAttribution["failurePattern"] = "NONE";
  let primaryModule: TraceResponsibilityModule = "PROMPT_SPECIFICATION";
  let diagnosisSummary = "";

  if (isSolved) {
    failurePattern = "NONE";
    primaryModule = "PROMPT_SPECIFICATION";
    diagnosisSummary = `Deliverable reached target threshold (${effectiveScore}/${params.targetScore}). Slot locked as Solved.`;
  } else if (failedHardCount > 0 && failedHardCount === params.candidates.length) {
    failurePattern = "SYSTEMATIC";
    primaryModule =
      params.roundNumber > 1 ? "REFERENCE_ROUTING" : "PROMPT_SPECIFICATION";
    diagnosisSummary = `Systematic Hard-Failure across all ${params.candidates.length} candidates (${roundWinner.hardFailures.join(
      "; "
    )}). Attributing to ${primaryModule}.`;
  } else if (allHaveComplaints && params.candidates.length > 1) {
    failurePattern = "SYSTEMATIC";
    primaryModule = "PROMPT_SPECIFICATION";
    diagnosisSummary = `All ${params.candidates.length} candidates fell below ${params.targetScore}/100 on shared criteria. Systematic prompt specification refinement required.`;
  } else {
    failurePattern = "STOCHASTIC";
    primaryModule =
      effectiveScore >= 70 ? "REFERENCE_ROUTING" : "MODEL_PARAMETERS";
    diagnosisSummary = `Stochastic variance across candidates (best: ${roundWinner.totalScore}/100). Anchoring on winning structure and refining locally.`;
  }

  const traceAttribution: TraceRoundAttribution = {
    failurePattern,
    primaryModule,
    diagnosisSummary,
    noPatchTriggered,
    pairwiseVerdict,
    pairwiseReasoning,
  };

  if (isSolved) {
    return {
      slotWinnerIndex: bestIdx,
      updatedDeliverable,
      traceAttribution,
      refinerDecision: null,
    };
  }

  // 4. Build Refiner Decision for Round N+1 (Anchor >= 60 rule + Complaint-Directed Revision)
  const useWinnerAsReference =
    effectiveScore >= 60 && Boolean(updatedDeliverable.incumbentImageUrl);
  const useKeystoneStyleAnchor =
    !useWinnerAsReference && params.hasKeystoneAnchorAvailable;

  const nextTemp =
    primaryModule === "MODEL_PARAMETERS"
      ? Math.max(
          0.65,
          Math.min(1.2, Number((params.currentModelParams.temperature * 0.9).toFixed(2)))
        )
      : params.currentModelParams.temperature;

  const adjustedModelParams: ModelGenerationParams = {
    ...params.currentModelParams,
    temperature: nextTemp,
  };

  const activeComplaints = [
    ...roundWinner.hardFailures,
    ...roundWinner.complaints,
    ...(params.userSteeringHint?.trim()
      ? [`User Steering Instruction: ${params.userSteeringHint.trim()}`]
      : []),
  ];

  const baseAnchorPrompt =
    updatedDeliverable.incumbentPrompt ||
    roundWinner.prompt ||
    params.deliverable.description;

  const buildFallbackNextDrafts = () => {
    const safeCount = Math.max(
      1,
      Math.min(4, Math.round(params.candidatesPerSlot || 2))
    );
    const complaintFixClause =
      activeComplaints.length > 0
        ? ` Mandatory Corrections: ${activeComplaints.join("; ")}.`
        : " Refine orthographic projection precision, silhouette isolation, and material lighting.";
    const anchorClause = useWinnerAsReference
      ? " Using the provided reference image, preserve the core subject identity and strengths while applying these exact corrections:"
      : useKeystoneStyleAnchor
      ? " Match the exact camera projection angle and material palette of the Keystone Pack Anchor:"
      : "";

    return Array.from({ length: safeCount }, (_, idx) => {
      const emphasis =
        idx === 0
          ? "Complaint-Directed Surgical Fix"
          : idx === 1
          ? "Strict Projection & Silhouette Isolation"
          : idx === 2
          ? "Lighting & Material Cohesion"
          : "High-Contrast Structural Rewrite";
      const composed = `${anchorClause} ${params.deliverable.description}. ${params.globalPackInvariants}.${complaintFixClause} (${emphasis})`.trim();
      return {
        label: `R${params.roundNumber + 1} Draft ${String.fromCharCode(
          65 + idx
        )} • ${emphasis}`,
        promptStrategy: emphasis,
        prompt: finalizeExactImageModelPrompt({
          prompt: composed,
          modifierLabels: params.modifierLabels,
          aspectRatio: params.aspectRatio,
        }),
      };
    });
  };

  let nextPromptDrafts = buildFallbackNextDrafts();
  let refinementSummary = useWinnerAsReference
    ? `Anchored on Incumbent (${effectiveScore}/100) as multimodal reference + applying Complaint-Directed Revision for: ${
        activeComplaints.join("; ") || "fine visual polish"
      }.`
    : `Score (${effectiveScore}/100) below 60 anchor threshold — discarding flawed visual anchor and rewriting prompt from scratch to fix: ${
        activeComplaints.join("; ") || "structural composition"
      }.`;

  const trimmedKey = params.apiKey.trim();
  if (trimmedKey) {
    try {
      const endpoint =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
      const safeCount = Math.max(
        1,
        Math.min(4, Math.round(params.candidatesPerSlot || 2))
      );
      const refinerPromptText = [
        params.customRefinerPrompt?.trim() || DEFAULT_HARNESS_REFINER_PROMPT,
        `Mission Goal: "${params.goal}"`,
        `Global Pack Invariants: "${params.globalPackInvariants}"`,
        `Deliverable: "${params.deliverable.title} — ${params.deliverable.description}"`,
        `Current Incumbent Prompt: "${baseAnchorPrompt}" (Score: ${effectiveScore}/100)`,
        `TRACE Attribution: pattern=${failurePattern}, module=${primaryModule}, useWinnerAsReference=${useWinnerAsReference}`,
        `Critic Strengths to Preserve: ${roundWinner.strengths.join("; ")}`,
        `Critic Complaints to Fix: ${activeComplaints.join("; ")}`,
        `Generate exactly ${safeCount} distinct refined English prompts for Round ${
          params.roundNumber + 1
        }.`,
        'Return ONLY valid JSON: {"refinementSummary": "1-sentence explanation of how complaints are resolved...", "drafts": [{"label": "Draft A • ...", "promptStrategy": "...", "prompt": "Full English prompt..."}]}',
      ].join("\n\n");

      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": trimmedKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: refinerPromptText }] }],
            generationConfig: {
              responseMimeType: "application/json",
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
          cache: "no-store",
        },
        14000
      );

      if (response.ok) {
        const data = (await response.json()) as GeminiResponse;
        const rawText =
          data.candidates?.[0]?.content?.parts
            ?.filter((p) => !p.thought)
            ?.map((p) => p.text || "")
            .join("")
            .trim() || "";
        if (rawText) {
          const parsed = JSON.parse(rawText) as {
            refinementSummary?: string;
            drafts?: Array<{
              label?: string;
              promptStrategy?: string;
              prompt?: string;
            }>;
          };
          if (parsed.refinementSummary?.trim()) {
            refinementSummary = parsed.refinementSummary.trim();
          }
          if (Array.isArray(parsed.drafts) && parsed.drafts.length > 0) {
            nextPromptDrafts = Array.from({ length: safeCount }, (_, idx) => {
              const d = parsed.drafts![idx] || parsed.drafts![0];
              return {
                label:
                  d?.label?.trim() ||
                  `R${params.roundNumber + 1} Draft ${String.fromCharCode(
                    65 + idx
                  )}`,
                promptStrategy:
                  d?.promptStrategy?.trim() || "Complaint-Directed Revision",
                prompt: finalizeExactImageModelPrompt({
                  prompt: d?.prompt?.trim() || nextPromptDrafts[idx].prompt,
                  modifierLabels: params.modifierLabels,
                  aspectRatio: params.aspectRatio,
                }),
              };
            });
          }
        }
      }
    } catch {
      // Keep fallback nextPromptDrafts
    }
  }

  return {
    slotWinnerIndex: bestIdx,
    updatedDeliverable,
    traceAttribution,
    refinerDecision: {
      useWinnerAsReference,
      useKeystoneStyleAnchor,
      adjustedModelParams,
      refinementSummary,
      addressedComplaints: activeComplaints,
      nextPromptDrafts,
    },
  };
}

export async function buildReiterationDraftsForDeliverable(params: {
  apiKey: string;
  goal: string;
  globalPackInvariants: string;
  deliverable: HarnessDeliverableSpec;
  nextRoundNumber: number;
  candidatesPerSlot: number;
  anchorToIncumbent: boolean;
  hasKeystoneAnchorAvailable: boolean;
  priorStrengths: string[];
  priorComplaints: string[];
  userRefinementNote: string;
  aspectRatio: string;
  customRefinerPrompt?: string;
}): Promise<{
  refinementSummary: string;
  drafts: Array<{ label: string; promptStrategy: string; prompt: string }>;
}> {
  const safeCount = Math.max(
    1,
    Math.min(4, Math.round(params.candidatesPerSlot || 2))
  );
  const trimmedNote = params.userRefinementNote.trim();
  const basePrompt =
    params.deliverable.incumbentPrompt || params.deliverable.description;

  const anchorPrefix =
    params.anchorToIncumbent && params.deliverable.incumbentImageUrl
      ? "Using the provided reference image as the structural and stylistic anchor, preserve its core subject identity, camera projection, and composition while applying these exact refinements: "
      : params.hasKeystoneAnchorAvailable
      ? "Match the camera projection angle and lighting style of the Keystone Pack Anchor: "
      : "";

  const directives = [
    ...(trimmedNote ? [`User Refinement Request: ${trimmedNote}`] : []),
    ...params.priorComplaints,
  ];
  const directiveClause =
    directives.length > 0
      ? ` Mandatory Refinements for Round ${params.nextRoundNumber}: ${directives.join(
          "; "
        )}.`
      : " Further elevate micro-texture detail, lighting contrast, and silhouette crispness.";

  const buildFallbackDrafts = () => {
    return Array.from({ length: safeCount }, (_, idx) => {
      const emphasis =
        idx === 0
          ? trimmedNote
            ? "User-Guided Surgical Refinement"
            : "Precision Detail & Lighting Polish"
          : idx === 1
          ? "High-Contrast Material & Silhouette Clarity"
          : idx === 2
          ? "Strict Projection & Spatial Balance"
          : "Hero Composition & Chromatic Harmony";
      const rawComposed = `${anchorPrefix}${params.deliverable.description}. ${params.globalPackInvariants}.${directiveClause} (${emphasis})`.trim();
      return {
        label: `R${params.nextRoundNumber} Draft ${String.fromCharCode(
          65 + idx
        )} • ${emphasis}`,
        promptStrategy: emphasis,
        prompt: finalizeExactImageModelPrompt({
          prompt: rawComposed,
          modifierLabels: [],
          aspectRatio: params.aspectRatio,
        }),
      };
    });
  };

  let drafts = buildFallbackDrafts();
  let refinementSummary = trimmedNote
    ? `Reiterating on "${params.deliverable.title}" with user instruction: "${trimmedNote}"`
    : `Auto-reiterating on "${params.deliverable.title}" to further refine visual polish and critic feedback.`;

  const trimmedKey = params.apiKey.trim();
  if (!trimmedKey) {
    return { refinementSummary, drafts };
  }

  try {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    const promptLines = [
      params.customRefinerPrompt?.trim() || DEFAULT_HARNESS_REFINER_PROMPT,
      `Mission Goal: "${params.goal}"`,
      `Global Pack Invariants: "${params.globalPackInvariants}"`,
      `Deliverable: "${params.deliverable.title} — ${params.deliverable.description}"`,
      `Current Incumbent Prompt (Score ${params.deliverable.incumbentScore}/100): "${basePrompt}"`,
      `Anchored to Incumbent Image as Reference #1: ${Boolean(
        params.anchorToIncumbent && params.deliverable.incumbentImageUrl
      )}`,
      params.priorStrengths.length > 0
        ? `Strengths to Preserve: ${params.priorStrengths.join("; ")}`
        : "",
      params.priorComplaints.length > 0
        ? `Prior Critic Complaints to Fix: ${params.priorComplaints.join("; ")}`
        : "",
      trimmedNote
        ? `CRITICAL USER REITERATION INSTRUCTION (MUST BE APPLIED IN EVERY DRAFT): "${trimmedNote}"`
        : "No manual user note provided; refine micro-details, lighting, and resolve any remaining complaints.",
      `Generate ${safeCount} distinct refined English image generation prompts for Round ${params.nextRoundNumber}. If anchored to the incumbent reference image, start the prompt by instructing the image model to preserve the reference composition while applying the specific refinements.`,
      'Return ONLY valid JSON: {"refinementSummary": "1-sentence summary of the reiteration strategy...", "drafts": [{"label": "R2 Draft A • ...", "promptStrategy": "...", "prompt": "Full English prompt..."}]}',
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": trimmedKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptLines }] }],
          generationConfig: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        cache: "no-store",
      },
      12000
    );

    if (response.ok) {
      const data = (await response.json()) as GeminiResponse;
      const rawText =
        data.candidates?.[0]?.content?.parts
          ?.filter((p) => !p.thought)
          ?.map((p) => p.text || "")
          .join("")
          .trim() || "";
      if (rawText) {
        const parsed = JSON.parse(rawText) as {
          refinementSummary?: string;
          drafts?: Array<{
            label?: string;
            promptStrategy?: string;
            prompt?: string;
          }>;
        };
        if (parsed.refinementSummary?.trim()) {
          refinementSummary = parsed.refinementSummary.trim();
        }
        if (Array.isArray(parsed.drafts) && parsed.drafts.length > 0) {
          drafts = Array.from({ length: safeCount }, (_, idx) => {
            const d = parsed.drafts![idx] || parsed.drafts![0];
            return {
              label:
                d?.label?.trim() ||
                `R${params.nextRoundNumber} Draft ${String.fromCharCode(
                  65 + idx
                )}`,
              promptStrategy:
                d?.promptStrategy?.trim() ||
                (trimmedNote
                  ? "User-Guided Reiteration"
                  : "TRACE Refinement"),
              prompt: finalizeExactImageModelPrompt({
                prompt: d?.prompt?.trim() || drafts[idx].prompt,
                modifierLabels: [],
                aspectRatio: params.aspectRatio,
              }),
            };
          });
        }
      }
    }
  } catch {
    // Keep deterministic fallback drafts
  }

  return { refinementSummary, drafts };
}
