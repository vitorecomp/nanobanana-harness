"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  BootstrapResponse,
  CanonicalDnaReference,
  CreationFlowMode,
  ExplorationMatrixAxis,
  FlowNodePosition,
  FlowStepParameterSnapshot,
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
import {
  buildStepBezierPath,
  computeBatchBranchNodePositions,
  computeTreeAutoLayout,
  getFrameNodeId,
  loadProjectFlowMeta,
  parseFrameNodeId,
  saveProjectFlowMeta,
} from "../services/flowGraphUtils";
import { GoogleUserProfile, LOCAL_DEV_USER } from "@/features/auth";
import { useStudioSession } from "@/core/context/StudioSessionContext";
import {
  IconAtelierStar,
  IconAutoGrid,
  IconChevron,
  IconClose,
  IconDna,
  IconDownload,
  IconExpand,
  IconGripDots,
  IconMinus,
  IconPlay,
  IconPlus,
} from "@/shared";
import {
  createConversation,
  getConversationDetail,
  listUserConversations,
  saveConversationTurn,
  updateConversationDna,
  updateConversationTitle,
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

  // Immutable generation steps on the n8n Flow Canvas
  const [interactions, setInteractions] = useState<StudioInteractionRound[]>(
    []
  );
  const [activeInteractionIndex, setActiveInteractionIndex] =
    useState<number>(-1);

  // Flow Canvas Node Positions, Parent Variant Map, Immutable Parameter Snapshots & Active Draft Step
  const [nodePositions, setNodePositions] = useState<
    Record<string, FlowNodePosition>
  >({});
  const [parentVariantByTurn, setParentVariantByTurn] = useState<
    Record<number, number>
  >({});
  const [snapshotsByTurn, setSnapshotsByTurn] = useState<
    Record<number, FlowStepParameterSnapshot>
  >({});
  const [draftStep, setDraftStep] = useState<{
    parentTurnNumber: number | null;
    parentVariantIndex: number;
    positions: FlowNodePosition[];
  } | null>({
    parentTurnNumber: null,
    parentVariantIndex: 0,
    positions: computeBatchBranchNodePositions(null, [], 4),
  });
  const [selectedCanvasNodeId, setSelectedCanvasNodeId] =
    useState<string>("draft");
  const [isStepModalOpen, setIsStepModalOpen] = useState<boolean>(false);
  const [isProjectTitleModalOpen, setIsProjectTitleModalOpen] =
    useState<boolean>(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState<string>("");
  const projectTitleInputRef = useRef<HTMLInputElement | null>(null);

  // Pan & Zoom Canvas Viewport
  const [canvasViewport, setCanvasViewport] = useState<{
    x: number;
    y: number;
    zoom: number;
  }>({ x: 24, y: 24, zoom: 0.92 });
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<
    | {
        mode: "pan";
        startClientX: number;
        startClientY: number;
        originX: number;
        originY: number;
      }
    | {
        mode: "node";
        nodeId: string;
        startClientX: number;
        startClientY: number;
        originX: number;
        originY: number;
      }
    | null
  >(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);

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

      const persistedMeta = loadProjectFlowMeta(convId);
      const autoPositions = computeTreeAutoLayout(
        loadedRounds.map((r) => ({
          id: r.id,
          turnNumber: r.turnNumber,
          parentTurnNumber: r.parentTurnNumber,
          parentVariantIndex: persistedMeta.parentVariantByTurn[r.turnNumber] ?? 0,
          variantCount: Math.max(1, r.variants.length),
        }))
      );
      const mergedPositions: Record<string, FlowNodePosition> = {
        ...autoPositions,
        ...persistedMeta.positions,
      };
      setNodePositions(mergedPositions);
      setParentVariantByTurn(persistedMeta.parentVariantByTurn);
      setSnapshotsByTurn(persistedMeta.snapshotsByTurn);

      setInteractions(loadedRounds);
      if (loadedRounds.length > 0) {
        const lastIdx = loadedRounds.length - 1;
        const lastRound = loadedRounds[lastIdx];
        setActiveInteractionIndex(lastIdx);
        setSelectedCanvasNodeId(
          getFrameNodeId(lastRound.id, lastRound.selectedVariantIndex || 0)
        );
        setDraftStep(null);
        setPromptInput(lastRound.chosenPrompt);
        setDeltaInput("");
        if (lastRound.aspectRatio) {
          setSelectedAspectRatio(lastRound.aspectRatio);
        }
        setFlowMode("compose");
      } else {
        setActiveInteractionIndex(-1);
        setSelectedCanvasNodeId("draft");
        setDraftStep({
          parentTurnNumber: null,
          parentVariantIndex: 0,
          positions: computeBatchBranchNodePositions(null, [], 4),
        });
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
    setNodePositions({});
    setParentVariantByTurn({});
    setSnapshotsByTurn({});
    setDraftStep({
      parentTurnNumber: null,
      parentVariantIndex: 0,
      positions: computeBatchBranchNodePositions(null, [], 4),
    });
    setSelectedCanvasNodeId("draft");
    setCanvasViewport({ x: 24, y: 24, zoom: 0.92 });
    setLightboxSlot(null);
    setLiveDraftSlots([null, null, null, null]);
    setGenerationStage("idle");
    showTransientNotice("✦ New project started — configure Step #1");
  }, [newProjectNonce, setActiveProjectId, showTransientNotice]);

  // Global mousemove / mouseup listeners for Canvas Panning & Node Drag-and-Drop Organization
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      if (state.mode === "pan") {
        const dx = e.clientX - state.startClientX;
        const dy = e.clientY - state.startClientY;
        setCanvasViewport((prev) => ({
          ...prev,
          x: state.originX + dx,
          y: state.originY + dy,
        }));
      } else if (state.mode === "node") {
        const zoom = canvasViewport.zoom || 1;
        const dx = (e.clientX - state.startClientX) / zoom;
        const dy = (e.clientY - state.startClientY) / zoom;
        const nextX = Math.round(state.originX + dx);
        const nextY = Math.round(state.originY + dy);

        if (state.nodeId.startsWith("draft::")) {
          const draftIdx = Number(state.nodeId.slice(7)) || 0;
          setDraftStep((prev) =>
            prev
              ? {
                  ...prev,
                  positions: prev.positions.map((pos, idx) =>
                    idx === draftIdx ? { x: nextX, y: nextY } : pos
                  ),
                }
              : prev
          );
        } else {
          setNodePositions((prev) => {
            const updated = {
              ...prev,
              [state.nodeId]: { x: nextX, y: nextY },
            };
            saveProjectFlowMeta(activeProjectId, {
              positions: updated,
              parentVariantByTurn,
              snapshotsByTurn,
            });
            return updated;
          });
        }
      }
    };

    const handleMouseUp = () => {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        setIsDraggingCanvas(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    activeProjectId,
    canvasViewport.zoom,
    parentVariantByTurn,
    snapshotsByTurn,
  ]);

  const handleStartBranchFromNode = useCallback(
    (
      parentRound: StudioInteractionRound | null,
      variantIndex: number = 0,
      preferredMode: CreationFlowMode = "compose"
    ) => {
      const existingCoords = Object.values(nodePositions);
      if (!parentRound) {
        setDraftStep({
          parentTurnNumber: null,
          parentVariantIndex: 0,
          positions: computeBatchBranchNodePositions(null, existingCoords, 4),
        });
        setSelectedCanvasNodeId("draft");
        setFlowMode("compose");
        setIsStepModalOpen(true);
        return;
      }

      const roundIdx = interactions.findIndex((r) => r.id === parentRound.id);
      if (roundIdx >= 0) {
        setActiveInteractionIndex(roundIdx);
      }
      const chosenSlot =
        parentRound.variants[variantIndex] || parentRound.variants[0];
      if (chosenSlot?.prompt) {
        setPromptInput(chosenSlot.prompt);
      }
      if (parentRound.aspectRatio) {
        setSelectedAspectRatio(parentRound.aspectRatio);
      }
      setFlowMode(preferredMode);

      const parentCardId = getFrameNodeId(parentRound.id, variantIndex);
      const parentPos = nodePositions[parentCardId] || { x: 70, y: 60 };
      const nextBatchPositions = computeBatchBranchNodePositions(
        parentPos,
        existingCoords,
        4
      );

      setDraftStep({
        parentTurnNumber: parentRound.turnNumber,
        parentVariantIndex: variantIndex,
        positions: nextBatchPositions,
      });
      setSelectedCanvasNodeId("draft");
      setIsStepModalOpen(true);

      // Smoothly pan viewport so the newly spawned 4 cards will be visible
      if (canvasViewportRef.current && nextBatchPositions[0]) {
        const rect = canvasViewportRef.current.getBoundingClientRect();
        const zoom = canvasViewport.zoom;
        const desiredX =
          rect.width * 0.52 - (nextBatchPositions[0].x + 150) * zoom;
        const desiredY =
          rect.height * 0.35 - (nextBatchPositions[0].y + 260) * zoom;
        setCanvasViewport((prev) => ({
          ...prev,
          x: Math.round(desiredX),
          y: Math.round(desiredY),
        }));
      }

      showTransientNotice(
        `✦ New Step #${interactions.length + 1} (4 cards) branched from Card #${
          parentRound.turnNumber
        }.${variantIndex + 1}`
      );
    },
    [
      canvasViewport.zoom,
      interactions,
      nodePositions,
      showTransientNotice,
    ]
  );

  const handleAutoOrganizeFlow = useCallback(() => {
    const autoMap = computeTreeAutoLayout(
      interactions.map((r) => ({
        id: r.id,
        turnNumber: r.turnNumber,
        parentTurnNumber: r.parentTurnNumber,
        parentVariantIndex: parentVariantByTurn[r.turnNumber] ?? 0,
        variantCount: Math.max(1, r.variants.length),
      }))
    );
    setNodePositions(autoMap);
    saveProjectFlowMeta(activeProjectId, {
      positions: autoMap,
      parentVariantByTurn,
      snapshotsByTurn,
    });
    if (draftStep) {
      const parentRound = interactions.find(
        (r) => r.turnNumber === draftStep.parentTurnNumber
      );
      const parentCardId = parentRound
        ? getFrameNodeId(parentRound.id, draftStep.parentVariantIndex)
        : null;
      const parentPos = parentCardId ? autoMap[parentCardId] : null;
      setDraftStep({
        ...draftStep,
        positions: computeBatchBranchNodePositions(
          parentPos || null,
          Object.values(autoMap),
          4
        ),
      });
    }
    setCanvasViewport({ x: 28, y: 28, zoom: 0.85 });
    showTransientNotice("✦ All image cards auto-organized into a clean tree");
  }, [
    activeProjectId,
    draftStep,
    interactions,
    parentVariantByTurn,
    showTransientNotice,
    snapshotsByTurn,
  ]);

  const handleFitFlowView = useCallback(() => {
    const allCoords = [
      ...interactions.flatMap((r) =>
        r.variants.map((_, vIdx) => nodePositions[getFrameNodeId(r.id, vIdx)])
      ).filter((p): p is FlowNodePosition => Boolean(p)),
      ...(isGenerating && draftStep ? draftStep.positions : []),
    ];
    if (allCoords.length === 0 || !canvasViewportRef.current) {
      setCanvasViewport({ x: 28, y: 28, zoom: 0.9 });
      return;
    }
    const minX = Math.min(...allCoords.map((p) => p.x));
    const maxX = Math.max(...allCoords.map((p) => p.x + 310));
    const minY = Math.min(...allCoords.map((p) => p.y));
    const maxY = Math.max(...allCoords.map((p) => p.y + 320));

    const rect = canvasViewportRef.current.getBoundingClientRect();
    const contentW = Math.max(420, maxX - minX + 120);
    const contentH = Math.max(440, maxY - minY + 120);
    const nextZoom = Math.min(
      1.05,
      Math.max(0.38, Math.min(rect.width / contentW, rect.height / contentH))
    );
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setCanvasViewport({
      zoom: Number(nextZoom.toFixed(2)),
      x: Math.round(rect.width / 2 - centerX * nextZoom),
      y: Math.round(rect.height / 2 - centerY * nextZoom),
    });
  }, [draftStep, interactions, isGenerating, nodePositions]);

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

    setIsStepModalOpen(false);
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
        draftStep?.parentTurnNumber !== undefined &&
        draftStep?.parentTurnNumber !== null
          ? interactions.find(
              (r) => r.turnNumber === draftStep.parentTurnNumber
            ) || null
          : activeInteractionIndex >= 0
          ? interactions[activeInteractionIndex]
          : null;
      const parentTurnNumber = originRound ? originRound.turnNumber : null;
      const parentVariantIndex = originRound
        ? draftStep?.parentTurnNumber === originRound.turnNumber
          ? draftStep.parentVariantIndex
          : originRound.selectedVariantIndex
        : 0;
      const parentSlot =
        originRound?.variants[parentVariantIndex] || originRound?.variants[0];

      // Dual-Anchor Resolution:
      // - If both Canonical DNA and Parent Turn frame exist (and are distinct), pass both!
      // - Otherwise pass whichever reference exists.
      const dnaUrl = canonicalDnaRef?.imageUrl || "";
      const turnUrl =
        parentSlot?.imageUrl || originRound?.chosenImageUrl || "";
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
            ? parentSlot?.prompt ||
              originRound?.chosenPrompt ||
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
          ? `Step #${nextTurnNumber} (from #${parentTurnNumber} • Frame ${
              parentVariantIndex + 1
            })`
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

      const parentCardId = originRound
        ? getFrameNodeId(originRound.id, parentVariantIndex)
        : null;
      const parentCardPos = parentCardId
        ? nodePositions[parentCardId] || null
        : null;
      const batchPositions =
        draftStep?.positions &&
        draftStep.positions.length >= persistedVariants.length
          ? draftStep.positions
          : computeBatchBranchNodePositions(
              parentCardPos,
              Object.values(nodePositions),
              persistedVariants.length
            );

      const nextPositions: Record<string, FlowNodePosition> = {
        ...nodePositions,
      };
      persistedVariants.forEach((_, vIdx) => {
        const frameId = getFrameNodeId(newRound.id, vIdx);
        nextPositions[frameId] = batchPositions[vIdx] || {
          x: batchPositions[0]?.x ?? 70,
          y: (batchPositions[0]?.y ?? 60) + vIdx * 315,
        };
      });

      const nextParentVariants = {
        ...parentVariantByTurn,
        ...(parentTurnNumber !== null
          ? { [nextTurnNumber]: parentVariantIndex }
          : {}),
      };
      const nextSnapshots: Record<number, FlowStepParameterSnapshot> = {
        ...snapshotsByTurn,
        [nextTurnNumber]: {
          flowMode: effectiveFlowMode,
          aspectRatio: selectedAspectRatio,
          matrixAxis,
          styleId: selectedStyleId,
          modifierIds: [...selectedModifiers],
          preservationLocks: { ...preservationLocks },
        },
      };

      setNodePositions(nextPositions);
      setParentVariantByTurn(nextParentVariants);
      setSnapshotsByTurn(nextSnapshots);
      saveProjectFlowMeta(targetConvId, {
        positions: nextPositions,
        parentVariantByTurn: nextParentVariants,
        snapshotsByTurn: nextSnapshots,
      });

      setInteractions((prev) => {
        const next = [...prev, newRound];
        setActiveInteractionIndex(next.length - 1);
        return next;
      });
      setDraftStep(null);
      setSelectedCanvasNodeId(getFrameNodeId(newRound.id, 0));
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
          "✦ 4 blueprint cards created! Add your Gemini API key in ⚙ Settings to render PNGs."
        );
      } else if (renderedCount > 0) {
        showTransientNotice(
          `🔒 ${persistedVariants.length} image cards created for Step #${nextTurnNumber} (${renderedCount}/${persistedVariants.length} rendered)`
        );
      }
    } finally {
      setIsGenerating(false);
      setGenerationStage("idle");
      setLiveDraftSlots([null, null, null, null]);
    }
  };

  const parsedSelectedNode = parseFrameNodeId(selectedCanvasNodeId);
  const selectedLockedRound = parsedSelectedNode
    ? interactions.find((r) => r.id === parsedSelectedNode.roundId) ||
      activeInteraction
    : null;
  const selectedLockedVariantIdx = selectedLockedRound
    ? Math.min(
        Math.max(
          0,
          parsedSelectedNode?.variantIndex ??
            selectedLockedRound.selectedVariantIndex ??
            0
        ),
        Math.max(0, selectedLockedRound.variants.length - 1)
      )
    : 0;
  const selectedLockedSlot =
    selectedLockedRound?.variants[selectedLockedVariantIdx] ||
    selectedLockedRound?.variants[0] ||
    null;

  const totalFlowCardsCount = interactions.reduce(
    (sum, r) => sum + Math.max(1, r.variants.length),
    0
  );

  const draftParentRound =
    draftStep?.parentTurnNumber !== null &&
    draftStep?.parentTurnNumber !== undefined
      ? interactions.find((r) => r.turnNumber === draftStep.parentTurnNumber) ||
        null
      : null;

  const handleOpenEditProjectTitleModal = () => {
    setProjectTitleDraft(projectTitle || "New Project");
    setIsProjectTitleModalOpen(true);
    window.setTimeout(() => {
      projectTitleInputRef.current?.focus();
      projectTitleInputRef.current?.select();
    }, 30);
  };

  const handleSaveProjectTitleModal = (e: React.FormEvent) => {
    e.preventDefault();
    const nextTitle = projectTitleDraft.trim() || "Untitled Project";
    setProjectTitle(nextTitle);
    if (activeProjectId) {
      void updateConversationTitle(activeProjectId, nextTitle);
    }
    setIsProjectTitleModalOpen(false);
    showTransientNotice(`✦ Project renamed to "${nextTitle}"`);
  };

  return (
    <div className="ref-page-container">
      <div className="ref-flow-studio-layout">
        {/* ==================== FULL-WIDTH INTERACTIVE n8n IMMUTABLE CREATION FLOW CANVAS ==================== */}
        <section
          className="ref-flow-canvas-panel"
          aria-label="Immutable Creation Flow Canvas"
        >
          {/* Floating Top Flow Toolbar */}
          <div className="ref-flow-toolbar">
            <div className="ref-flow-toolbar-left">
              <div className="ref-flow-project-title-group">
                <span
                  className="ref-flow-project-title-text"
                  title={projectTitle || "New Project"}
                >
                  {projectTitle || "New Project"}
                </span>
                <button
                  type="button"
                  className="ref-flow-project-edit-btn"
                  onClick={handleOpenEditProjectTitleModal}
                  title="Edit project name"
                  aria-label="Edit project name"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 20.5H21"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M16.5 4a2.121 2.121 0 0 1 3 3L7 19.5l-4 1 1-4L16.5 4z"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <span className="ref-flow-toolbar-divider" aria-hidden="true" />
              <span className="ref-flow-toolbar-badge">
                ⛓ Flow • {totalFlowCardsCount}{" "}
                {totalFlowCardsCount === 1 ? "Card" : "Cards"} (
                {interactions.length}{" "}
                {interactions.length === 1 ? "Step" : "Steps"})
              </span>
              <button
                type="button"
                className="ref-mura-btn-solid"
                onClick={() => {
                  const baseRound =
                    selectedLockedRound ||
                    (interactions.length > 0
                      ? interactions[interactions.length - 1]
                      : null);
                  const baseVarIdx = selectedLockedRound
                    ? selectedLockedVariantIdx
                    : baseRound?.selectedVariantIndex ?? 0;
                  handleStartBranchFromNode(baseRound, baseVarIdx, "compose");
                }}
                disabled={isGenerating}
                title="Add a new generation step (creates 4 new image cards)"
              >
                <IconPlus size={11} strokeWidth={2.3} />
                <span>
                  New Step{" "}
                  {selectedLockedRound
                    ? `from #${selectedLockedRound.turnNumber}.${
                        selectedLockedVariantIdx + 1
                      }`
                    : interactions.length > 0
                    ? `from #${interactions[interactions.length - 1].turnNumber}.1`
                    : ""}
                </span>
              </button>
            </div>

            <div className="ref-flow-toolbar-right">
              <button
                type="button"
                className="ref-studio-ghost-action"
                onClick={handleAutoOrganizeFlow}
                title="Auto-organize nodes into a clean left-to-right tree"
              >
                <IconAutoGrid size={13} />
                <span>Auto-Organize</span>
              </button>
              <button
                type="button"
                className="ref-studio-ghost-action"
                onClick={handleFitFlowView}
                title="Center and fit all nodes on screen"
              >
                <IconExpand size={13} />
                <span>Fit View</span>
              </button>
              <div className="ref-flow-zoom-pill">
                <button
                  type="button"
                  className="ref-flow-zoom-btn"
                  onClick={() =>
                    setCanvasViewport((prev) => ({
                      ...prev,
                      zoom: Math.max(
                        0.45,
                        Number((prev.zoom - 0.1).toFixed(2))
                      ),
                    }))
                  }
                  aria-label="Zoom out"
                >
                  <IconMinus size={12} strokeWidth={2.1} />
                </button>
                <button
                  type="button"
                  className="ref-flow-zoom-readout"
                  onClick={() =>
                    setCanvasViewport((prev) => ({ ...prev, zoom: 0.92 }))
                  }
                  title="Reset zoom"
                >
                  {Math.round(canvasViewport.zoom * 100)}%
                </button>
                <button
                  type="button"
                  className="ref-flow-zoom-btn"
                  onClick={() =>
                    setCanvasViewport((prev) => ({
                      ...prev,
                      zoom: Math.min(
                        1.45,
                        Number((prev.zoom + 0.1).toFixed(2))
                      ),
                    }))
                  }
                  aria-label="Zoom in"
                >
                  <IconPlus size={12} strokeWidth={2.1} />
                </button>
              </div>
            </div>
          </div>

          {/* Infinite Pan & Zoom Dotted Viewport */}
          <div
            ref={canvasViewportRef}
            className={`ref-flow-canvas-viewport ${
              isDraggingCanvas ? "is-grabbing" : ""
            }`}
            onMouseDown={(e) => {
              const target = e.target as HTMLElement;
              if (
                target.closest(".ref-flow-step-card") ||
                target.closest(".ref-flow-toolbar")
              ) {
                return;
              }
              dragStateRef.current = {
                mode: "pan",
                startClientX: e.clientX,
                startClientY: e.clientY,
                originX: canvasViewport.x,
                originY: canvasViewport.y,
              };
              setIsDraggingCanvas(true);
            }}
            onWheel={(e) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.08 : -0.08;
                setCanvasViewport((prev) => ({
                  ...prev,
                  zoom: Math.min(
                    1.45,
                    Math.max(0.45, Number((prev.zoom + delta).toFixed(2)))
                  ),
                }));
              } else {
                setCanvasViewport((prev) => ({
                  ...prev,
                  x: prev.x - e.deltaX,
                  y: prev.y - e.deltaY,
                }));
              }
            }}
          >
            <div
              className="ref-flow-canvas-transform-layer"
              style={{
                transform: `translate3d(${canvasViewport.x}px, ${canvasViewport.y}px, 0) scale(${canvasViewport.zoom})`,
              }}
            >
              {/* 1. SVG BEZIER WIRES LAYER (Immutable Parent->Child Lineage + Draft Wire) */}
              <svg
                className="ref-flow-edges-svg"
                width="4800"
                height="3600"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="flow-arrow-locked"
                    markerWidth="9"
                    markerHeight="9"
                    refX="7"
                    refY="4.5"
                    orient="auto"
                  >
                    <path d="M0,0 L9,4.5 L0,9 Z" fill="#14213d" />
                  </marker>
                  <marker
                    id="flow-arrow-draft"
                    markerWidth="9"
                    markerHeight="9"
                    refX="7"
                    refY="4.5"
                    orient="auto"
                  >
                    <path d="M0,0 L9,4.5 L0,9 Z" fill="#fca311" />
                  </marker>
                </defs>

                {interactions.flatMap((round) => {
                  if (!round.parentTurnNumber) return [];
                  const parentRound = interactions.find(
                    (r) => r.turnNumber === round.parentTurnNumber
                  );
                  if (!parentRound) return [];
                  const parentVarIdx =
                    parentVariantByTurn[round.turnNumber] ??
                    parentRound.selectedVariantIndex ??
                    0;
                  const parentCardId = getFrameNodeId(
                    parentRound.id,
                    parentVarIdx
                  );
                  const sourcePos = nodePositions[parentCardId] || {
                    x: 70,
                    y: 60 + parentVarIdx * 315,
                  };

                  return round.variants.map((_, slotIdx) => {
                    const childCardId = getFrameNodeId(round.id, slotIdx);
                    const targetPos = nodePositions[childCardId] || {
                      x: sourcePos.x + 410,
                      y: 60 + slotIdx * 315,
                    };
                    const wire = buildStepBezierPath(sourcePos, targetPos);
                    const isHighlighted =
                      selectedCanvasNodeId === childCardId ||
                      selectedCanvasNodeId === parentCardId;

                    return (
                      <g key={`edge-${parentCardId}-${childCardId}`}>
                        <path
                          d={wire.path}
                          fill="none"
                          stroke={isHighlighted ? "#fca311" : "#14213d"}
                          strokeWidth={isHighlighted ? "3" : "2.2"}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          markerEnd="url(#flow-arrow-locked)"
                        />
                        <circle
                          cx={wire.startX}
                          cy={wire.startY}
                          r="4.5"
                          fill="#fca311"
                          stroke="#14213d"
                          strokeWidth="1.8"
                        />
                      </g>
                    );
                  });
                })}

                {/* Active Generating 4-Card Wires (shown while actively generating 4 new image cards) */}
                {isGenerating &&
                  draftStep &&
                  draftParentRound &&
                  (() => {
                    const parentCardId = getFrameNodeId(
                      draftParentRound.id,
                      draftStep.parentVariantIndex
                    );
                    const sourcePos = nodePositions[parentCardId] || {
                      x: 70,
                      y: 60,
                    };
                    return draftStep.positions.map((targetPos, draftIdx) => {
                      const wire = buildStepBezierPath(sourcePos, targetPos);
                      return (
                        <g key={`edge-draft-active-${draftIdx}`}>
                          <path
                            d={wire.path}
                            fill="none"
                            stroke="#fca311"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="7 5"
                            markerEnd="url(#flow-arrow-draft)"
                          />
                          <circle
                            cx={wire.startX}
                            cy={wire.startY}
                            r="5"
                            fill="#fca311"
                            stroke="#000000"
                            strokeWidth="1.8"
                          />
                        </g>
                      );
                    });
                  })()}
              </svg>

              {/* 2. COMPLETED IMMUTABLE IMAGE CARDS (1 Card per Generated Image; 4 Images = 4 Cards) */}
              {interactions.flatMap((round, roundIdx) => {
                const snap = snapshotsByTurn[round.turnNumber];
                const styleTitle =
                  bootstrapData.style_presets
                    .find((s) => s.id === snap?.styleId)
                    ?.title.split(" (")[0] || null;
                const parentVarIdx =
                  parentVariantByTurn[round.turnNumber] ?? 0;

                return round.variants.map((slot, slotIdx) => {
                  const cardId = getFrameNodeId(round.id, slotIdx);
                  const pos = nodePositions[cardId] || {
                    x: 70 + roundIdx * 410,
                    y: 60 + slotIdx * 315,
                  };
                  const isNodeSelected = selectedCanvasNodeId === cardId;
                  const cleanVariantTitle =
                    slot?.label
                      ?.replace(/^[0-9]+\s*•\s*/, "")
                      .split(" (")[0] || `Image #${slotIdx + 1}`;

                  return (
                    <article
                      key={cardId}
                      className={`ref-flow-step-card is-locked ${
                        isNodeSelected ? "selected" : ""
                      }`}
                      style={{
                        left: `${pos.x}px`,
                        top: `${pos.y}px`,
                      }}
                      onClick={() => {
                        setActiveInteractionIndex(roundIdx);
                        setSelectedCanvasNodeId(cardId);
                      }}
                    >
                      {/* Left Input Socket */}
                      {round.parentTurnNumber !== null && (
                        <span
                          className="ref-flow-port input-port"
                          title={`Branched from Card #${
                            round.parentTurnNumber
                          }.${parentVarIdx + 1}`}
                        />
                      )}

                      {/* Right n8n '+' Output Port Button (Branches 4 new image cards from THIS card) */}
                      <button
                        type="button"
                        className="ref-flow-port output-port-btn"
                        disabled={isGenerating}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartBranchFromNode(round, slotIdx, "compose");
                        }}
                        title={`Branch 4 new image cards from Card #${
                          round.turnNumber
                        }.${slotIdx + 1}`}
                        aria-label={`Branch new step from Card #${
                          round.turnNumber
                        }.${slotIdx + 1}`}
                      >
                        <IconPlus size={12} strokeWidth={2.3} />
                      </button>

                      {/* Draggable Card Header */}
                      <div
                        className="ref-flow-node-header"
                        onMouseDown={(e) => {
                          if ((e.target as HTMLElement).closest("button")) {
                            return;
                          }
                          e.stopPropagation();
                          setActiveInteractionIndex(roundIdx);
                          setSelectedCanvasNodeId(cardId);
                          dragStateRef.current = {
                            mode: "node",
                            nodeId: cardId,
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            originX: pos.x,
                            originY: pos.y,
                          };
                          setIsDraggingCanvas(true);
                        }}
                      >
                        <div className="ref-flow-node-title-group">
                          <span
                            className="ref-flow-drag-grip"
                            title="Drag to organize this card on screen"
                          >
                            <IconGripDots size={12} />
                          </span>
                          <span className="ref-flow-step-badge locked">
                            🔒 #{round.turnNumber}.{slotIdx + 1}
                          </span>
                          <span className="ref-flow-step-ratio">
                            {round.aspectRatio}
                          </span>
                          <span
                            className="ref-flow-step-meta-chip"
                            title={cleanVariantTitle}
                          >
                            {styleTitle || cleanVariantTitle}
                          </span>
                        </div>
                      </div>

                      {/* Single Image Stage + Hover Actions (⤢ Expand, ↓ Download, 🧬 Pin DNA) */}
                      <div
                        className="ref-flow-hero-frame"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (!slot?.imageUrl) return;
                          setActiveInteractionIndex(roundIdx);
                          setLightboxSlot({
                            slot,
                            index: slotIdx,
                            turnNumber: round.turnNumber,
                          });
                        }}
                      >
                        {slot?.imageUrl ? (
                          <>
                            <img
                              src={slot.imageUrl}
                              alt={slot.label}
                              className="ref-flow-hero-img"
                            />
                            <span className="ref-flow-slot-num-badge">
                              {cleanVariantTitle}
                            </span>
                            <div className="ref-flow-hero-hover-actions">
                              <button
                                type="button"
                                className="ref-quad-overlay-icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveInteractionIndex(roundIdx);
                                  setLightboxSlot({
                                    slot,
                                    index: slotIdx,
                                    turnNumber: round.turnNumber,
                                  });
                                }}
                                title="Expand image in full screen (Lightbox)"
                                aria-label="Expand image in full screen"
                              >
                                <IconExpand size={14} strokeWidth={1.9} />
                              </button>
                              <button
                                type="button"
                                className="ref-quad-overlay-icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const a = document.createElement("a");
                                  a.href = slot.imageUrl;
                                  a.download = `step-${round.turnNumber}-card-${
                                    slotIdx + 1
                                  }.png`;
                                  a.click();
                                }}
                                title="Download PNG"
                                aria-label="Download PNG"
                              >
                                <IconDownload size={14} strokeWidth={1.9} />
                              </button>
                              <button
                                type="button"
                                className={`ref-quad-overlay-icon-btn ${
                                  canonicalDnaRef?.imageUrl === slot.imageUrl
                                    ? "active-dna"
                                    : ""
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handlePinCanonicalDna(
                                    slot,
                                    round.turnNumber
                                  );
                                }}
                                title="Pin this card as Canonical Character DNA across the flow"
                                aria-label="Pin Canonical DNA"
                              >
                                <IconDna size={14} strokeWidth={1.7} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="ref-flow-slot-blueprint">
                            <strong>
                              Card #{round.turnNumber}.{slotIdx + 1}
                            </strong>
                            <span>{cleanVariantTitle}</span>
                          </div>
                        )}
                      </div>

                      {/* 1-Line Prompt Footer (Click to open read-only Inspector Modal for this image card) */}
                      <button
                        type="button"
                        className="ref-flow-node-footer-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveInteractionIndex(roundIdx);
                          setSelectedCanvasNodeId(cardId);
                          setIsStepModalOpen(true);
                        }}
                        title="Click to inspect this card's immutable prompt & parameters"
                      >
                        <span className="ref-flow-node-prompt-single">
                          {slot?.prompt || round.chosenPrompt}
                        </span>
                        <span className="ref-flow-footer-inspect-tag">
                          Inspect ↗
                        </span>
                      </button>
                    </article>
                  );
                });
              })}

              {/* 3. LIVE GENERATING 4 IMAGE CARDS OR EMPTY-PROJECT STARTER CARD */}
              {isGenerating &&
                draftStep &&
                draftStep.positions.map((pos, draftIdx) => {
                  const liveSlot = liveDraftSlots[draftIdx];
                  const nextTurnNum = interactions.length + 1;
                  return (
                    <article
                      key={`draft-card-${draftIdx}`}
                      className="ref-flow-step-card is-draft is-generating"
                      style={{
                        left: `${pos.x}px`,
                        top: `${pos.y}px`,
                      }}
                    >
                      {draftStep.parentTurnNumber !== null && (
                        <span
                          className="ref-flow-port input-port draft"
                          title={`Branched from Card #${
                            draftStep.parentTurnNumber
                          }.${draftStep.parentVariantIndex + 1}`}
                        />
                      )}

                      <div
                        className="ref-flow-node-header"
                        onMouseDown={(e) => {
                          if ((e.target as HTMLElement).closest("button")) {
                            return;
                          }
                          e.stopPropagation();
                          dragStateRef.current = {
                            mode: "node",
                            nodeId: `draft::${draftIdx}`,
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            originX: pos.x,
                            originY: pos.y,
                          };
                          setIsDraggingCanvas(true);
                        }}
                      >
                        <div className="ref-flow-node-title-group">
                          <span className="ref-flow-drag-grip">
                            <IconGripDots size={12} />
                          </span>
                          <span className="ref-flow-step-badge draft">
                            ⚡ #{nextTurnNum}.{draftIdx + 1}
                          </span>
                          <span className="ref-flow-step-ratio">
                            {selectedAspectRatio}
                          </span>
                        </div>
                      </div>

                      <div className="ref-flow-hero-frame">
                        {liveSlot?.imageUrl ? (
                          <img
                            src={liveSlot.imageUrl}
                            alt={liveSlot.label}
                            className="ref-flow-hero-img"
                          />
                        ) : (
                          <div className="ref-flow-slot-blueprint">
                            <span className="ref-quad-drafting-pulse" />
                            <strong>
                              {generationStage === "analyzing-scene"
                                ? `Composing #${draftIdx + 1}...`
                                : `Rendering Card #${nextTurnNum}.${
                                    draftIdx + 1
                                  }...`}
                            </strong>
                            <span>
                              {liveSlot?.label || activeMatrixConfig.label}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="ref-flow-node-footer-btn">
                        <span className="ref-flow-node-prompt-single">
                          {liveSlot?.prompt || promptInput || "Generating..."}
                        </span>
                      </div>
                    </article>
                  );
                })}

              {!isGenerating && interactions.length === 0 && draftStep && (
                <article
                  className="ref-flow-step-card is-draft selected"
                  style={{
                    left: `${draftStep.positions[0]?.x ?? 70}px`,
                    top: `${draftStep.positions[0]?.y ?? 60}px`,
                  }}
                  onClick={() => {
                    setSelectedCanvasNodeId("draft");
                    setIsStepModalOpen(true);
                  }}
                >
                  <div className="ref-flow-node-header">
                    <div className="ref-flow-node-title-group">
                      <span className="ref-flow-step-badge draft">
                        ✨ Start Step #1 (Creates 4 Image Cards)
                      </span>
                    </div>
                  </div>
                  <div className="ref-flow-starter-empty-body">
                    <strong className="ref-quad-blueprint-title">
                      Start Your Creation Flow
                    </strong>
                    <span className="ref-quad-blueprint-desc">
                      Click below to configure Step #1 and generate your first 4
                      image cards on the canvas.
                    </span>
                    <button
                      type="button"
                      className="ref-dark-pill-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCanvasNodeId("draft");
                        setIsStepModalOpen(true);
                      }}
                    >
                      <IconPlus size={12} strokeWidth={2.2} />
                      <span>Create Step #1 (4 Cards)</span>
                    </button>
                  </div>
                </article>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ==================== MODAL FOR STEP CREATION & IMMUTABLE CARD INSPECTION ==================== */}
      {isStepModalOpen && (
        <div
          className="ref-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Step Configuration and Inspection Modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsStepModalOpen(false);
          }}
        >
          <div className="ref-flow-step-modal-card">
            <div className="ref-modal-header">
              <strong className="ref-soft-card-title">
                {selectedCanvasNodeId !== "draft" && selectedLockedRound
                  ? `🔒 Inspect Card #${selectedLockedRound.turnNumber}.${
                      selectedLockedVariantIdx + 1
                    }`
                  : `✨ Configure New Step #${interactions.length + 1} (Creates 4 Cards)${
                      draftParentRound
                        ? ` • From Card #${draftParentRound.turnNumber}.${
                            (draftStep?.parentVariantIndex ?? 0) + 1
                          }`
                        : ""
                    }`}
              </strong>
              <button
                type="button"
                aria-label="Close modal"
                className="ref-circle-icon-btn sm"
                onClick={() => setIsStepModalOpen(false)}
              >
                <IconClose size={12} />
              </button>
            </div>

            <div className="ref-flow-step-modal-body">
          {selectedCanvasNodeId !== "draft" && selectedLockedRound ? (
            <div className="ref-params-card ref-params-deck">
              <div className="ref-params-card-header">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <span className="ref-flow-step-badge locked">
                    🔒 Card #{selectedLockedRound.turnNumber}.
                    {selectedLockedVariantIdx + 1} (Immutable)
                  </span>
                  {selectedLockedRound.parentTurnNumber && (
                    <span className="ref-pill-chip">
                      Branched from Card #{selectedLockedRound.parentTurnNumber}.
                      {(parentVariantByTurn[selectedLockedRound.turnNumber] ??
                        0) + 1}
                    </span>
                  )}
                </div>
                <span className="ref-studio-ratio-readout">
                  {selectedLockedRound.aspectRatio}
                </span>
              </div>

              <div className="ref-flow-inspector-body">
                {selectedLockedSlot?.imageUrl && (
                  <div
                    className="ref-flow-hero-frame"
                    style={{ maxHeight: "260px", borderRadius: "10px" }}
                  >
                    <img
                      src={selectedLockedSlot.imageUrl}
                      alt={selectedLockedSlot.label}
                      className="ref-flow-hero-img"
                    />
                    <span className="ref-flow-slot-num-badge">
                      {selectedLockedSlot.label}
                    </span>
                  </div>
                )}

                <div className="ref-params-field-group">
                  <span className="ref-field-label">
                    Recorded Prompt (Card #{selectedLockedRound.turnNumber}.
                    {selectedLockedVariantIdx + 1} • Read-Only):
                  </span>
                  <div className="ref-flow-readonly-box">
                    {selectedLockedSlot?.prompt ||
                      selectedLockedRound.chosenPrompt}
                  </div>
                </div>

                <div className="ref-params-field-group">
                  <span className="ref-field-label">
                    Locked Card Parameters:
                  </span>
                  <div className="ref-params-pills-wrap">
                    {selectedLockedRound.editInstruction && (
                      <span className="ref-pill-chip active">
                        {selectedLockedRound.editInstruction}
                      </span>
                    )}
                    <span className="ref-pill-chip">
                      Ratio: {selectedLockedRound.aspectRatio}
                    </span>
                    {(() => {
                      const snap =
                        snapshotsByTurn[selectedLockedRound.turnNumber];
                      if (!snap) return null;
                      const styleObj = bootstrapData.style_presets.find(
                        (s) => s.id === snap.styleId
                      );
                      const allMods =
                        bootstrapData.modifier_categories.flatMap(
                          (c) => c.options
                        );
                      return (
                        <>
                          {styleObj && (
                            <span className="ref-pill-chip">
                              🎨 {styleObj.title.split(" (")[0]}
                            </span>
                          )}
                          {snap.modifierIds.map((mId) => {
                            const found = allMods.find((o) => o.id === mId);
                            return found ? (
                              <span key={mId} className="ref-pill-chip">
                                🎛️ {found.label.split(" (")[0]}
                              </span>
                            ) : null;
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="ref-flow-inspector-cta-box">
                  <span className="ref-field-label">
                    Branch 4 New Image Cards from Card #
                    {selectedLockedRound.turnNumber}.
                    {selectedLockedVariantIdx + 1}:
                  </span>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="ref-dark-pill-btn"
                      onClick={() =>
                        handleStartBranchFromNode(
                          selectedLockedRound,
                          selectedLockedVariantIdx,
                          "compose"
                        )
                      }
                    >
                      <IconAtelierStar size={13} />
                      <span>Branch 4 New Cards (Compose)</span>
                    </button>
                    <button
                      type="button"
                      className="ref-mura-btn-outline lg"
                      onClick={() =>
                        handleStartBranchFromNode(
                          selectedLockedRound,
                          selectedLockedVariantIdx,
                          "surgical-delta"
                        )
                      }
                    >
                      <span>⚡ Branch Surgical Delta</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form
              className="ref-flow-create-modal-form"
              onSubmit={handleGenerateInteraction}
            >
              <div className="ref-flow-create-modal-columns">
                {/* LEFT COLUMN: Parent Frame Anchor + Prompt/Surgical Delta Editor */}
                <div className="ref-params-card">
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
                  <IconAtelierStar size={12} />
                  <span>Compose</span>
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
                  <span>⚡ Surgical Delta</span>
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
                  <IconAtelierStar size={12} />
                  <span>{isEnhancingNarrative ? "Enhancing..." : "Enhance"}</span>
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
                        <IconClose size={10} strokeWidth={2} />
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
                      <IconAtelierStar size={12} />
                      <span>Compose Scene</span>
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

                </div>

                {/* RIGHT COLUMN: Aspect Ratio + 3-Tab Parameter Deck (2x2 Matrix | Visual Style | Modifiers) */}
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
              </div>

              {/* UNIFIED BOTTOM FOOTER BAR */}
              <div className="ref-flow-create-modal-footer">
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

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <button
                    type="button"
                    className="ref-mura-btn-outline lg"
                    onClick={() => setIsStepModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="generate-nanobanana-primary-btn"
                    className="ref-dark-pill-btn"
                    disabled={
                      isGenerating ||
                      (flowMode === "surgical-delta"
                        ? !(
                            draftParentRound ||
                            activeInteraction ||
                            canonicalDnaRef?.imageUrl
                          ) || !deltaInput.trim()
                        : !promptInput.trim())
                    }
                  >
                    {!isGenerating && <IconPlay size={11} />}
                    <span>
                      {isGenerating
                        ? `Rendering Step #${interactions.length + 1}...`
                        : `Generate Step #${
                            interactions.length + 1
                          } (4 Images)`}
                    </span>
                    <span className="ref-lime-badge">
                      {interactions.length + 1}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          )}
            </div>
          </div>
        </div>
      )}

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
                          <IconChevron direction="left" size={12} />
                          <span>Previous</span>
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
                          <span>Next</span>
                          <IconChevron direction="right" size={12} />
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
                      <IconDownload size={13} />
                      <span>Download PNG</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Close lightbox"
                      className="ref-circle-icon-btn md"
                      onClick={() => setLightboxSlot(null)}
                    >
                      <IconClose size={13} />
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

      {/* ==================== MODAL FOR EDITING PROJECT NAME ==================== */}
      {isProjectTitleModalOpen && (
        <div
          className="ref-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-project-title-modal-heading"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsProjectTitleModalOpen(false);
            }
          }}
        >
          <form
            className="ref-modal-card"
            style={{ maxWidth: "400px", padding: "20px 22px", gap: "14px" }}
            onSubmit={handleSaveProjectTitleModal}
          >
            <div className="ref-modal-header">
              <strong
                id="edit-project-title-modal-heading"
                className="ref-soft-card-title"
              >
                ✎ Edit Project Name
              </strong>
              <button
                type="button"
                aria-label="Close modal"
                className="ref-circle-icon-btn sm"
                onClick={() => setIsProjectTitleModalOpen(false)}
              >
                <IconClose size={12} />
              </button>
            </div>

            <div>
              <label
                className="ref-field-label"
                htmlFor="edit-project-title-input"
              >
                Project Name
              </label>
              <input
                ref={projectTitleInputRef}
                id="edit-project-title-input"
                type="text"
                value={projectTitleDraft}
                onChange={(e) => setProjectTitleDraft(e.target.value)}
                className="ref-input"
                placeholder="Enter project name..."
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: "8px",
                paddingTop: "2px",
              }}
            >
              <button
                type="button"
                className="ref-mura-btn-outline lg"
                onClick={() => setIsProjectTitleModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="ref-dark-pill-btn">
                <span>Save Name</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
