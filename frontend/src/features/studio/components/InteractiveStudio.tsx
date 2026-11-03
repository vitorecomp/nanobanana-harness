"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  BootstrapResponse,
  CanonicalDnaReference,
  CreationFlowMode,
  ExplorationMatrixAxis,
  NanoBananaModel,
  PreservationLocks,
  SessionFrame,
} from "../types/studio.types";
import {
  enhanceNarrativeWithGemini,
  generateQuadWithNanoBanana,
  imageUrlToInlinePart,
  parseDataUrl,
  QuadGeneratedSlot,
} from "../services/nanobananaClient";
import { GoogleUserProfile, LOCAL_DEV_USER } from "@/features/auth";
import { useStudioSession } from "@/core/context/StudioSessionContext";
import {
  createConversation,
  getConversationDetail,
  listUserConversations,
  saveConversationTurn,
  updateConversationDna,
  updateTurnSelection,
} from "@/features/history";

export type { SessionFrame };

export interface StudioInteractionRound {
  id: string;
  turnNumber: number;
  parentTurnNumber: number | null;
  basePrompt: string;
  chosenPrompt: string;
  chosenImageUrl: string;
  selectedVariantIndex: number;
  aspectRatio: string;
  editInstruction?: string | null;
  variants: QuadGeneratedSlot[];
}

const ASPECT_RATIO_OPTIONS = ["1:1", "3:4", "4:3", "16:9", "9:16"] as const;

const EXPLORATION_MATRIX_OPTIONS: Array<{
  id: ExplorationMatrixAxis;
  label: string;
  shortTag: string;
  blueprints: Array<{ code: string; title: string; caption: string }>;
}> = [
  {
    id: "auto-director",
    label: "🎬 Auto Director",
    shortTag: "1 Base + 3 Emphases",
    blueprints: [
      {
        code: "01 • Base Prompt",
        title: "Direct Scene Fidelity",
        caption:
          "Faithful interpretation of your primary prompt combined with your active style and modifiers.",
      },
      {
        code: "02 • Dynamic Emphasis I",
        title: "Light, Mood & Atmosphere",
        caption:
          "Gemini isolates the lighting and atmosphere of your scene to craft a dramatic visual reading.",
      },
      {
        code: "03 • Dynamic Emphasis II",
        title: "Framing & Optics",
        caption:
          "Second Gemini variation highlighting camera perspective, depth of field, and spatial geometry.",
      },
      {
        code: "04 • Dynamic Emphasis III",
        title: "Material, Texture & Subject",
        caption:
          "Third variation focused on surface micro-details, material richness, and character expression.",
      },
    ],
  },
  {
    id: "camera-angles",
    label: "🎥 4 Camera Angles",
    shortTag: "24mm • 50mm • 85mm • Low",
    blueprints: [
      {
        code: "01 • 24mm Wide",
        title: "Establishing Wide Shot",
        caption:
          "Full environmental scale and architectural context with 24mm cinema optics.",
      },
      {
        code: "02 • 50mm Medium",
        title: "Editorial Medium Frame",
        caption:
          "Natural eye-level 50mm framing balancing character posture and scene depth.",
      },
      {
        code: "03 • 85mm Close-Up",
        title: "Intimate Portrait Optics",
        caption:
          "Shallow f/1.4 depth of field isolating facial expression and fine textures.",
      },
      {
        code: "04 • 35mm Low Hero",
        title: "Dramatic Low-Angle Hero",
        caption:
          "Upward-looking 35mm perspective adding monumental presence and dynamic lines.",
      },
    ],
  },
  {
    id: "lighting-setups",
    label: "💡 4 Lighting Setups",
    shortTag: "Golden • Noir • Mist • Neon",
    blueprints: [
      {
        code: "01 • Golden Rim",
        title: "Golden Hour Backlight",
        caption:
          "Warm low-angle sunlight with luminous rim highlights and long sculpted shadows.",
      },
      {
        code: "02 • Chiaroscuro",
        title: "High-Contrast Noir",
        caption:
          "Dramatic single-source key light carving subject geometry out of deep shadow.",
      },
      {
        code: "03 • Overcast Mist",
        title: "Soft Diffused Atmosphere",
        caption:
          "Delicate skylight filtering through volumetric mist with painterly tonal transitions.",
      },
      {
        code: "04 • Dual-Tone Neon",
        title: "Cyan & Amber Practicals",
        caption:
          "Cybernetic color contrast pairing cool cyan key light with warm amber reflections.",
      },
    ],
  },
  {
    id: "wardrobe-variants",
    label: "🧥 4 Wardrobe Variants",
    shortTag: "4 Costume Explorations",
    blueprints: [
      {
        code: "01 • Technical",
        title: "Bespoke Technical Outerwear",
        caption:
          "Matte ballistic textiles, structured collar geometry, and precision metal fasteners.",
      },
      {
        code: "02 • Artisanal",
        title: "Ceremonial Silk & Leather",
        caption:
          "Draped raw silk layers, embroidered motifs, and weathered heirloom leatherwork.",
      },
      {
        code: "03 • Avant-Garde",
        title: "Sculptural Minimalist",
        caption:
          "Clean monochrome tailoring with sharp architectural silhouettes.",
      },
      {
        code: "04 • Field Gear",
        title: "Weathered Expedition Attire",
        caption:
          "Lived-in waxed canvas cloak, brass clasps, and rain-worn rugged textures.",
      },
    ],
  },
  {
    id: "storyboard-4",
    label: "🎞️ 4-Frame Storyboard",
    shortTag: "Sequential Narrative Beats",
    blueprints: [
      {
        code: "01 • Beat I",
        title: "Arrival & Establishing",
        caption:
          "Opening narrative beat introducing the character within the world.",
      },
      {
        code: "02 • Beat II",
        title: "Discovery & Rising Tension",
        caption:
          "Medium tracking beat as the subject reacts to a pivotal element.",
      },
      {
        code: "03 • Beat III",
        title: "Decisive Climax Moment",
        caption:
          "Close dynamic angle capturing the peak emotional or kinetic action.",
      },
      {
        code: "04 • Beat IV",
        title: "Aftermath & Resolution",
        caption:
          "Contemplative pull-back frame showing the lingering atmosphere.",
      },
    ],
  },
];

const SURGICAL_DELTA_QUICK_CHIPS = [
  {
    label: "💡 Golden Hour Rim",
    delta: "Change lighting to warm golden-hour rim sunlight with long dramatic shadows",
  },
  {
    label: "🎥 85mm Close-Up",
    delta: "Reframe as an intimate 85mm f/1.4 close-up portrait focusing on eyes and expression",
  },
  {
    label: "🌧️ Add Rain & Neon",
    delta: "Add fine atmospheric rain and wet reflections with subtle amber and cyan practical lights",
  },
  {
    label: "🧥 Crimson Leather Jacket",
    delta: "Change wardrobe to a tailored crimson weathered leather jacket with brass zippers",
  },
  {
    label: "🌆 Minimalist Studio Backdrop",
    delta: "Replace the background with a clean architectural concrete atelier bathed in soft skylight",
  },
] as const;

const ATELIER_SCENE_STARTERS = [
  {
    label: "✦ Samurai in Rainy Alley",
    prompt:
      "Cinematic portrait of a cybernetic swordswoman under fine rain in an alley lit by amber paper lanterns and Prussian-blue reflections on wet asphalt",
  },
  {
    label: "✦ Sunlit Botanical Atelier",
    prompt:
      "Interior of an architectural studio bathed in late-afternoon golden sunlight, wooden table with exotic plants, brass instruments, and drafted scrolls",
  },
  {
    label: "✦ Brutalist Cliff Observatory",
    prompt:
      "Sculptural concrete astronomical observatory atop a coastal cliff at dusk, amber and vermilion sky over a deep ink ocean",
  },
] as const;

const PROMPT_COMPLETENESS_PILLARS = [
  {
    id: "subject",
    label: "👤 Subject",
    regex:
      /\b(woman|man|girl|boy|samurai|swordswoman|explorer|character|figure|portrait|person|warrior|architect|monk|traveler|pilot|hero|silhouette|robot|cyborg|interior|observatory)\b/i,
    suggestions: [
      {
        label: "Expressive gaze & posture",
        snippet: "with an expressive focused gaze and poised dynamic posture",
      },
      {
        label: "Tailored technical attire",
        snippet: "wearing tailored technical outerwear with weathered brass fasteners",
      },
      {
        label: "Artisanal silk & leather",
        snippet: "draped in layered raw silk garments with heirloom leather strapping",
      },
    ],
  },
  {
    id: "environment",
    label: "🌆 Environment",
    regex:
      /\b(alley|street|studio|atelier|cliff|city|forest|temple|room|landscape|courtyard|rain|mist|sky|ocean|horizon|architecture|backdrop|garden|bridge|station)\b/i,
    suggestions: [
      {
        label: "Rain-slicked lantern alley",
        snippet: "set in a rain-slicked cobblestone alley lined with glowing paper lanterns",
      },
      {
        label: "Sunlit concrete atelier",
        snippet: "inside a minimalist architectural concrete atelier with tall skylights",
      },
      {
        label: "Misty coastal cliff",
        snippet: "overlooking a misty coastal cliff against a deep Prussian-blue horizon",
      },
    ],
  },
  {
    id: "camera",
    label: "🎥 Camera",
    regex:
      /\b(24mm|35mm|50mm|85mm|lens|close-up|closeup|wide|angle|framing|depth of field|f\/1|bokeh|telephoto|anamorphic|eye-level|low-angle|establishing)\b/i,
    suggestions: [
      {
        label: "85mm f/1.4 Portrait",
        snippet: "captured on an 85mm f/1.4 portrait lens with shallow depth of field",
      },
      {
        label: "35mm Cinematic Street",
        snippet: "framed with a 35mm cinema lens for natural spatial depth",
      },
      {
        label: "24mm Low-Angle Hero",
        snippet: "shot from a dramatic 24mm low-angle hero perspective",
      },
    ],
  },
  {
    id: "lighting",
    label: "💡 Lighting",
    regex:
      /\b(light|lighting|sunlight|golden|hour|rim|shadow|chiaroscuro|neon|lantern|glow|dusk|dawn|amber|backlit|volumetric|overcast|skylight|illumination)\b/i,
    suggestions: [
      {
        label: "Warm Golden Hour Rim",
        snippet: "bathed in warm late-afternoon golden-hour rim sunlight with long shadows",
      },
      {
        label: "Chiaroscuro Contrast",
        snippet: "lit with dramatic chiaroscuro key light and deep sculpted ink shadows",
      },
      {
        label: "Amber & Cyan Reflections",
        snippet: "illuminated by warm amber practicals and cool cyan atmospheric fill",
      },
    ],
  },
  {
    id: "texture",
    label: "✨ Texture & Mood",
    regex:
      /\b(texture|grain|film|cel-shaded|ink|watercolor|linen|paper|patina|wet|asphalt|silk|leather|concrete|brass|tactile|micro-texture|cinematic|editorial)\b/i,
    suggestions: [
      {
        label: "Tactile fabric & film grain",
        snippet: "featuring tactile fabric weave, subtle 35mm film grain, and crisp ink contours",
      },
      {
        label: "Washi paper & sumi ink",
        snippet: "rendered with archival washi paper tooth and bold sumi-e ink brushwork",
      },
      {
        label: "Wet specular reflections",
        snippet: "with crisp specular reflections on wet surfaces and rich atmospheric haze",
      },
    ],
  },
] as const;

function normalizeSlotLabelToEnglish(rawLabel: string | undefined, idx: number): string {
  if (!rawLabel) return `Variation #${idx + 1}`;
  return rawLabel
    .replace("Prompt Base", "Base Prompt")
    .replace("Ênfase:", "Emphasis:")
    .replace("Versão #", "Variation #");
}

function normalizeProjectTitleToEnglish(rawTitle: string | undefined): string {
  if (!rawTitle || rawTitle.trim() === "Novo Projeto" || rawTitle.trim() === "Sem título") {
    return "New Project";
  }
  return rawTitle;
}

interface InteractiveStudioProps {
  bootstrapData: BootstrapResponse;
  backendOnline: boolean;
  apiKey: string;
  setApiKey: (key: string) => void;
  rememberKeyInVault?: boolean;
  setRememberKeyInVault?: (remember: boolean) => void;
  googleUser: GoogleUserProfile | null;
  externalPresetRequest?: {
    idea: string;
    prompt?: string;
    imageUrl?: string;
    styleId?: string;
    conversationId?: string;
    turn?: number;
    nonce: number;
  } | null;
}

export default function InteractiveStudio({
  bootstrapData,
  apiKey,
  googleUser,
  externalPresetRequest,
}: InteractiveStudioProps) {
  const activeUser = googleUser || LOCAL_DEV_USER;
  const {
    activeProjectId,
    setActiveProjectId,
    activeProjectTitle: projectTitle,
    setActiveProjectTitle: setProjectTitle,
    newProjectNonce,
    openSettingsModal,
  } = useStudioSession();
  const [model] = useState<NanoBananaModel>("gemini-2.5-flash-image");

  const [promptInput, setPromptInput] = useState<string>("");
  const [deltaInput, setDeltaInput] = useState<string>("");
  const [flowMode, setFlowMode] = useState<CreationFlowMode>("compose");
  const [matrixAxis, setMatrixAxis] =
    useState<ExplorationMatrixAxis>("auto-director");
  const [showPromptHints, setShowPromptHints] = useState<boolean>(false);
  const [activeParamTab, setActiveParamTab] = useState<
    "matrix" | "style" | "modifiers"
  >("matrix");
  const [preservationLocks, setPreservationLocks] = useState<PreservationLocks>(
    {
      keepCharacter: true,
      keepPose: false,
      keepBackground: false,
    }
  );
  const [canonicalDnaRef, setCanonicalDnaRef] =
    useState<CanonicalDnaReference | null>(null);
  const [isEnhancingNarrative, setIsEnhancingNarrative] =
    useState<boolean>(false);
  const [preEnhancePrompt, setPreEnhancePrompt] = useState<string | null>(null);
  const [activePillarId, setActivePillarId] = useState<string | null>(null);
  const [lightboxCompareMode, setLightboxCompareMode] =
    useState<boolean>(false);
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedStyleId, setSelectedStyleId] =
    useState<string>("editorial-anime");
  const [selectedAspectRatio, setSelectedAspectRatio] =
    useState<string>("3:4");
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([
    "golden-hour",
    "lens-85mm",
  ]);
  const [activeModCategoryId, setActiveModCategoryId] = useState<string>(
    bootstrapData.modifier_categories[0]?.id || "camera"
  );
  const [useReferenceImage, setUseReferenceImage] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStage, setGenerationStage] = useState<
    "idle" | "analyzing-scene" | "rendering-images"
  >("idle");
  const [liveDraftSlots, setLiveDraftSlots] = useState<
    Array<QuadGeneratedSlot | null>
  >([null, null, null, null]);
  const [completedSlotsCount, setCompletedSlotsCount] = useState<number>(0);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Lightbox modal state for inspecting any of the 4 generated images at full resolution
  const [lightboxSlot, setLightboxSlot] = useState<{
    slot: QuadGeneratedSlot;
    index: number;
    turnNumber: number;
  } | null>(null);

  // Interactions history in the left timeline; center shows ONLY the active/latest generation's 4 slots
  const [interactions, setInteractions] = useState<StudioInteractionRound[]>(
    []
  );
  const [activeInteractionIndex, setActiveInteractionIndex] =
    useState<number>(-1);

  const showTransientNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
  }, []);

  useEffect(() => {
    if (!statusNotice) return;
    const timer = window.setTimeout(() => setStatusNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [statusNotice]);

  const loadProjectById = useCallback(
    async (convId: string) => {
      setActiveProjectId(convId);
      const detail = await getConversationDetail(convId, activeUser.id);
      if (!detail) return;
      setProjectTitle(normalizeProjectTitleToEnglish(detail.title));
      if (detail.style_id) setSelectedStyleId(detail.style_id);
      setCanonicalDnaRef(detail.canonical_dna || null);
      setPreEnhancePrompt(null);

      const loadedRounds: StudioInteractionRound[] = detail.turns.map((t) => {
        const savedVars = Array.isArray(t.variants) ? t.variants : [];
        const paddedVariants: QuadGeneratedSlot[] =
          savedVars.length > 0
            ? savedVars.map((v, i) => ({
                label: normalizeSlotLabelToEnglish(v.label, i),
                prompt: v.prompt || t.master_prompt,
                imageUrl: v.imageUrl || "",
                mimeType: "image/png",
                base64Data: "",
              }))
            : [
                {
                  label: "1 • Base Prompt",
                  prompt: t.master_prompt || "",
                  imageUrl: t.image_url || "",
                  mimeType: "image/png",
                  base64Data: "",
                },
              ];

        const selIdx = Math.min(
          Math.max(0, Number(t.selected_variant_index ?? 0)),
          Math.max(0, paddedVariants.length - 1)
        );
        const chosen = paddedVariants[selIdx] || paddedVariants[0];

        return {
          id: t.id,
          turnNumber: t.turn_number,
          parentTurnNumber:
            t.parent_turn_number !== undefined && t.parent_turn_number !== null
              ? Number(t.parent_turn_number)
              : t.turn_number > 1
              ? t.turn_number - 1
              : null,
          basePrompt: t.raw_idea || t.master_prompt,
          chosenPrompt: t.master_prompt || chosen?.prompt || "",
          chosenImageUrl: t.image_url || chosen?.imageUrl || "",
          selectedVariantIndex: selIdx,
          aspectRatio: t.aspect_ratio || "3:4",
          editInstruction: t.edit_instruction || null,
          variants: paddedVariants,
        };
      });

      setInteractions(loadedRounds);
      if (loadedRounds.length > 0) {
        const lastIdx = loadedRounds.length - 1;
        const lastRound = loadedRounds[lastIdx];
        setActiveInteractionIndex(lastIdx);
        setPromptInput(lastRound.chosenPrompt);
        setDeltaInput("");
        if (lastRound.aspectRatio) {
          setSelectedAspectRatio(lastRound.aspectRatio);
        }
        setFlowMode("compose");
      } else {
        setActiveInteractionIndex(-1);
        setPromptInput("");
        setDeltaInput("");
        setFlowMode("compose");
      }
    },
    [activeUser.id, setActiveProjectId, setProjectTitle]
  );

  // Load project from /gallery selection or load the latest project on screen
  useEffect(() => {
    if (externalPresetRequest?.conversationId) {
      void loadProjectById(externalPresetRequest.conversationId);
      return;
    }
    if (newProjectNonce > 0) {
      return;
    }
    listUserConversations(activeUser.id).then((list) => {
      if (list.length > 0) {
        void loadProjectById(list[0].id);
      }
    });
  }, [externalPresetRequest, activeUser.id, loadProjectById, newProjectNonce]);

  const activeInteraction =
    activeInteractionIndex >= 0 ? interactions[activeInteractionIndex] : null;

  // Close lightbox on Escape & navigate across the 4 variations with ArrowLeft / ArrowRight
  useEffect(() => {
    if (!lightboxSlot) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxSlot(null);
      } else if (
        (e.key === "ArrowRight" || e.key === "ArrowLeft") &&
        activeInteraction
      ) {
        const validVariants = activeInteraction.variants
          .map((slot, idx) => ({ slot, idx }))
          .filter((item) => Boolean(item.slot?.imageUrl));
        if (validVariants.length <= 1) return;
        const currentPos = validVariants.findIndex(
          (item) => item.idx === lightboxSlot.index
        );
        if (currentPos < 0) return;
        const delta = e.key === "ArrowRight" ? 1 : -1;
        const nextPos =
          (currentPos + delta + validVariants.length) % validVariants.length;
        const nextItem = validVariants[nextPos];
        setLightboxSlot({
          slot: nextItem.slot,
          index: nextItem.idx,
          turnNumber: activeInteraction.turnNumber,
        });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxSlot, activeInteraction]);

  // Reset to a completely empty new project when triggered from Sidebar
  useEffect(() => {
    if (newProjectNonce === 0) return;
    setActiveProjectId(null);
    setPromptInput("");
    setDeltaInput("");
    setPreEnhancePrompt(null);
    setActivePillarId(null);
    setFlowMode("compose");
    setMatrixAxis("auto-director");
    setCanonicalDnaRef(null);
    setInteractions([]);
    setActiveInteractionIndex(-1);
    setLightboxSlot(null);
    setLiveDraftSlots([null, null, null, null]);
    setGenerationStage("idle");
    showTransientNotice("✦ New project started with 4 ready frames");
  }, [newProjectNonce, setActiveProjectId, showTransientNotice]);

  const handleToggleModifier = (modId: string) => {
    setSelectedModifiers((prev) =>
      prev.includes(modId) ? prev.filter((m) => m !== modId) : [...prev, modId]
    );
  };

  const handleToggleLock = (lockKey: keyof PreservationLocks) => {
    setPreservationLocks((prev) => ({
      ...prev,
      [lockKey]: !prev[lockKey],
    }));
  };

  const handleEnhanceNarrative = async () => {
    const raw = promptInput.trim();
    if (!raw || isEnhancingNarrative || isGenerating) return;
    setIsEnhancingNarrative(true);
    try {
      const activeStyleObj =
        bootstrapData.style_presets.find((s) => s.id === selectedStyleId) ||
        bootstrapData.style_presets[0];
      const allModifierOpts = bootstrapData.modifier_categories.flatMap(
        (c) => c.options
      );
      const activeModifierLabels = selectedModifiers
        .map((id) => {
          const found = allModifierOpts.find((o) => o.id === id);
          if (!found) return null;
          return found.token || found.label.split(" (")[0];
        })
        .filter((x): x is string => Boolean(x));

      const enhanced = await enhanceNarrativeWithGemini({
        apiKey,
        rawIdea: raw,
        styleLabel: activeStyleObj?.title.split(" (")[0],
        modifierLabels: activeModifierLabels,
        aspectRatio: selectedAspectRatio,
      });
      if (enhanced) {
        setPreEnhancePrompt(raw);
        setPromptInput(enhanced);
        showTransientNotice("✦ Narrative enhanced for Gemini Nano Banana");
      }
    } finally {
      setIsEnhancingNarrative(false);
    }
  };

  const handleUndoEnhance = () => {
    if (!preEnhancePrompt) return;
    setPromptInput(preEnhancePrompt);
    setPreEnhancePrompt(null);
    showTransientNotice("↺ Reverted to original scene prompt");
  };

  const handleUploadReferenceFile = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      if (typeof reader.result === "string") {
        const nextDna: CanonicalDnaReference = {
          label: `Uploaded: ${file.name}`,
          imageUrl: reader.result,
          prompt: promptInput.trim() || "Uploaded visual reference",
        };
        setCanonicalDnaRef(nextDna);
        setUseReferenceImage(true);
        if (activeProjectId) {
          const savedDna = await updateConversationDna(activeProjectId, nextDna);
          if (savedDna) {
            setCanonicalDnaRef(savedDna);
          }
        }
        showTransientNotice(`📤 Reference "${file.name}" locked as DNA anchor`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handlePinCanonicalDna = async (
    slot: QuadGeneratedSlot,
    turnNum: number
  ) => {
    if (!slot.imageUrl) return;
    const nextDna: CanonicalDnaReference = {
      label: `Turn #${turnNum} • ${slot.label}`,
      imageUrl: slot.imageUrl,
      prompt: slot.prompt,
      sourceTurn: turnNum,
    };
    setCanonicalDnaRef(nextDna);
    setUseReferenceImage(true);
    if (activeProjectId) {
      const savedDna = await updateConversationDna(activeProjectId, nextDna);
      if (savedDna) {
        setCanonicalDnaRef(savedDna);
      }
    }
    showTransientNotice(
      `🧬 Turn #${turnNum} (${slot.label}) pinned as Canonical Character DNA`
    );
  };

  const handleClearCanonicalDna = async () => {
    setCanonicalDnaRef(null);
    if (activeProjectId) {
      await updateConversationDna(activeProjectId, null);
    }
    showTransientNotice("Canonical Character DNA unpinned");
  };

  // User clicks one of the 4 generated cards to choose the one they like best and modify its prompt
  const handleChooseVariant = async (
    variantIdx: number,
    nextFlowMode?: CreationFlowMode
  ) => {
    if (activeInteractionIndex < 0) return;
    const currentRound = interactions[activeInteractionIndex];
    if (!currentRound) return;
    const chosenSlot = currentRound.variants[variantIdx];
    if (!chosenSlot) return;

    setPromptInput(chosenSlot.prompt);
    if (nextFlowMode) {
      setFlowMode(nextFlowMode);
    }
    showTransientNotice(
      nextFlowMode === "surgical-delta"
        ? `⚡ "${chosenSlot.label}" locked for Surgical Delta edit`
        : `✓ "${chosenSlot.label}" selected — prompt loaded into editor`
    );

    setInteractions((prev) =>
      prev.map((round, rIdx) =>
        rIdx === activeInteractionIndex
          ? {
              ...round,
              selectedVariantIndex: variantIdx,
              chosenPrompt: chosenSlot.prompt,
              chosenImageUrl: chosenSlot.imageUrl,
            }
          : round
      )
    );

    await updateTurnSelection({
      turnId: currentRound.id,
      selectedVariantIndex: variantIdx,
      masterPrompt: chosenSlot.prompt,
      imageDataUrl: chosenSlot.imageUrl || undefined,
    });
  };

  const customSweepCategory = matrixAxis.startsWith("cat:")
    ? bootstrapData.modifier_categories.find(
        (c) => `cat:${c.id}` === matrixAxis
      ) || null
    : null;

  const activeMatrixConfig = customSweepCategory
    ? {
        id: matrixAxis,
        label: `⚡ 4 ${
          customSweepCategory.title.split(" & ")[0].split(" (")[0]
        }`,
        shortTag: `4-Way ${
          customSweepCategory.title.split(" & ")[0].split(" (")[0]
        } Sweep`,
        blueprints: [0, 1, 2, 3].map((idx) => {
          const opt =
            customSweepCategory.options[
              idx % Math.max(1, customSweepCategory.options.length)
            ];
          return {
            code: `0${idx + 1} • ${
              customSweepCategory.title.split(" & ")[0].split(" (")[0]
            }`,
            title: opt ? opt.label.split(" (")[0] : `Variation #${idx + 1}`,
            caption: opt
              ? opt.token
              : "Modifier variation from your custom library.",
          };
        }),
      }
    : EXPLORATION_MATRIX_OPTIONS.find((m) => m.id === matrixAxis) ||
      EXPLORATION_MATRIX_OPTIONS[0];

  // Main flow: supports both Compose Scene mode and Surgical Delta Edit mode + 2x2 Matrix Axis + Dual-Anchor (Canonical DNA + Turn Reference)
  const handleGenerateInteraction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const isSurgicalActive =
      flowMode === "surgical-delta" &&
      Boolean(activeInteraction || canonicalDnaRef?.imageUrl) &&
      Boolean(deltaInput.trim());

    const cleanPrompt = isSurgicalActive
      ? deltaInput.trim()
      : promptInput.trim();
    if (!cleanPrompt || isGenerating) return;

    const effectiveFlowMode: CreationFlowMode = isSurgicalActive
      ? "surgical-delta"
      : "compose";

    setIsGenerating(true);
    setGenerationStage("analyzing-scene");
    setCompletedSlotsCount(0);
    setLiveDraftSlots([
      {
        label:
          effectiveFlowMode === "surgical-delta"
            ? "1 • Surgical Edit: Direct Precision"
            : "1 • Base Prompt",
        prompt: cleanPrompt,
        imageUrl: "",
        mimeType: "image/png",
        base64Data: "",
      },
      null,
      null,
      null,
    ]);

    try {
      const activeStyleObj =
        bootstrapData.style_presets.find((s) => s.id === selectedStyleId) ||
        bootstrapData.style_presets[0];

      const allModifierOpts = bootstrapData.modifier_categories.flatMap(
        (c) => c.options
      );
      const activeModifierLabels = selectedModifiers
        .map((id) => {
          const found = allModifierOpts.find((o) => o.id === id);
          if (!found) return null;
          return found.token || found.label.split(" (")[0];
        })
        .filter((x): x is string => Boolean(x));

      const originRound =
        activeInteractionIndex >= 0
          ? interactions[activeInteractionIndex]
          : null;
      const parentTurnNumber = originRound ? originRound.turnNumber : null;

      // Dual-Anchor Resolution:
      // - If both Canonical DNA and Active Turn image exist (and are distinct), pass both!
      // - Otherwise pass whichever reference exists.
      const dnaUrl = canonicalDnaRef?.imageUrl || "";
      const turnUrl = originRound?.chosenImageUrl || "";
      const hasDistinctDualAnchor =
        Boolean(dnaUrl) && Boolean(turnUrl) && dnaUrl !== turnUrl;

      let primaryReferencePart = null;
      let secondaryReferencePart = null;

      if (useReferenceImage) {
        const primaryUrl = dnaUrl || turnUrl;
        if (primaryUrl) {
          primaryReferencePart =
            parseDataUrl(primaryUrl) || (await imageUrlToInlinePart(primaryUrl));
        }
        if (hasDistinctDualAnchor && turnUrl) {
          secondaryReferencePart =
            parseDataUrl(turnUrl) || (await imageUrlToInlinePart(turnUrl));
        }
      }

      const quadVariants = await generateQuadWithNanoBanana({
        apiKey,
        model,
        basePrompt: cleanPrompt,
        styleLabel: activeStyleObj?.title.split(" (")[0],
        modifierLabels: activeModifierLabels,
        aspectRatio: selectedAspectRatio,
        referenceImage: primaryReferencePart,
        secondaryReferenceImage: secondaryReferencePart,
        flowMode: effectiveFlowMode,
        matrixAxis,
        preservationLocks:
          effectiveFlowMode === "surgical-delta" || Boolean(primaryReferencePart)
            ? preservationLocks
            : undefined,
        anchorScenePrompt:
          effectiveFlowMode === "surgical-delta"
            ? originRound?.chosenPrompt ||
              canonicalDnaRef?.prompt ||
              promptInput.trim()
            : undefined,
        categorySweepTitle: customSweepCategory?.title,
        categorySweepOptions: customSweepCategory?.options.map((o) => ({
          label: o.label,
          token: o.token,
        })),
        onVariationsReady: (variations) => {
          setGenerationStage("rendering-images");
          setLiveDraftSlots(
            variations.map((v) => ({
              label: v.label,
              prompt: v.prompt,
              imageUrl: "",
              mimeType: "image/png",
              base64Data: "",
            }))
          );
        },
        onSlotCompleted: (slotIdx, completedSlot) => {
          setCompletedSlotsCount((prev) => prev + 1);
          setLiveDraftSlots((prev) =>
            prev.map((item, idx) => (idx === slotIdx ? completedSlot : item))
          );
        },
      });

      let targetConvId = activeProjectId;
      if (!targetConvId) {
        const created = await createConversation({
          user_id: activeUser.id,
          title: projectTitle.trim() || "New Project",
          style_id: selectedStyleId,
        });
        targetConvId = created?.id || `conv_${Date.now()}`;
        setActiveProjectId(targetConvId);
        if (canonicalDnaRef) {
          const persistedDna = await updateConversationDna(
            targetConvId,
            canonicalDnaRef
          );
          if (persistedDna) {
            setCanonicalDnaRef(persistedDna);
          }
        }
      }

      const nextTurnNumber = interactions.length + 1;
      const defaultChosen = quadVariants[0];
      const computedEditInstruction =
        effectiveFlowMode === "surgical-delta"
          ? `⚡ Delta: ${cleanPrompt}`
          : matrixAxis !== "auto-director"
          ? `${activeMatrixConfig.label}`
          : parentTurnNumber
          ? `Interaction #${nextTurnNumber} (from #${parentTurnNumber})`
          : `Scene Compose`;

      const savedTurn = await saveConversationTurn(targetConvId, {
        user_id: activeUser.id,
        title: projectTitle.trim() || "New Project",
        parent_turn_number: parentTurnNumber,
        role: "assistant",
        raw_idea: cleanPrompt,
        master_prompt: defaultChosen.prompt,
        edit_instruction: computedEditInstruction,
        style_id: selectedStyleId,
        modifiers: selectedModifiers,
        completeness_score: 95,
        image_data_url: defaultChosen.imageUrl || undefined,
        aspect_ratio: selectedAspectRatio,
        model_used: model,
        variants: quadVariants.map((v) => ({
          label: v.label,
          prompt: v.prompt,
          image_data_url: v.imageUrl,
        })),
        selected_variant_index: 0,
      });

      const persistedVariants: QuadGeneratedSlot[] =
        savedTurn?.variants && savedTurn.variants.length > 0
          ? savedTurn.variants.map((v, i) => ({
              label: normalizeSlotLabelToEnglish(v.label, i),
              prompt: v.prompt,
              imageUrl: v.imageUrl || quadVariants[i]?.imageUrl || "",
              mimeType: "image/png",
              base64Data: "",
            }))
          : quadVariants;

      const newRound: StudioInteractionRound = {
        id: savedTurn?.id || `int-${Date.now()}`,
        turnNumber: nextTurnNumber,
        parentTurnNumber,
        basePrompt: cleanPrompt,
        chosenPrompt: defaultChosen.prompt,
        chosenImageUrl:
          savedTurn?.image_url || persistedVariants[0]?.imageUrl || "",
        selectedVariantIndex: 0,
        aspectRatio: selectedAspectRatio,
        editInstruction: computedEditInstruction,
        variants: persistedVariants,
      };

      setInteractions((prev) => {
        const next = [...prev, newRound];
        setActiveInteractionIndex(next.length - 1);
        return next;
      });
      setPromptInput(defaultChosen.prompt);
      setPreEnhancePrompt(null);
      if (effectiveFlowMode === "surgical-delta") {
        setDeltaInput("");
      }

      const renderedCount = persistedVariants.filter((v) =>
        Boolean(v.imageUrl)
      ).length;
      if (!apiKey.trim()) {
        showTransientNotice(
          "✦ 4 prompt variations created! Add your Gemini API key in ⚙ Settings to render PNGs."
        );
      } else if (renderedCount > 0) {
        showTransientNotice(
          `✦ Interaction #${nextTurnNumber} complete (${renderedCount}/4 frames rendered)`
        );
      }
    } finally {
      setIsGenerating(false);
      setGenerationStage("idle");
      setLiveDraftSlots([null, null, null, null]);
    }
  };

  // Center 2x2 grid shows ONLY the active/latest generation's 4 slots (or live draft slots while generating, or 4 empty blueprint slots on a new project)
  const quadSlots: Array<QuadGeneratedSlot | null> = isGenerating
    ? liveDraftSlots
    : [
        activeInteraction?.variants[0] || null,
        activeInteraction?.variants[1] || null,
        activeInteraction?.variants[2] || null,
        activeInteraction?.variants[3] || null,
      ];

  return (
    <div className="ref-page-container">
      <div className="ref-studio-columns-layout">
        {/* ==================== COLUMN 1 (LEFT SIDE): VERTICAL INTERACTIONS TIMELINE ==================== */}
        <aside
          className="ref-studio-side-timeline"
          aria-label="Interactions History (Timeline)"
        >
          <div className="ref-side-timeline-header">
            <span className="ref-interactions-label">Timeline</span>
            <span className="ref-lime-badge">{interactions.length}</span>
          </div>

          {interactions.length > 0 ? (
            <div className="ref-side-timeline-list">
              {interactions.map((round, idx) => {
                const isCurrent = idx === activeInteractionIndex;
                const isOriginOfCurrent =
                  activeInteraction?.parentTurnNumber === round.turnNumber;

                return (
                  <React.Fragment key={round.id}>
                    {/* Vertical Arrow pointing from the origin interaction of the modification */}
                    {idx > 0 && (
                      <div
                        className={`ref-interaction-arrow-connector vertical ${
                          round.parentTurnNumber &&
                          round.parentTurnNumber !== round.turnNumber - 1
                            ? "branched"
                            : ""
                        }`}
                        title={
                          round.parentTurnNumber
                            ? `Modification branched from Interaction #${round.parentTurnNumber}`
                            : undefined
                        }
                      >
                        {round.parentTurnNumber &&
                        round.parentTurnNumber !== round.turnNumber - 1 ? (
                          <span className="ref-interaction-branch-badge">
                            from #{round.parentTurnNumber} ↓
                          </span>
                        ) : (
                          <span className="ref-interaction-seq-arrow">↓</span>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      className={`ref-interaction-history-item side-card ${
                        isCurrent ? "active" : ""
                      } ${isOriginOfCurrent ? "origin-highlight" : ""}`}
                      onClick={() => {
                        setActiveInteractionIndex(idx);
                        setPromptInput(round.chosenPrompt);
                        if (round.aspectRatio) {
                          setSelectedAspectRatio(round.aspectRatio);
                        }
                      }}
                    >
                      {round.chosenImageUrl ? (
                        <img
                          src={round.chosenImageUrl}
                          alt={`Interaction #${round.turnNumber}`}
                          className="ref-interaction-thumb"
                        />
                      ) : (
                        <div className="ref-interaction-thumb-empty" />
                      )}
                      <div className="ref-interaction-meta">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "6px",
                          }}
                        >
                          <span className="ref-interaction-turn">
                            Interaction #{round.turnNumber}
                          </span>
                          {round.parentTurnNumber && (
                            <span className="ref-interaction-origin-tag">
                              #{round.parentTurnNumber} ➔ #{round.turnNumber}
                            </span>
                          )}
                        </div>
                        {round.editInstruction && (
                          <span className="ref-interaction-mode-badge">
                            {round.editInstruction}
                          </span>
                        )}
                        <span className="ref-interaction-prompt-snippet">
                          {round.chosenPrompt}
                        </span>
                      </div>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div className="ref-side-timeline-empty">
              <span className="ref-atelier-onboarding-sub">
                No interactions yet. Pick a scene seed below or describe your
                scene on the right:
              </span>
              <div className="ref-side-starters-stack">
                <span className="ref-interactions-label">Scene Starters</span>
                {ATELIER_SCENE_STARTERS.map((starter) => (
                  <button
                    key={starter.label}
                    type="button"
                    className={`ref-pill-chip side-starter-chip ${
                      promptInput === starter.prompt ? "active" : ""
                    }`}
                    onClick={() => {
                      setPromptInput(starter.prompt);
                      showTransientNotice(
                        `✦ Starter "${starter.label.replace(
                          "✦ ",
                          ""
                        )}" loaded into editor`
                      );
                    }}
                  >
                    {starter.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ==================== COLUMN 2 (CENTER): 4 IMAGES OF THE LATEST/ACTIVE GENERATION ==================== */}
        <section
          className="ref-studio-left-images-60"
          aria-label="4 images of the current generation"
        >
          <div className="ref-quad-images-grid">
            {quadSlots.map((slot, idx) => {
              const isSelected =
                !isGenerating &&
                slot !== null &&
                activeInteraction?.selectedVariantIndex === idx;
              const blueprint =
                activeMatrixConfig.blueprints[idx] ||
                EXPLORATION_MATRIX_OPTIONS[0].blueprints[idx];

              return (
                <article
                  key={
                    activeInteraction && !isGenerating
                      ? `${activeInteraction.id}-slot-${idx}`
                      : `draft-or-empty-slot-${idx}`
                  }
                  className={`ref-quad-image-card ${
                    isSelected ? "selected" : ""
                  } ${isGenerating ? "is-drafting" : ""}`}
                  onClick={() => {
                    if (!slot || isGenerating) return;
                    void handleChooseVariant(idx);
                  }}
                  onDoubleClick={() => {
                    if (
                      !slot?.imageUrl ||
                      !activeInteraction ||
                      isGenerating
                    )
                      return;
                    setLightboxSlot({
                      slot,
                      index: idx,
                      turnNumber: activeInteraction.turnNumber,
                    });
                  }}
                >
                  {/* 1. TOP ROUNDED ARTWORK FRAME + FLOATING INSPECT/DOWNLOAD OVERLAY */}
                  <div className="ref-quad-image-frame">
                    {slot?.imageUrl ? (
                      <>
                        <img
                          src={slot.imageUrl}
                          alt={slot.label}
                          className="ref-quad-img ref-quad-img-reveal"
                        />
                        {!isGenerating && (
                          <div className="ref-quad-frame-overlay-actions">
                            <button
                              type="button"
                              className="ref-quad-overlay-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!activeInteraction) return;
                                setLightboxSlot({
                                  slot,
                                  index: idx,
                                  turnNumber: activeInteraction.turnNumber,
                                });
                              }}
                              title="Expand image in full screen (Lightbox)"
                              aria-label={`Expand ${slot.label} in full screen`}
                            >
                              ⤢
                            </button>
                            <button
                              type="button"
                              className="ref-quad-overlay-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                const a = document.createElement("a");
                                a.href = slot.imageUrl;
                                a.download = `interaction-${
                                  activeInteraction?.turnNumber || 1
                                }-v${idx + 1}.png`;
                                a.click();
                              }}
                              title="Download PNG"
                              aria-label={`Download ${slot.label} PNG`}
                            >
                              ↓
                            </button>
                          </div>
                        )}
                      </>
                    ) : isGenerating ? (
                      <div className="ref-quad-drafting-stage">
                        <span className="ref-quad-drafting-pulse" />
                        <strong className="ref-quad-blueprint-title">
                          {generationStage === "analyzing-scene"
                            ? idx === 0
                              ? "Preparing Base Prompt..."
                              : "Gemini 2.5 Flash extracting scene emphasis..."
                            : "Nano Banana rendering frame..."}
                        </strong>
                        {slot?.prompt && (
                          <span className="ref-quad-blueprint-desc">
                            {slot.prompt}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="ref-quad-blueprint-empty">
                        <span
                          className="ref-quad-viewfinder-mark"
                          aria-hidden="true"
                        >
                          ⊹
                        </span>
                        <strong className="ref-quad-blueprint-title">
                          {blueprint.title}
                        </strong>
                        <span className="ref-quad-blueprint-desc">
                          {blueprint.caption}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 2. STREAMLINED METADATA & 2-ACTION FOOTER */}
                  <div className="ref-mura-card-body">
                    <div className="ref-mura-title-row">
                      <strong
                        className="ref-mura-card-title"
                        title={slot ? slot.label : blueprint.code}
                      >
                        {slot ? slot.label : blueprint.code}
                      </strong>
                      <span className="ref-mura-card-price-tag">
                        {activeInteraction && !isGenerating
                          ? `#${activeInteraction.turnNumber} • ${selectedAspectRatio}`
                          : isGenerating
                          ? slot?.imageUrl
                            ? "Ready"
                            : "Rendering..."
                          : selectedAspectRatio}
                      </span>
                    </div>

                    <span className="ref-mura-meta-prompt">
                      {slot
                        ? slot.prompt
                        : `Frame #${idx + 1} — ${blueprint.title}`}
                    </span>

                    <div className="ref-mura-actions-row">
                      <button
                        type="button"
                        className={`ref-mura-btn-solid ${
                          isSelected ? "active" : ""
                        }`}
                        disabled={!slot || isGenerating}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!slot || isGenerating) return;
                          void handleChooseVariant(idx);
                        }}
                      >
                        {isSelected ? "✓ Selected" : "Select"}
                      </button>

                      {slot?.imageUrl && !isGenerating ? (
                        <button
                          type="button"
                          aria-pressed={
                            canonicalDnaRef?.imageUrl === slot.imageUrl
                          }
                          className={`ref-mura-btn-outline ${
                            canonicalDnaRef?.imageUrl === slot.imageUrl
                              ? "active-dna"
                              : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handlePinCanonicalDna(
                              slot,
                              activeInteraction?.turnNumber || 1
                            );
                          }}
                          title="Pin this frame as Canonical Character DNA across all turns"
                        >
                          {canonicalDnaRef?.imageUrl === slot.imageUrl
                            ? "🧬 Pinned"
                            : "🧬 Pin DNA"}
                        </button>
                      ) : (
                        <span className="ref-mura-frame-status">
                          {isGenerating ? "Rendering..." : "Ready"}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* RIGHT 40%: PROMPTS & PARAMETERS */}
        <aside
          className="ref-studio-right-params-40"
          aria-label="Prompts and Parameters"
        >
          {/* ZONE 1: Prompt Composer (Clean Segmented Switch + Textarea + Primary CTA) */}
          <form
            className="ref-params-card"
            onSubmit={handleGenerateInteraction}
          >
            <input
              ref={fileUploadInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={handleUploadReferenceFile}
            />

            <div className="ref-params-card-header">
              <div className="ref-studio-flow-mode-switch" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={flowMode === "compose"}
                  className={`ref-studio-flow-mode-btn ${
                    flowMode === "compose" ? "active" : ""
                  }`}
                  onClick={() => setFlowMode("compose")}
                >
                  ✦ Compose
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={flowMode === "surgical-delta"}
                  className={`ref-studio-flow-mode-btn ${
                    flowMode === "surgical-delta" ? "active" : ""
                  }`}
                  onClick={() => setFlowMode("surgical-delta")}
                  title="Edit only targeted details while locking Character, Pose, or Background"
                >
                  ⚡ Surgical Delta
                </button>
              </div>

              <div className="ref-studio-toolbar-actions">
                <button
                  type="button"
                  className="ref-studio-ghost-action"
                  onClick={() => fileUploadInputRef.current?.click()}
                  title="Upload an external reference image or sketch (PNG, JPG, WebP)"
                >
                  📤 Upload Ref
                </button>
                {preEnhancePrompt && (
                  <button
                    type="button"
                    className="ref-studio-ghost-action"
                    onClick={handleUndoEnhance}
                    title="Revert to your original prompt before Enhance Narrative"
                  >
                    ↺ Undo
                  </button>
                )}
                <button
                  type="button"
                  className="ref-studio-ghost-action accent"
                  disabled={
                    !promptInput.trim() || isEnhancingNarrative || isGenerating
                  }
                  onClick={() => void handleEnhanceNarrative()}
                  title="Expand your short idea into a rich cinematic paragraph optimized for Gemini Nano Banana"
                >
                  {isEnhancingNarrative ? "✦ Enhancing..." : "✦ Enhance"}
                </button>
              </div>
            </div>

            {!apiKey.trim() && (
              <div className="ref-studio-apikey-banner" role="status">
                <span className="ref-studio-apikey-banner-text">
                  🔑 <strong>Blueprint Mode:</strong> Add a Gemini API key to render live PNGs.
                </span>
                <button
                  type="button"
                  className="ref-studio-inline-link-btn"
                  onClick={openSettingsModal}
                >
                  Add Key →
                </button>
              </div>
            )}

            {/* Active Reference / Canonical DNA Strip + Preservation Locks */}
            {(canonicalDnaRef?.imageUrl ||
              activeInteraction?.chosenImageUrl) && (
              <div className="ref-studio-dna-anchor-bar">
                <div className="ref-studio-dna-top-row">
                  <div className="ref-studio-dna-thumb-group">
                    {canonicalDnaRef?.imageUrl && (
                      <img
                        src={canonicalDnaRef.imageUrl}
                        alt="Canonical Character DNA"
                        className="ref-studio-dna-thumb"
                        title={`Canonical DNA: ${canonicalDnaRef.label}`}
                      />
                    )}
                    {activeInteraction?.chosenImageUrl &&
                      activeInteraction.chosenImageUrl !==
                        canonicalDnaRef?.imageUrl && (
                        <img
                          src={activeInteraction.chosenImageUrl}
                          alt="Active Turn Scene Anchor"
                          className="ref-studio-dna-thumb"
                          title={`Turn #${activeInteraction.turnNumber} Scene Frame`}
                        />
                      )}
                    <span className="ref-studio-dna-badge">
                      {canonicalDnaRef &&
                      activeInteraction?.chosenImageUrl &&
                      activeInteraction.chosenImageUrl !==
                        canonicalDnaRef.imageUrl
                        ? `🧬+⚓ ${canonicalDnaRef.label} + Turn #${activeInteraction.turnNumber}`
                        : canonicalDnaRef
                        ? `🧬 ${canonicalDnaRef.label}`
                        : `⚓ Turn #${activeInteraction?.turnNumber} Anchor`}
                    </span>
                  </div>

                  <div className="ref-studio-dna-actions">
                    <button
                      type="button"
                      aria-pressed={useReferenceImage}
                      className={`ref-studio-lock-chip ${
                        useReferenceImage ? "locked" : ""
                      }`}
                      onClick={() => setUseReferenceImage((prev) => !prev)}
                      title="Toggle sending reference image inlineData to Gemini Nano Banana"
                    >
                      {useReferenceImage ? "Ref: ON" : "Ref: OFF"}
                    </button>
                    {canonicalDnaRef && (
                      <button
                        type="button"
                        aria-label="Unpin Canonical DNA Reference"
                        className="ref-modifier-remove-btn"
                        onClick={() => void handleClearCanonicalDna()}
                        title="Unpin Canonical DNA Reference"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="ref-studio-locks-row">
                  <span className="ref-studio-locks-label">Preserve:</span>
                  <button
                    type="button"
                    aria-pressed={preservationLocks.keepCharacter}
                    className={`ref-studio-lock-chip ${
                      preservationLocks.keepCharacter ? "locked" : ""
                    }`}
                    onClick={() => handleToggleLock("keepCharacter")}
                  >
                    {preservationLocks.keepCharacter ? "🔒" : "🔓"} Character
                  </button>
                  <button
                    type="button"
                    aria-pressed={preservationLocks.keepPose}
                    className={`ref-studio-lock-chip ${
                      preservationLocks.keepPose ? "locked" : ""
                    }`}
                    onClick={() => handleToggleLock("keepPose")}
                  >
                    {preservationLocks.keepPose ? "🔒" : "🔓"} Pose
                  </button>
                  <button
                    type="button"
                    aria-pressed={preservationLocks.keepBackground}
                    className={`ref-studio-lock-chip ${
                      preservationLocks.keepBackground ? "locked" : ""
                    }`}
                    onClick={() => handleToggleLock("keepBackground")}
                  >
                    {preservationLocks.keepBackground ? "🔒" : "🔓"} Background
                  </button>
                </div>
              </div>
            )}

            {flowMode === "surgical-delta" ? (
              activeInteraction || canonicalDnaRef?.imageUrl ? (
                <div className="ref-studio-prompt-editor-group">
                  <div className="ref-studio-anchor-prompt-preview">
                    <span
                      className="ref-studio-anchor-prompt-text"
                      title={
                        activeInteraction?.chosenPrompt ||
                        canonicalDnaRef?.prompt ||
                        promptInput
                      }
                    >
                      <strong>Anchor:</strong>{" "}
                      {activeInteraction?.chosenPrompt ||
                        canonicalDnaRef?.prompt ||
                        promptInput ||
                        "Uploaded visual reference"}
                    </span>
                    <button
                      type="button"
                      className="ref-studio-inline-link-btn"
                      onClick={() => setFlowMode("compose")}
                      title="Switch to Compose Scene mode to edit the full scene prompt"
                    >
                      Full Scene ↗
                    </button>
                  </div>

                  <div className="ref-studio-label-row">
                    <label
                      className="ref-field-label"
                      htmlFor="studio-surgical-delta"
                      style={{ marginBottom: 0 }}
                    >
                      Surgical Delta (Describe only what to change)
                    </label>
                    <button
                      type="button"
                      className="ref-studio-hints-toggle"
                      aria-expanded={showPromptHints}
                      onClick={() => setShowPromptHints((prev) => !prev)}
                    >
                      {showPromptHints ? "Hide Presets ▴" : "+ Quick Presets ▾"}
                    </button>
                  </div>

                  <textarea
                    id="studio-surgical-delta"
                    className="ref-params-textarea"
                    value={deltaInput}
                    onChange={(e) => setDeltaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        void handleGenerateInteraction();
                      }
                    }}
                    placeholder="E.g.: Change the jacket to crimson leather and add falling rain while keeping the exact same character and pose..."
                  />

                  {showPromptHints && (
                    <div className="ref-studio-pillar-suggestions">
                      {SURGICAL_DELTA_QUICK_CHIPS.map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          className={`ref-studio-lock-chip ${
                            deltaInput === chip.delta
                              ? "locked"
                              : "suggestion-chip"
                          }`}
                          onClick={() => {
                            setDeltaInput(chip.delta);
                            setShowPromptHints(false);
                          }}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="ref-studio-delta-empty-state">
                  <strong className="ref-quad-blueprint-title">
                    ⚡ Surgical Delta Requires an Anchor Frame
                  </strong>
                  <span className="ref-quad-blueprint-desc">
                    Generate a 2×2 scene in Compose mode or upload a reference image first, then use Surgical Delta to modify targeted details.
                  </span>
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                      justifyContent: "center",
                    }}
                  >
                    <button
                      type="button"
                      className="ref-mura-btn-solid"
                      onClick={() => setFlowMode("compose")}
                    >
                      ✦ Compose Scene
                    </button>
                    <button
                      type="button"
                      className="ref-mura-btn-outline"
                      onClick={() => fileUploadInputRef.current?.click()}
                    >
                      📤 Upload Reference
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="ref-studio-prompt-editor-group">
                <div className="ref-studio-label-row">
                  <label
                    className="ref-field-label"
                    htmlFor="studio-master-prompt"
                    style={{ marginBottom: 0 }}
                  >
                    {activeInteraction
                      ? `Scene Prompt (Turn #${activeInteraction.turnNumber})`
                      : "Scene Prompt"}
                  </label>
                  <button
                    type="button"
                    className="ref-studio-hints-toggle"
                    aria-expanded={showPromptHints}
                    onClick={() => setShowPromptHints((prev) => !prev)}
                  >
                    {showPromptHints
                      ? "Hide Scene Hints ▴"
                      : `+ Scene Hints (${
                          PROMPT_COMPLETENESS_PILLARS.filter((p) =>
                            p.regex.test(promptInput)
                          ).length
                        }/5) ▾`}
                  </button>
                </div>

                <textarea
                  id="studio-master-prompt"
                  className="ref-params-textarea"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      void handleGenerateInteraction();
                    }
                  }}
                  placeholder="Describe your scene... Gemini will craft 4 variations along your selected 2x2 Matrix axis."
                />

                {showPromptHints && (
                  <div className="ref-studio-pillars-bar">
                    <div className="ref-studio-delta-chips-row">
                      {PROMPT_COMPLETENESS_PILLARS.map((pillar) => {
                        const isDetected = pillar.regex.test(promptInput);
                        const isOpen = activePillarId === pillar.id;
                        return (
                          <button
                            key={pillar.id}
                            type="button"
                            className={`ref-studio-lock-chip ${
                              isDetected ? "locked" : ""
                            } ${isOpen ? "pillar-open" : ""}`}
                            onClick={() =>
                              setActivePillarId((prev) =>
                                prev === pillar.id ? null : pillar.id
                              )
                            }
                          >
                            {isDetected ? "✓ " : "+ "}
                            {pillar.label}
                          </button>
                        );
                      })}
                    </div>

                    {activePillarId && (
                      <div className="ref-studio-pillar-suggestions">
                        {PROMPT_COMPLETENESS_PILLARS.find(
                          (p) => p.id === activePillarId
                        )?.suggestions.map((sug) => (
                          <button
                            key={sug.label}
                            type="button"
                            className="ref-studio-lock-chip suggestion-chip"
                            onClick={() => {
                              setPromptInput((prev) => {
                                const trimmed = prev
                                  .trim()
                                  .replace(/[.,;]+$/, "");
                                return trimmed
                                  ? `${trimmed}, ${sug.snippet}`
                                  : sug.snippet;
                              });
                              setActivePillarId(null);
                            }}
                          >
                            + {sug.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="ref-studio-submit-row">
              <div className="ref-studio-feedback-slot" aria-live="polite">
                {statusNotice ? (
                  <span className="ref-atelier-toast-pill">
                    {statusNotice}
                  </span>
                ) : (
                  <span className="ref-atelier-shortcut-hint">
                    <kbd>Ctrl</kbd>+<kbd>↵</kbd> • {activeMatrixConfig.shortTag}
                  </span>
                )}
              </div>

              <button
                type="submit"
                id="generate-nanobanana-primary-btn"
                className="ref-dark-pill-btn"
                disabled={
                  isGenerating ||
                  (flowMode === "surgical-delta"
                    ? !(activeInteraction || canonicalDnaRef?.imageUrl) ||
                      !deltaInput.trim()
                    : !promptInput.trim())
                }
              >
                <span>
                  {isGenerating
                    ? generationStage === "analyzing-scene"
                      ? `Composing ${activeMatrixConfig.label}...`
                      : `Rendering (${completedSlotsCount}/4)...`
                    : flowMode === "surgical-delta"
                    ? "Apply Delta (4 Images)"
                    : activeInteraction
                    ? `Iterate #${activeInteraction.turnNumber} (4 Images)`
                    : "Generate 4 Images"}
                </span>
                <span className="ref-lime-badge">
                  {interactions.length + 1}
                </span>
              </button>
            </div>
          </form>

          {/* ZONE 2: Clean Parameter Deck (Segmented Aspect Ratio + 3-Tab Parameter Switcher) */}
          <div className="ref-params-card ref-params-deck">
            {/* 1. Unified 5-Segment Aspect Ratio Bar */}
            <div className="ref-params-field-group">
              <div className="ref-studio-label-row">
                <span className="ref-field-label" style={{ marginBottom: 0 }}>
                  Frame Aspect Ratio
                </span>
                <span className="ref-studio-ratio-readout">
                  {selectedAspectRatio}
                </span>
              </div>
              <div
                className="ref-studio-segmented-bar"
                role="radiogroup"
                aria-label="Aspect Ratio"
              >
                {ASPECT_RATIO_OPTIONS.map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    role="radio"
                    aria-checked={selectedAspectRatio === ratio}
                    className={`ref-studio-segment-btn ${
                      selectedAspectRatio === ratio ? "active" : ""
                    }`}
                    onClick={() => setSelectedAspectRatio(ratio)}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. 3-Tab Parameter Deck (2x2 Matrix | Visual Style | Modifiers) */}
            <div className="ref-studio-param-deck-container">
              <div
                className="ref-studio-param-tabs"
                role="tablist"
                aria-label="Studio Parameter Groups"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeParamTab === "matrix"}
                  className={`ref-studio-param-tab ${
                    activeParamTab === "matrix" ? "active" : ""
                  }`}
                  onClick={() => setActiveParamTab("matrix")}
                >
                  <span className="ref-studio-param-tab-title">2×2 Matrix</span>
                  <span className="ref-studio-param-tab-value">
                    {activeMatrixConfig.label.replace(/^[^\s]+\s/, "")}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeParamTab === "style"}
                  className={`ref-studio-param-tab ${
                    activeParamTab === "style" ? "active" : ""
                  }`}
                  onClick={() => setActiveParamTab("style")}
                >
                  <span className="ref-studio-param-tab-title">
                    Visual Style
                  </span>
                  <span className="ref-studio-param-tab-value">
                    {(
                      bootstrapData.style_presets.find(
                        (s) => s.id === selectedStyleId
                      ) || bootstrapData.style_presets[0]
                    )?.title.split(" (")[0] || "Default"}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeParamTab === "modifiers"}
                  className={`ref-studio-param-tab ${
                    activeParamTab === "modifiers" ? "active" : ""
                  }`}
                  onClick={() => setActiveParamTab("modifiers")}
                >
                  <span className="ref-studio-param-tab-title">Modifiers</span>
                  <span className="ref-studio-param-tab-value">
                    {selectedModifiers.length} active
                  </span>
                </button>
              </div>

              <div className="ref-studio-param-tab-panel" role="tabpanel">
                {activeParamTab === "matrix" && (
                  <div className="ref-studio-tab-section">
                    <div className="ref-studio-option-grid">
                      {EXPLORATION_MATRIX_OPTIONS.map((axis) => (
                        <button
                          key={axis.id}
                          type="button"
                          className={`ref-studio-grid-option ${
                            matrixAxis === axis.id ? "active" : ""
                          }`}
                          onClick={() => setMatrixAxis(axis.id)}
                        >
                          <strong className="ref-studio-grid-option-title">
                            {axis.label}
                          </strong>
                          <span className="ref-studio-grid-option-sub">
                            {axis.shortTag}
                          </span>
                        </button>
                      ))}
                    </div>

                    {bootstrapData.modifier_categories.some(
                      (cat) => cat.options.length > 0
                    ) && (
                      <div className="ref-studio-sweep-subgroup">
                        <span className="ref-studio-subgroup-label">
                          Or Sweep 4 Modifiers from a Category:
                        </span>
                        <div className="ref-params-pills-wrap">
                          {bootstrapData.modifier_categories
                            .filter((cat) => cat.options.length > 0)
                            .map((cat) => {
                              const catAxisId: ExplorationMatrixAxis = `cat:${cat.id}`;
                              const shortCat = cat.title
                                .split(" & ")[0]
                                .split(" (")[0];
                              return (
                                <button
                                  key={catAxisId}
                                  type="button"
                                  className={`ref-pill-chip ${
                                    matrixAxis === catAxisId ? "active" : ""
                                  }`}
                                  onClick={() => setMatrixAxis(catAxisId)}
                                  title={`Sweep 4 modifiers from "${shortCat}" across the 2x2 grid`}
                                >
                                  ⚡ 4 {shortCat}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeParamTab === "style" && (
                  <div className="ref-studio-tab-section">
                    <div className="ref-studio-option-grid">
                      {bootstrapData.style_presets.map((preset) => {
                        const [mainTitle, subPart] = preset.title.split(" (");
                        const cleanSub = subPart
                          ? subPart.replace(")", "")
                          : "Preset Aesthetic";
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            className={`ref-studio-grid-option ${
                              selectedStyleId === preset.id ? "active" : ""
                            }`}
                            onClick={() => setSelectedStyleId(preset.id)}
                          >
                            <strong className="ref-studio-grid-option-title">
                              {mainTitle}
                            </strong>
                            <span className="ref-studio-grid-option-sub">
                              {cleanSub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeParamTab === "modifiers" && (
                  <div className="ref-studio-tab-section">
                    <div className="ref-studio-mod-header-row">
                      <div
                        className="ref-studio-mod-cat-tabs"
                        role="tablist"
                        aria-label="Modifier categories"
                      >
                        {bootstrapData.modifier_categories.map((cat) => {
                          const isCurrentCat =
                            (bootstrapData.modifier_categories.some(
                              (c) => c.id === activeModCategoryId
                            )
                              ? activeModCategoryId
                              : bootstrapData.modifier_categories[0]?.id) ===
                            cat.id;
                          const activeInCatCount = cat.options.filter((o) =>
                            selectedModifiers.includes(o.id)
                          ).length;
                          const shortTitle = cat.title
                            .split(" & ")[0]
                            .split(" (")[0];
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              role="tab"
                              aria-selected={isCurrentCat}
                              className={`ref-studio-mod-cat-tab ${
                                isCurrentCat ? "active" : ""
                              }`}
                              onClick={() => setActiveModCategoryId(cat.id)}
                            >
                              <span>{shortTitle}</span>
                              {activeInCatCount > 0 && (
                                <span className="ref-studio-mod-cat-badge">
                                  {activeInCatCount}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <Link
                        href="/modifiers"
                        className="ref-studio-inline-link-btn"
                      >
                        Manage ↗
                      </Link>
                    </div>

                    <div className="ref-params-pills-wrap">
                      {(
                        bootstrapData.modifier_categories.find(
                          (c) => c.id === activeModCategoryId
                        ) || bootstrapData.modifier_categories[0]
                      )?.options.map((opt) => {
                        const active = selectedModifiers.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`ref-pill-chip ${
                              active ? "active" : ""
                            }`}
                            onClick={() => handleToggleModifier(opt.id)}
                            title={opt.token}
                          >
                            {opt.label.split(" (")[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ==================== LIGHTBOX MODAL FOR FULL-SIZE IMAGE INSPECTION & BEFORE/AFTER COMPARE ==================== */}
      {lightboxSlot &&
        (() => {
          const parentRound = activeInteraction?.parentTurnNumber
            ? interactions.find(
                (r) => r.turnNumber === activeInteraction.parentTurnNumber
              )
            : null;
          const compareReference =
            parentRound?.chosenImageUrl &&
            parentRound.chosenImageUrl !== lightboxSlot.slot.imageUrl
              ? {
                  label: `Parent Turn #${parentRound.turnNumber}`,
                  imageUrl: parentRound.chosenImageUrl,
                }
              : canonicalDnaRef?.imageUrl &&
                canonicalDnaRef.imageUrl !== lightboxSlot.slot.imageUrl
              ? {
                  label: `🧬 DNA: ${canonicalDnaRef.label}`,
                  imageUrl: canonicalDnaRef.imageUrl,
                }
              : null;

          return (
            <div
              className="ref-modal-backdrop"
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) setLightboxSlot(null);
              }}
            >
              <div className="ref-lightbox-card">
                <div className="ref-modal-header">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="ref-pill-chip active">
                      Interaction #{lightboxSlot.turnNumber} •{" "}
                      {lightboxSlot.slot.label}
                    </span>
                    {activeInteraction && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <button
                          type="button"
                          className="ref-pill-chip"
                          onClick={() => {
                            const valid = activeInteraction.variants
                              .map((slot, idx) => ({ slot, idx }))
                              .filter((x) => Boolean(x.slot?.imageUrl));
                            if (valid.length <= 1) return;
                            const cur = valid.findIndex(
                              (x) => x.idx === lightboxSlot.index
                            );
                            const prevItem =
                              valid[(cur - 1 + valid.length) % valid.length];
                            setLightboxSlot({
                              slot: prevItem.slot,
                              index: prevItem.idx,
                              turnNumber: activeInteraction.turnNumber,
                            });
                          }}
                          title="Previous variation (←)"
                        >
                          ‹ Previous
                        </button>
                        <button
                          type="button"
                          className="ref-pill-chip"
                          onClick={() => {
                            const valid = activeInteraction.variants
                              .map((slot, idx) => ({ slot, idx }))
                              .filter((x) => Boolean(x.slot?.imageUrl));
                            if (valid.length <= 1) return;
                            const cur = valid.findIndex(
                              (x) => x.idx === lightboxSlot.index
                            );
                            const nextItem = valid[(cur + 1) % valid.length];
                            setLightboxSlot({
                              slot: nextItem.slot,
                              index: nextItem.idx,
                              turnNumber: activeInteraction.turnNumber,
                            });
                          }}
                          title="Next variation (→)"
                        >
                          Next ›
                        </button>
                      </div>
                    )}
                    {compareReference && (
                      <button
                        type="button"
                        aria-pressed={lightboxCompareMode}
                        className={`ref-pill-chip ${
                          lightboxCompareMode ? "active" : ""
                        }`}
                        onClick={() =>
                          setLightboxCompareMode((prev) => !prev)
                        }
                        title={`Compare side-by-side with ${compareReference.label}`}
                      >
                        ⇄ Compare ({compareReference.label})
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <button
                      type="button"
                      className="ref-dark-pill-btn"
                      onClick={() => {
                        void handleChooseVariant(lightboxSlot.index);
                        setLightboxSlot(null);
                      }}
                    >
                      <span>✓ Select Image & Load Prompt</span>
                    </button>
                    <button
                      type="button"
                      className="ref-pill-chip"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = lightboxSlot.slot.imageUrl;
                        a.download = `interaction-${lightboxSlot.turnNumber}-v${
                          lightboxSlot.index + 1
                        }.png`;
                        a.click();
                      }}
                    >
                      ↓ Download PNG
                    </button>
                    <button
                      type="button"
                      aria-label="Close lightbox"
                      className="ref-circle-icon-btn"
                      style={{ width: "34px", height: "34px" }}
                      onClick={() => setLightboxSlot(null)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {lightboxCompareMode && compareReference ? (
                  <div className="ref-lightbox-compare-grid">
                    <div className="ref-lightbox-compare-pane">
                      <span className="ref-lightbox-compare-label">
                        Before • {compareReference.label}
                      </span>
                      <img
                        src={compareReference.imageUrl}
                        alt={compareReference.label}
                        className="ref-lightbox-img"
                      />
                    </div>
                    <div className="ref-lightbox-compare-pane">
                      <span className="ref-lightbox-compare-label">
                        After • Interaction #{lightboxSlot.turnNumber} (
                        {lightboxSlot.slot.label})
                      </span>
                      <img
                        src={lightboxSlot.slot.imageUrl}
                        alt={lightboxSlot.slot.label}
                        className="ref-lightbox-img"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="ref-lightbox-image-box">
                    <img
                      src={lightboxSlot.slot.imageUrl}
                      alt={lightboxSlot.slot.label}
                      className="ref-lightbox-img"
                    />
                  </div>
                )}

                <p className="ref-lightbox-prompt-text">
                  {lightboxSlot.slot.prompt}
                </p>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
