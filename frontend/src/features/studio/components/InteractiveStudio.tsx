"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Link from "next/link";
import {
  BootstrapResponse,
  CanonicalDnaReference,
  CreationFlowMode,
  CreationTabMode,
  CreationWizardStep,
  FlowNodePosition,
  FlowStepParameterSnapshot,
  InlineImagePart,
  NanoBananaModel,
  PreservationLocks,
  SessionFrame,
} from "../types/studio.types";
import {
  buildConsolidatedScenePrompt,
  enhanceNarrativeWithGemini,
  generatePromptVariationsWithGemini,
  imageUrlToInlinePart,
  parseDataUrl,
  QuadGeneratedSlot,
  QuadPromptVariation,
  renderPreparedBatchWithNanoBanana,
} from "../services/nanobananaClient";
import {
  buildStepBezierPath,
  computeBatchBranchNodePositions,
  computeTreeAutoLayout,
  FLOW_HORIZONTAL_SPACING,
  FLOW_VERTICAL_SPACING,
  FlowObstacleNode,
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
  IconCheck,
  IconChevron,
  IconClose,
  IconDna,
  IconDownload,
  IconExpand,
  IconGripDots,
  IconMinus,
  IconPlay,
  IconPlus,
  IconPromptText,
  IconRefresh,
  IconUploadImage,
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

interface ReferenceCardAnchor {
  roundId: string;
  turnNumber: number;
  variantIndex: number;
  label: string;
  imageUrl: string;
  prompt: string;
}

const ASPECT_RATIO_OPTIONS = ["1:1", "3:4", "4:3", "16:9", "9:16"] as const;
const IMAGE_COUNT_TICKS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const PROMPT_COMPLETENESS_PILLARS = [
  {
    id: "subject",
    label: "Subject",
    regex:
      /\b(woman|man|girl|boy|samurai|swordswoman|explorer|character|figure|portrait|person|warrior|architect|monk|traveler|pilot|hero|silhouette|robot|cyborg|interior|observatory)\b/i,
    suggestions: [
      {
        label: "Expressive gaze & posture",
        snippet: "with an expressive focused gaze and poised dynamic posture",
      },
      {
        label: "Tailored technical attire",
        snippet:
          "wearing tailored technical outerwear with weathered brass fasteners",
      },
      {
        label: "Artisanal silk & leather",
        snippet:
          "draped in layered raw silk garments with heirloom leather strapping",
      },
    ],
  },
  {
    id: "environment",
    label: "Environment",
    regex:
      /\b(alley|street|studio|atelier|cliff|city|forest|temple|room|landscape|courtyard|rain|mist|sky|ocean|horizon|architecture|backdrop|garden|bridge|station)\b/i,
    suggestions: [
      {
        label: "Rain-slicked lantern alley",
        snippet:
          "set in a rain-slicked cobblestone alley lined with glowing paper lanterns",
      },
      {
        label: "Sunlit concrete atelier",
        snippet:
          "inside a minimalist architectural concrete atelier with tall skylights",
      },
      {
        label: "Misty coastal cliff",
        snippet:
          "overlooking a misty coastal cliff against a deep Prussian-blue horizon",
      },
    ],
  },
  {
    id: "camera",
    label: "Camera",
    regex:
      /\b(24mm|35mm|50mm|85mm|lens|close-up|closeup|wide|angle|framing|depth of field|f\/1|bokeh|telephoto|anamorphic|eye-level|low-angle|establishing)\b/i,
    suggestions: [
      {
        label: "85mm f/1.4 Portrait",
        snippet:
          "captured on an 85mm f/1.4 portrait lens with shallow depth of field",
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
    label: "Lighting",
    regex:
      /\b(light|lighting|sunlight|golden|hour|rim|shadow|chiaroscuro|neon|lantern|glow|dusk|dawn|amber|backlit|volumetric|overcast|skylight|illumination)\b/i,
    suggestions: [
      {
        label: "Warm Golden Hour Rim",
        snippet:
          "bathed in warm late-afternoon golden-hour rim sunlight with long shadows",
      },
      {
        label: "Chiaroscuro Contrast",
        snippet:
          "lit with dramatic chiaroscuro key light and deep sculpted ink shadows",
      },
      {
        label: "Amber & Cyan Reflections",
        snippet:
          "illuminated by warm amber practicals and cool cyan atmospheric fill",
      },
    ],
  },
  {
    id: "texture",
    label: "Texture & Mood",
    regex:
      /\b(texture|grain|film|cel-shaded|ink|watercolor|linen|paper|patina|wet|asphalt|silk|leather|concrete|brass|tactile|micro-texture|cinematic|editorial)\b/i,
    suggestions: [
      {
        label: "Tactile fabric & film grain",
        snippet:
          "featuring tactile fabric weave, subtle 35mm film grain, and crisp ink contours",
      },
      {
        label: "Washi paper & sumi ink",
        snippet:
          "rendered with archival washi paper tooth and bold sumi-e ink brushwork",
      },
      {
        label: "Wet specular reflections",
        snippet:
          "with crisp specular reflections on wet surfaces and rich atmospheric haze",
      },
    ],
  },
] as const;

function normalizeSlotLabelToEnglish(
  rawLabel: string | undefined,
  idx: number
): string {
  if (!rawLabel) return `Variation #${idx + 1}`;
  return rawLabel
    .replace("Prompt Base", "Base Prompt")
    .replace("Ênfase:", "Emphasis:")
    .replace("Versão #", "Variation #");
}

function normalizeProjectTitleToEnglish(rawTitle: string | undefined): string {
  if (
    !rawTitle ||
    rawTitle.trim() === "Novo Projeto" ||
    rawTitle.trim() === "Sem título"
  ) {
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
    enhanceSystemPrompt,
    variationSystemPrompt,
  } = useStudioSession();
  const [model, setModel] = useState<NanoBananaModel>(
    "gemini-2.5-flash-image"
  );
  const [modelTemperature, setModelTemperature] = useState<number>(1.0);
  const [modelTopP, setModelTopP] = useState<number>(0.95);
  const [modelSeedInput, setModelSeedInput] = useState<string>("");

  // Creation Modal 3-Step Wizard State
  const [wizardStep, setWizardStep] = useState<CreationWizardStep>(1);
  const [creationTab, setCreationTab] = useState<CreationTabMode>("prompt");
  const [promptInput, setPromptInput] = useState<string>("");
  const [imageCount, setImageCount] = useState<number>(4);
  const [enhancePromptWithAi, setEnhancePromptWithAi] =
    useState<boolean>(false);
  const [varyPromptsWithAi, setVaryPromptsWithAi] = useState<boolean>(false);

  // Step 2 & Step 3 AI Review Buffers
  const [enhancedPromptDraft, setEnhancedPromptDraft] = useState<string>("");
  const [isPreparingStep2, setIsPreparingStep2] = useState<boolean>(false);
  const [variationDrafts, setVariationDrafts] = useState<QuadPromptVariation[]>(
    []
  );
  const [isPreparingStep3, setIsPreparingStep3] = useState<boolean>(false);

  // Tab 2 Reference Image State (either pre-loaded from a Canvas Card or uploaded/pasted from computer)
  const [referenceCardInfo, setReferenceCardInfo] =
    useState<ReferenceCardAnchor | null>(null);
  const [uploadedReference, setUploadedReference] = useState<{
    name: string;
    dataUrl: string;
  } | null>(null);
  const [isDraggingOverDropzone, setIsDraggingOverDropzone] =
    useState<boolean>(false);
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);

  // Prompt Hints & Modifier / Model Selectors
  const [showPromptHints, setShowPromptHints] = useState<boolean>(false);
  const [activePillarId, setActivePillarId] = useState<string | null>(null);
  const [activeParamTab, setActiveParamTab] = useState<"modifiers" | "model">(
    "modifiers"
  );
  const [preservationLocks, setPreservationLocks] = useState<PreservationLocks>(
    {
      keepCharacter: true,
      keepPose: false,
      keepBackground: false,
    }
  );
  const [canonicalDnaRef, setCanonicalDnaRef] =
    useState<CanonicalDnaReference | null>(null);
  const [lightboxCompareMode, setLightboxCompareMode] =
    useState<boolean>(false);

  const [selectedStyleId, setSelectedStyleId] = useState<string>("none");
  const [selectedAspectRatio, setSelectedAspectRatio] =
    useState<string>("3:4");
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [activeModCategoryId, setActiveModCategoryId] = useState<string>(
    bootstrapData.modifier_categories[0]?.id || "camera"
  );

  // Live Generation & Canvas State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStage, setGenerationStage] = useState<
    "idle" | "analyzing-scene" | "rendering-images"
  >("idle");
  const [liveDraftSlots, setLiveDraftSlots] = useState<
    Array<QuadGeneratedSlot | null>
  >([]);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [lightboxSlot, setLightboxSlot] = useState<{
    slot: QuadGeneratedSlot;
    index: number;
    turnNumber: number;
  } | null>(null);

  const [interactions, setInteractions] = useState<StudioInteractionRound[]>(
    []
  );
  const [activeInteractionIndex, setActiveInteractionIndex] =
    useState<number>(-1);

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
    positions: [{ x: 140, y: 140 }],
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

  // Helper to resolve current style & modifier labels (only when explicitly selected)
  const getActiveStyleAndModifierLabels = useCallback(() => {
    const activeStyleObj =
      selectedStyleId && selectedStyleId !== "none"
        ? bootstrapData.style_presets.find((s) => s.id === selectedStyleId)
        : undefined;
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

    return {
      styleLabel: activeStyleObj?.title.split(" (")[0],
      modifierLabels: activeModifierLabels,
    };
  }, [
    bootstrapData.modifier_categories,
    bootstrapData.style_presets,
    selectedModifiers,
    selectedStyleId,
  ]);

  const loadProjectById = useCallback(
    async (convId: string) => {
      setActiveProjectId(convId);
      const detail = await getConversationDetail(convId, activeUser.id);
      if (!detail) return;
      setProjectTitle(normalizeProjectTitleToEnglish(detail.title));
      setCanonicalDnaRef(detail.canonical_dna || null);

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
        if (lastRound.aspectRatio) {
          setSelectedAspectRatio(lastRound.aspectRatio);
        }
      } else {
        setActiveInteractionIndex(-1);
        setNodePositions({});
        setParentVariantByTurn({});
        setSnapshotsByTurn({});
        setSelectedCanvasNodeId("draft");
        setDraftStep({
          parentTurnNumber: null,
          parentVariantIndex: 0,
          positions: [{ x: 140, y: 140 }],
        });
        setPromptInput("");
        setEnhancedPromptDraft("");
        setVariationDrafts([]);
        setSelectedStyleId("none");
        setSelectedModifiers([]);
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
    if (externalPresetRequest && !externalPresetRequest.conversationId) {
      if (externalPresetRequest.styleId) {
        setSelectedStyleId(externalPresetRequest.styleId);
      }
      if (externalPresetRequest.prompt || externalPresetRequest.idea) {
        setPromptInput(
          externalPresetRequest.prompt || externalPresetRequest.idea
        );
      }
      if (externalPresetRequest.imageUrl) {
        setUploadedReference({
          name: "Gallery Remix Reference",
          dataUrl: externalPresetRequest.imageUrl,
        });
        setReferenceCardInfo(null);
        setCreationTab("reference");
      } else {
        setCreationTab("prompt");
      }
      setWizardStep(1);
      setSelectedCanvasNodeId("draft");
      setIsStepModalOpen(true);
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

  // Close lightbox on Escape & navigate across variations with ArrowLeft / ArrowRight
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

  // Reset to a completely empty new project showing ONLY the minimalist '+' flow item
  // (while keeping the newly created SQLite project ID so the project stays in Gallery!)
  useEffect(() => {
    if (newProjectNonce === 0) return;
    setPromptInput("");
    setEnhancedPromptDraft("");
    setVariationDrafts([]);
    setWizardStep(1);
    setCreationTab("prompt");
    setReferenceCardInfo(null);
    setUploadedReference(null);
    setActivePillarId(null);
    setCanonicalDnaRef(null);
    setSelectedStyleId("none");
    setSelectedModifiers([]);
    setInteractions([]);
    setActiveInteractionIndex(-1);
    setNodePositions({});
    setParentVariantByTurn({});
    setSnapshotsByTurn({});
    setDraftStep({
      parentTurnNumber: null,
      parentVariantIndex: 0,
      positions: [{ x: 140, y: 140 }],
    });
    setSelectedCanvasNodeId("draft");
    setIsStepModalOpen(false);
    setCanvasViewport({ x: 24, y: 24, zoom: 0.92 });
    setLightboxSlot(null);
    setLiveDraftSlots([]);
    setGenerationStage("idle");
    showTransientNotice("✦ New project created — click '+' to start");
  }, [newProjectNonce, showTransientNotice]);

  // Clipboard image paste support when Creation Modal is open on Step 1 -> Tab 2 ("reference")
  useEffect(() => {
    if (
      !isStepModalOpen ||
      selectedCanvasNodeId !== "draft" ||
      wizardStep !== 1 ||
      creationTab !== "reference"
    ) {
      return;
    }
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === "string") {
              setUploadedReference({
                name: file.name || "Pasted image",
                dataUrl: reader.result,
              });
              setReferenceCardInfo(null);
              showTransientNotice("✦ Reference image pasted from clipboard");
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [
    creationTab,
    isStepModalOpen,
    selectedCanvasNodeId,
    showTransientNotice,
    wizardStep,
  ]);

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

  // Opens Creation Modal on Step 1 / Tab 1 ("From Prompt") for a fresh root generation
  const openCreationModalAsNewRoot = useCallback(() => {
    setSelectedCanvasNodeId("draft");
    setWizardStep(1);
    setCreationTab("prompt");
    setReferenceCardInfo(null);
    setEnhancedPromptDraft("");
    setVariationDrafts([]);
    setIsStepModalOpen(true);
  }, []);

  // Opens Creation Modal on Step 1 / Tab 2 ("With Reference Image") pre-loaded with a specific Canvas Card
  const handleStartBranchFromNode = useCallback(
    (parentRound: StudioInteractionRound | null, variantIndex: number = 0) => {
      if (!parentRound) {
        openCreationModalAsNewRoot();
        return;
      }

      const roundIdx = interactions.findIndex((r) => r.id === parentRound.id);
      if (roundIdx >= 0) {
        setActiveInteractionIndex(roundIdx);
      }

      const chosenSlot =
        parentRound.variants[variantIndex] || parentRound.variants[0];
      if (parentRound.aspectRatio) {
        setSelectedAspectRatio(parentRound.aspectRatio);
      }

      setReferenceCardInfo({
        roundId: parentRound.id,
        turnNumber: parentRound.turnNumber,
        variantIndex,
        label: `Card #${parentRound.turnNumber}.${variantIndex + 1}`,
        imageUrl: chosenSlot?.imageUrl || parentRound.chosenImageUrl || "",
        prompt: chosenSlot?.prompt || parentRound.chosenPrompt || "",
      });
      setUploadedReference(null);
      setPromptInput("");
      setEnhancedPromptDraft("");
      setVariationDrafts([]);
      setWizardStep(1);
      setCreationTab("reference");
      setSelectedCanvasNodeId("draft");
      setIsStepModalOpen(true);
    },
    [interactions, openCreationModalAsNewRoot]
  );

  const applyFitViewportToPositions = useCallback(
    (allCoords: FlowNodePosition[]) => {
      if (allCoords.length === 0 || !canvasViewportRef.current) {
        setCanvasViewport({ x: 28, y: 28, zoom: 0.9 });
        return;
      }
      const minX = Math.min(...allCoords.map((p) => p.x));
      const maxX = Math.max(...allCoords.map((p) => p.x + 310));
      const minY = Math.min(...allCoords.map((p) => p.y));
      const maxY = Math.max(...allCoords.map((p) => p.y + 316));

      const rect = canvasViewportRef.current.getBoundingClientRect();
      const toolbarSafeTop = 76;
      const sidePad = 28;
      const usableWidth = Math.max(320, rect.width - sidePad * 2);
      const usableHeight = Math.max(260, rect.height - toolbarSafeTop - 24);
      const rawW = Math.max(320, maxX - minX);
      const rawH = Math.max(320, maxY - minY);
      const nextZoom = Math.min(
        1.0,
        Math.max(0.18, Math.min(usableWidth / rawW, usableHeight / rawH))
      );
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centeredX = Math.round(rect.width / 2 - centerX * nextZoom);
      const centeredY = Math.round(
        toolbarSafeTop + usableHeight / 2 - centerY * nextZoom
      );
      const minAllowedX = Math.round(sidePad - minX * nextZoom);
      const minAllowedY = Math.round(toolbarSafeTop + 8 - minY * nextZoom);
      setCanvasViewport({
        zoom: Number(nextZoom.toFixed(2)),
        x: rawW * nextZoom > usableWidth ? minAllowedX : centeredX,
        y: rawH * nextZoom > usableHeight ? minAllowedY : centeredY,
      });
    },
    []
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
    applyFitViewportToPositions(Object.values(autoMap));
    showTransientNotice(
      "✦ Flow auto-organized with collision-free wire corridors"
    );
  }, [
    activeProjectId,
    applyFitViewportToPositions,
    interactions,
    parentVariantByTurn,
    showTransientNotice,
    snapshotsByTurn,
  ]);

  const handleFitFlowView = useCallback(() => {
    const allCoords = [
      ...interactions
        .flatMap((r) =>
          r.variants.map((_, vIdx) => nodePositions[getFrameNodeId(r.id, vIdx)])
        )
        .filter((p): p is FlowNodePosition => Boolean(p)),
      ...(isGenerating && draftStep ? draftStep.positions : []),
    ];
    applyFitViewportToPositions(allCoords);
  }, [applyFitViewportToPositions, draftStep, interactions, isGenerating, nodePositions]);

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

  const readImageFileIntoTab2 = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        showTransientNotice("Please select a PNG, JPG, or WebP image file");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setUploadedReference({
            name: file.name,
            dataUrl: reader.result,
          });
          setReferenceCardInfo(null);
          showTransientNotice(`✦ Reference photo "${file.name}" loaded`);
        }
      };
      reader.readAsDataURL(file);
    },
    [showTransientNotice]
  );

  const handleUploadReferenceFile = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      readImageFileIntoTab2(file);
    }
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

  const handleChooseVariant = async (variantIdx: number) => {
    if (activeInteractionIndex < 0) return;
    const currentRound = interactions[activeInteractionIndex];
    if (!currentRound) return;
    const chosenSlot = currentRound.variants[variantIdx];
    if (!chosenSlot) return;

    setPromptInput(chosenSlot.prompt);
    showTransientNotice(
      `✓ "${chosenSlot.label}" selected — prompt loaded into editor`
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

  // ==================== STEP 2 & STEP 3 AI PREPARATION ====================

  const runEnhancePromptForStep2 = useCallback(async () => {
    const raw = promptInput.trim();
    if (!raw || isPreparingStep2) return;
    setIsPreparingStep2(true);
    try {
      const { styleLabel, modifierLabels } = getActiveStyleAndModifierLabels();
      const enhanced = await enhanceNarrativeWithGemini({
        apiKey,
        rawIdea: raw,
        styleLabel,
        modifierLabels,
        aspectRatio: selectedAspectRatio,
        hasReferenceImage: creationTab === "reference",
        preservationLocks:
          creationTab === "reference" ? preservationLocks : undefined,
        customSystemPrompt: enhanceSystemPrompt,
      });
      setEnhancedPromptDraft(enhanced || raw);
      setWizardStep(2);
    } finally {
      setIsPreparingStep2(false);
    }
  }, [
    apiKey,
    creationTab,
    enhanceSystemPrompt,
    getActiveStyleAndModifierLabels,
    isPreparingStep2,
    preservationLocks,
    promptInput,
    selectedAspectRatio,
  ]);

  const runGenerateVariationsForStep3 = useCallback(
    async (sourcePrompt: string) => {
      const cleanSource = sourcePrompt.trim();
      if (!cleanSource || isPreparingStep3) return;
      setIsPreparingStep3(true);
      try {
        const { styleLabel, modifierLabels } =
          getActiveStyleAndModifierLabels();
        const generated = await generatePromptVariationsWithGemini({
          apiKey,
          count: imageCount,
          basePrompt: cleanSource,
          styleLabel,
          modifierLabels,
          aspectRatio: selectedAspectRatio,
          hasReferenceImage: creationTab === "reference",
          preservationLocks:
            creationTab === "reference" ? preservationLocks : undefined,
          customSystemPrompt: variationSystemPrompt,
        });
        setVariationDrafts(generated);
        setWizardStep(3);
      } finally {
        setIsPreparingStep3(false);
      }
    },
    [
      apiKey,
      creationTab,
      getActiveStyleAndModifierLabels,
      imageCount,
      isPreparingStep3,
      preservationLocks,
      selectedAspectRatio,
      variationSystemPrompt,
    ]
  );

  // ==================== FINAL BATCH EXECUTION (1..8 IMAGES ON FLOW CANVAS) ====================

  const executeBatchGeneration = useCallback(
    async (opts: {
      finalPrompts: QuadPromptVariation[] | null;
      basePromptOverride?: string;
    }) => {
      if (isGenerating) return;
      const safeCount = Math.max(1, Math.min(8, Math.round(imageCount || 4)));
      const { styleLabel, modifierLabels } = getActiveStyleAndModifierLabels();
      const rawCore = (opts.basePromptOverride ?? promptInput).trim();
      if (!rawCore && (!opts.finalPrompts || opts.finalPrompts.length === 0)) {
        return;
      }

      const preparedItems: QuadPromptVariation[] =
        opts.finalPrompts && opts.finalPrompts.length > 0
          ? Array.from({ length: safeCount }, (_, idx) => {
              const item = opts.finalPrompts![idx] || opts.finalPrompts![0];
              return {
                label: item?.label || `${idx + 1} • Variation #${idx + 1}`,
                prompt: (item?.prompt || rawCore).trim(),
              };
            })
          : (() => {
              const consolidated = buildConsolidatedScenePrompt({
                basePrompt: rawCore,
                styleLabel,
                modifierLabels,
                aspectRatio: selectedAspectRatio,
                preservationLocks:
                  creationTab === "reference" ? preservationLocks : undefined,
                hasReferenceImage: creationTab === "reference",
              });
              return Array.from({ length: safeCount }, (_, idx) => ({
                label:
                  safeCount === 1
                    ? "1 • Generated Frame"
                    : `${idx + 1} • Frame #${idx + 1}`,
                prompt: consolidated,
              }));
            })();

      setIsStepModalOpen(false);
      setIsGenerating(true);
      setGenerationStage("rendering-images");

      let currentInteractions = [...interactions];
      let currentPositions: Record<string, FlowNodePosition> = {
        ...nodePositions,
      };
      let currentParentVariants: Record<number, number> = {
        ...parentVariantByTurn,
      };
      let currentSnapshots: Record<number, FlowStepParameterSnapshot> = {
        ...snapshotsByTurn,
      };
      let targetConvId = activeProjectId;

      try {
        let parentTurnNumber: number | null = null;
        let parentVariantIndex = 0;
        let parentPos: FlowNodePosition | null = null;
        let parentTurnMaxX: number | undefined = undefined;
        let primaryReferencePart: InlineImagePart | null = null;

        if (creationTab === "reference") {
          if (referenceCardInfo) {
            const parentRound =
              currentInteractions.find(
                (r) => r.turnNumber === referenceCardInfo.turnNumber
              ) || null;
            if (parentRound) {
              parentTurnNumber = parentRound.turnNumber;
              parentVariantIndex = referenceCardInfo.variantIndex;
              const pCardId = getFrameNodeId(
                parentRound.id,
                parentVariantIndex
              );
              parentPos = currentPositions[pCardId] || { x: 70, y: 60 };
              parentTurnMaxX = Math.max(
                ...parentRound.variants.map(
                  (_, vIdx) =>
                    currentPositions[getFrameNodeId(parentRound.id, vIdx)]?.x ??
                    parentPos!.x
                )
              );
            }
            if (referenceCardInfo.imageUrl) {
              primaryReferencePart =
                parseDataUrl(referenceCardInfo.imageUrl) ||
                (await imageUrlToInlinePart(referenceCardInfo.imageUrl));
            }
          } else if (uploadedReference?.dataUrl) {
            primaryReferencePart =
              parseDataUrl(uploadedReference.dataUrl) ||
              (await imageUrlToInlinePart(uploadedReference.dataUrl));

            if (!targetConvId) {
              const created = await createConversation({
                user_id: activeUser.id,
                title: projectTitle.trim() || "New Project",
                style_id: selectedStyleId,
              });
              targetConvId = created?.id || `conv_${Date.now()}`;
              setActiveProjectId(targetConvId);
            }

            // Persist 1-card Reference Image Origin Node on the Flow Canvas
            const originTurnNumber = currentInteractions.length + 1;
            const originPos = computeBatchBranchNodePositions(
              null,
              Object.values(currentPositions),
              1
            )[0];
            const originPromptDesc = `Reference image: ${
              uploadedReference.name || "Uploaded photo"
            }`;

            const savedOrigin = await saveConversationTurn(targetConvId, {
              user_id: activeUser.id,
              title: projectTitle.trim() || "New Project",
              parent_turn_number: null,
              role: "assistant",
              raw_idea: uploadedReference.name || "Reference Image",
              master_prompt: originPromptDesc,
              edit_instruction: "Reference Image",
              style_id: selectedStyleId,
              modifiers: [],
              completeness_score: 100,
              image_data_url: uploadedReference.dataUrl,
              aspect_ratio: selectedAspectRatio,
              model_used: model,
              variants: [
                {
                  label: "1 • Reference Image",
                  prompt: originPromptDesc,
                  image_data_url: uploadedReference.dataUrl,
                },
              ],
              selected_variant_index: 0,
            });

            const originImageUrl =
              savedOrigin?.variants?.[0]?.imageUrl ||
              savedOrigin?.image_url ||
              uploadedReference.dataUrl;

            const originRound: StudioInteractionRound = {
              id: savedOrigin?.id || `ref-origin-${Date.now()}`,
              turnNumber: originTurnNumber,
              parentTurnNumber: null,
              basePrompt: originPromptDesc,
              chosenPrompt: originPromptDesc,
              chosenImageUrl: originImageUrl,
              selectedVariantIndex: 0,
              aspectRatio: selectedAspectRatio,
              editInstruction: "Reference Image",
              variants: [
                {
                  label: "1 • Reference Image",
                  prompt: originPromptDesc,
                  imageUrl: originImageUrl,
                  mimeType: "image/png",
                  base64Data: "",
                },
              ],
            };

            const originCardId = getFrameNodeId(originRound.id, 0);
            currentPositions = {
              ...currentPositions,
              [originCardId]: originPos,
            };
            currentSnapshots = {
              ...currentSnapshots,
              [originTurnNumber]: {
                flowMode: "reference",
                aspectRatio: selectedAspectRatio,
                styleId: selectedStyleId,
                modifierIds: [],
                preservationLocks: { ...preservationLocks },
                imageCount: 1,
                enhanceWithAi: false,
                varyPromptsWithAi: false,
              },
            };
            currentInteractions = [...currentInteractions, originRound];

            setNodePositions(currentPositions);
            setSnapshotsByTurn(currentSnapshots);
            setInteractions(currentInteractions);
            setActiveInteractionIndex(currentInteractions.length - 1);

            parentTurnNumber = originTurnNumber;
            parentVariantIndex = 0;
            parentPos = originPos;
            parentTurnMaxX = originPos.x;
          }
        }

        const batchPositions = computeBatchBranchNodePositions(
          parentPos,
          Object.values(currentPositions),
          safeCount,
          parentTurnMaxX
        );

        setDraftStep({
          parentTurnNumber,
          parentVariantIndex,
          positions: batchPositions,
        });
        setLiveDraftSlots(
          preparedItems.map((it) => ({
            label: it.label,
            prompt: it.prompt,
            imageUrl: "",
            mimeType: "image/png",
            base64Data: "",
          }))
        );

        // Smoothly pan viewport so the newly generating cards are framed cleanly
        if (canvasViewportRef.current && batchPositions[0]) {
          const rect = canvasViewportRef.current.getBoundingClientRect();
          const zoom = canvasViewport.zoom;
          const focusX = parentPos
            ? (parentPos.x + batchPositions[0].x) / 2 + 120
            : batchPositions[0].x + 150;
          const desiredX = rect.width * 0.46 - focusX * zoom;
          const desiredY =
            rect.height * 0.36 - (batchPositions[0].y + 180) * zoom;
          setCanvasViewport((prev) => ({
            ...prev,
            x: Math.round(desiredX),
            y: Math.round(desiredY),
          }));
        }

        const parsedSeed =
          modelSeedInput.trim() !== "" &&
          Number.isFinite(Number(modelSeedInput))
            ? Math.round(Number(modelSeedInput))
            : null;
        const activeModelParams = {
          temperature: modelTemperature,
          topP: modelTopP,
          seed: parsedSeed,
        };

        const renderedSlots = await renderPreparedBatchWithNanoBanana({
          apiKey,
          model,
          items: preparedItems,
          referenceImage: primaryReferencePart,
          modelParams: activeModelParams,
          onSlotCompleted: (slotIdx, completedSlot) => {
            setLiveDraftSlots((prev) =>
              prev.map((item, idx) => (idx === slotIdx ? completedSlot : item))
            );
          },
        });

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

        const nextTurnNumber = currentInteractions.length + 1;
        const defaultChosen = renderedSlots[0];
        const effectiveFlowMode: CreationFlowMode =
          creationTab === "reference" ? "reference" : "prompt";
        const computedEditInstruction =
          creationTab === "reference"
            ? parentTurnNumber
              ? `With Reference (#${parentTurnNumber}.${
                  parentVariantIndex + 1
                })`
              : "With Reference Image"
            : "From Prompt";

        const savedTurn = await saveConversationTurn(targetConvId, {
          user_id: activeUser.id,
          title: projectTitle.trim() || "New Project",
          parent_turn_number: parentTurnNumber,
          role: "assistant",
          raw_idea: promptInput.trim() || rawCore,
          master_prompt: defaultChosen.prompt,
          edit_instruction: computedEditInstruction,
          style_id: selectedStyleId,
          modifiers: selectedModifiers,
          completeness_score: 95,
          image_data_url: defaultChosen.imageUrl || undefined,
          aspect_ratio: selectedAspectRatio,
          model_used: model,
          variants: renderedSlots.map((v) => ({
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
                imageUrl: v.imageUrl || renderedSlots[i]?.imageUrl || "",
                mimeType: "image/png",
                base64Data: "",
              }))
            : renderedSlots;

        const newRound: StudioInteractionRound = {
          id: savedTurn?.id || `int-${Date.now()}`,
          turnNumber: nextTurnNumber,
          parentTurnNumber,
          basePrompt: promptInput.trim() || rawCore,
          chosenPrompt: defaultChosen.prompt,
          chosenImageUrl:
            savedTurn?.image_url || persistedVariants[0]?.imageUrl || "",
          selectedVariantIndex: 0,
          aspectRatio: selectedAspectRatio,
          editInstruction: computedEditInstruction,
          variants: persistedVariants,
        };

        const nextPositions: Record<string, FlowNodePosition> = {
          ...currentPositions,
        };
        persistedVariants.forEach((_, vIdx) => {
          const frameId = getFrameNodeId(newRound.id, vIdx);
          nextPositions[frameId] = batchPositions[vIdx] || {
            x: batchPositions[0]?.x ?? 80,
            y: (batchPositions[0]?.y ?? 84) + vIdx * FLOW_VERTICAL_SPACING,
          };
        });

        currentParentVariants = {
          ...currentParentVariants,
          ...(parentTurnNumber !== null
            ? { [nextTurnNumber]: parentVariantIndex }
            : {}),
        };
        currentSnapshots = {
          ...currentSnapshots,
          [nextTurnNumber]: {
            flowMode: effectiveFlowMode,
            aspectRatio: selectedAspectRatio,
            styleId: selectedStyleId,
            modifierIds: [...selectedModifiers],
            preservationLocks: { ...preservationLocks },
            imageCount: safeCount,
            enhanceWithAi: enhancePromptWithAi,
            varyPromptsWithAi: safeCount > 1 && varyPromptsWithAi,
            modelUsed: model,
            modelParams: activeModelParams,
          },
        };

        const finalInteractions = [...currentInteractions, newRound];
        setNodePositions(nextPositions);
        setParentVariantByTurn(currentParentVariants);
        setSnapshotsByTurn(currentSnapshots);
        saveProjectFlowMeta(targetConvId, {
          positions: nextPositions,
          parentVariantByTurn: currentParentVariants,
          snapshotsByTurn: currentSnapshots,
        });

        setInteractions(finalInteractions);
        setActiveInteractionIndex(finalInteractions.length - 1);
        setDraftStep(null);
        setSelectedCanvasNodeId(getFrameNodeId(newRound.id, 0));

        const renderedCount = persistedVariants.filter((v) =>
          Boolean(v.imageUrl)
        ).length;
        if (!apiKey.trim()) {
          showTransientNotice(
            `✦ ${persistedVariants.length} blueprint ${
              persistedVariants.length === 1 ? "card" : "cards"
            } created! Add your Gemini API key in Settings to render PNGs.`
          );
        } else if (renderedCount > 0) {
          showTransientNotice(
            `✦ ${persistedVariants.length} ${
              persistedVariants.length === 1 ? "card" : "cards"
            } created for Step #${nextTurnNumber} (${renderedCount}/${
              persistedVariants.length
            } rendered)`
          );
        }
      } finally {
        setIsGenerating(false);
        setGenerationStage("idle");
        setLiveDraftSlots([]);
      }
    },
    [
      activeProjectId,
      activeUser.id,
      apiKey,
      canonicalDnaRef,
      canvasViewport.zoom,
      creationTab,
      enhancePromptWithAi,
      getActiveStyleAndModifierLabels,
      imageCount,
      interactions,
      isGenerating,
      model,
      modelSeedInput,
      modelTemperature,
      modelTopP,
      nodePositions,
      parentVariantByTurn,
      preservationLocks,
      projectTitle,
      promptInput,
      referenceCardInfo,
      selectedAspectRatio,
      selectedModifiers,
      selectedStyleId,
      setActiveProjectId,
      showTransientNotice,
      snapshotsByTurn,
      uploadedReference,
      varyPromptsWithAi,
    ]
  );

  // Step 1 Primary Button Handler (Automatic Step Skipping)
  const hasValidReferenceInTab2 =
    Boolean(uploadedReference?.dataUrl) || Boolean(referenceCardInfo);
  const canProceedFromStep1 =
    Boolean(promptInput.trim()) &&
    (creationTab === "prompt" || hasValidReferenceInTab2) &&
    !isGenerating &&
    !isPreparingStep2 &&
    !isPreparingStep3;

  const isStep2Enabled = enhancePromptWithAi;
  const isStep3Enabled = imageCount > 1 && varyPromptsWithAi;

  const handleStep1Submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canProceedFromStep1) return;

    if (isStep2Enabled) {
      await runEnhancePromptForStep2();
      return;
    }
    if (isStep3Enabled) {
      await runGenerateVariationsForStep3(promptInput.trim());
      return;
    }
    await executeBatchGeneration({
      finalPrompts: null,
      basePromptOverride: promptInput.trim(),
    });
  };

  const handleStep2Submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const approved = enhancedPromptDraft.trim() || promptInput.trim();
    if (!approved || isPreparingStep3 || isGenerating) return;

    if (isStep3Enabled) {
      await runGenerateVariationsForStep3(approved);
      return;
    }
    const safeCount = Math.max(1, Math.min(8, Math.round(imageCount || 1)));
    const exactReviewedPrompts: QuadPromptVariation[] = Array.from(
      { length: safeCount },
      (_, idx) => ({
        label:
          safeCount === 1
            ? "1 • Generated Frame"
            : `${idx + 1} • Frame #${idx + 1}`,
        prompt: approved,
      })
    );
    await executeBatchGeneration({
      finalPrompts: exactReviewedPrompts,
    });
  };

  const handleStep3Submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (variationDrafts.length === 0 || isGenerating) return;
    await executeBatchGeneration({
      finalPrompts: variationDrafts,
    });
  };

  // ==================== INSPECTOR SELECTION HELPERS ====================

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

  // Obstacle-aware orthogonal wire routing across all active canvas cards
  const flowObstacleNodes = useMemo<FlowObstacleNode[]>(() => {
    const list: FlowObstacleNode[] = [];
    interactions.forEach((round, roundIdx) => {
      round.variants.forEach((_, slotIdx) => {
        const cardId = getFrameNodeId(round.id, slotIdx);
        const pos = nodePositions[cardId] || {
          x: 80 + roundIdx * FLOW_HORIZONTAL_SPACING,
          y: 84 + slotIdx * FLOW_VERTICAL_SPACING,
        };
        list.push({ id: cardId, x: pos.x, y: pos.y });
      });
    });
    if (isGenerating && draftStep) {
      draftStep.positions.forEach((pos, draftIdx) => {
        list.push({ id: `draft::${draftIdx}`, x: pos.x, y: pos.y });
      });
    }
    return list;
  }, [draftStep, interactions, isGenerating, nodePositions]);

  const laneOffsetByParentCardId = useMemo<Record<string, number>>(() => {
    const parentsByColBucket = new Map<
      number,
      Array<{ cardId: string; y: number }>
    >();
    const seenParents = new Set<string>();

    interactions.forEach((round) => {
      if (!round.parentTurnNumber) return;
      const parentRound = interactions.find(
        (r) => r.turnNumber === round.parentTurnNumber
      );
      if (!parentRound) return;
      const parentVarIdx =
        parentVariantByTurn[round.turnNumber] ??
        parentRound.selectedVariantIndex ??
        0;
      const parentCardId = getFrameNodeId(parentRound.id, parentVarIdx);
      if (seenParents.has(parentCardId)) return;
      seenParents.add(parentCardId);

      const sourcePos = nodePositions[parentCardId] || {
        x: 80,
        y: 84 + parentVarIdx * FLOW_VERTICAL_SPACING,
      };
      const bucket = Math.round(sourcePos.x / 140);
      const arr = parentsByColBucket.get(bucket) || [];
      arr.push({ cardId: parentCardId, y: sourcePos.y });
      parentsByColBucket.set(bucket, arr);
    });

    const offsets: Record<string, number> = {};
    for (const group of parentsByColBucket.values()) {
      if (group.length <= 1) {
        if (group[0]) offsets[group[0].cardId] = 0;
        continue;
      }
      group.sort((a, b) => a.y - b.y);
      const kCount = group.length;
      group.forEach((item, idx) => {
        const raw = Math.round((idx - (kCount - 1) / 2) * 14);
        offsets[item.cardId] = Math.max(-28, Math.min(28, raw));
      });
    }
    return offsets;
  }, [interactions, nodePositions, parentVariantByTurn]);

  const lockedEdgeItems = useMemo(() => {
    return interactions.flatMap((round) => {
      if (!round.parentTurnNumber) return [];
      const parentRound = interactions.find(
        (r) => r.turnNumber === round.parentTurnNumber
      );
      if (!parentRound) return [];
      const parentVarIdx =
        parentVariantByTurn[round.turnNumber] ??
        parentRound.selectedVariantIndex ??
        0;
      const parentCardId = getFrameNodeId(parentRound.id, parentVarIdx);
      const sourcePos = nodePositions[parentCardId] || {
        x: 80,
        y: 84 + parentVarIdx * FLOW_VERTICAL_SPACING,
      };
      const laneOffset = laneOffsetByParentCardId[parentCardId] ?? 0;

      return round.variants.map((_, slotIdx) => {
        const childCardId = getFrameNodeId(round.id, slotIdx);
        const targetPos = nodePositions[childCardId] || {
          x: sourcePos.x + FLOW_HORIZONTAL_SPACING,
          y: 84 + slotIdx * FLOW_VERTICAL_SPACING,
        };
        const wire = buildStepBezierPath(sourcePos, targetPos, {
          obstacles: flowObstacleNodes,
          sourceId: parentCardId,
          targetId: childCardId,
          laneOffset,
        });
        return {
          key: `edge-${parentCardId}-${childCardId}`,
          parentCardId,
          childCardId,
          wire,
        };
      });
    });
  }, [
    flowObstacleNodes,
    interactions,
    laneOffsetByParentCardId,
    nodePositions,
    parentVariantByTurn,
  ]);

  const draftEdgeItems = useMemo(() => {
    if (!isGenerating || !draftStep || !draftParentRound) return [];
    const parentCardId = getFrameNodeId(
      draftParentRound.id,
      draftStep.parentVariantIndex
    );
    const sourcePos = nodePositions[parentCardId] || {
      x: 80,
      y: 84,
    };
    return draftStep.positions.map((targetPos, draftIdx) => {
      const draftCardId = `draft::${draftIdx}`;
      const wire = buildStepBezierPath(sourcePos, targetPos, {
        obstacles: flowObstacleNodes,
        sourceId: parentCardId,
        targetId: draftCardId,
        laneOffset: laneOffsetByParentCardId[parentCardId] ?? 0,
      });
      return {
        key: `edge-draft-active-${draftIdx}`,
        wire,
      };
    });
  }, [
    draftParentRound,
    draftStep,
    flowObstacleNodes,
    isGenerating,
    laneOffsetByParentCardId,
    nodePositions,
  ]);

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

  // ==================== SHARED SUB-SECTIONS INSIDE CREATION STEP 1 ====================

  const renderEnhancePromptToggle = (switchId: string) => (
    <div className="ref-toggle-switch-row">
      <div className="ref-toggle-switch-copy">
        <label htmlFor={switchId} className="ref-toggle-switch-title">
          Enhance prompt with AI
        </label>
        <span className="ref-toggle-switch-sub">
          Review an AI-refined scene prompt in Step 2 before generating
        </span>
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={enhancePromptWithAi}
        className={`ref-atelier-switch ${enhancePromptWithAi ? "is-on" : ""}`}
        onClick={() => setEnhancePromptWithAi((prev) => !prev)}
      >
        <span className="ref-atelier-switch-thumb" />
      </button>
    </div>
  );

  const renderStyleAndModifiersSection = () => (
    <div className="ref-creation-modifiers-stack">
      <div className="ref-params-field-group">
        <div className="ref-studio-label-row">
          <span className="ref-field-label">Frame Aspect Ratio</span>
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

      <div className="ref-studio-param-deck-container">
        <div
          className="ref-studio-param-tabs two-cols"
          role="tablist"
          aria-label="Modifiers and Model Parameters"
        >
          <button
            type="button"
            id="param-tab-modifiers"
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

          <button
            type="button"
            id="param-tab-model"
            role="tab"
            aria-selected={activeParamTab === "model"}
            className={`ref-studio-param-tab ${
              activeParamTab === "model" ? "active" : ""
            }`}
            onClick={() => setActiveParamTab("model")}
          >
            <span className="ref-studio-param-tab-title">
              Model & Parameters
            </span>
            <span className="ref-studio-param-tab-value">
              {model === "gemini-3-pro-image-preview"
                ? "Gemini 3 Pro"
                : model === "gemini-2.0-flash-exp-image-generation"
                ? "Gemini 2.0 Exp"
                : "Nano Banana 2.5"}{" "}
              • T:{modelTemperature.toFixed(1)}
            </span>
          </button>
        </div>

        <div className="ref-studio-param-tab-panel" role="tabpanel">
          {activeParamTab === "modifiers" ? (
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
                        : bootstrapData.modifier_categories[0]?.id) === cat.id;
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

                <Link href="/modifiers" className="ref-studio-inline-link-btn">
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
                      className={`ref-pill-chip ${active ? "active" : ""}`}
                      onClick={() => handleToggleModifier(opt.id)}
                      title={opt.token}
                    >
                      {opt.label.split(" (")[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="ref-studio-tab-section ref-model-params-panel">
              {/* 1. MODEL SELECTOR */}
              <div className="ref-params-field-group">
                <span className="ref-field-label">Select Model</span>
                <div
                  className="ref-model-selector-list"
                  role="radiogroup"
                  aria-label="Image Generation Model"
                >
                  {[
                    {
                      id: "gemini-2.5-flash-image" as NanoBananaModel,
                      title: "Nano Banana • Gemini 2.5 Flash Image",
                      sub: "gemini-2.5-flash-image • Fast multimodal studio generation",
                    },
                    {
                      id: "gemini-3-pro-image-preview" as NanoBananaModel,
                      title: "Nano Banana Pro • Gemini 3 Pro Image",
                      sub: "gemini-3-pro-image-preview • High-fidelity rendering",
                    },
                    {
                      id: "gemini-2.0-flash-exp-image-generation" as NanoBananaModel,
                      title: "Gemini 2.0 Flash Image (Exp)",
                      sub: "gemini-2.0-flash-exp-image-generation • Experimental",
                    },
                  ].map((mOpt) => (
                    <button
                      key={mOpt.id}
                      id={`model-opt-${mOpt.id}`}
                      type="button"
                      role="radio"
                      aria-checked={model === mOpt.id}
                      className={`ref-studio-grid-option ref-model-option-btn ${
                        model === mOpt.id ? "active" : ""
                      }`}
                      onClick={() => setModel(mOpt.id)}
                    >
                      <strong className="ref-studio-grid-option-title">
                        {mOpt.title}
                      </strong>
                      <span className="ref-studio-grid-option-sub">
                        {mOpt.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. MODEL GENERATION PARAMETERS (TEMPERATURE, TOP-P, SEED) */}
              <div className="ref-model-sliders-grid">
                <div className="ref-model-param-control">
                  <div className="ref-studio-label-row">
                    <label
                      htmlFor="model-param-temperature"
                      className="ref-field-label ref-no-margin"
                    >
                      Temperature
                    </label>
                    <span className="ref-studio-ratio-readout">
                      {modelTemperature.toFixed(2)}
                    </span>
                  </div>
                  <input
                    id="model-param-temperature"
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={modelTemperature}
                    style={
                      {
                        "--slider-pct": `${Math.round(
                          (modelTemperature / 2) * 100
                        )}%`,
                      } as React.CSSProperties
                    }
                    onChange={(e) =>
                      setModelTemperature(Number(e.target.value))
                    }
                    className="ref-atelier-range-slider"
                  />
                </div>

                <div className="ref-model-param-control">
                  <div className="ref-studio-label-row">
                    <label
                      htmlFor="model-param-top-p"
                      className="ref-field-label ref-no-margin"
                    >
                      Top P
                    </label>
                    <span className="ref-studio-ratio-readout">
                      {modelTopP.toFixed(2)}
                    </span>
                  </div>
                  <input
                    id="model-param-top-p"
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={modelTopP}
                    style={
                      {
                        "--slider-pct": `${Math.round(
                          ((modelTopP - 0.1) / 0.9) * 100
                        )}%`,
                      } as React.CSSProperties
                    }
                    onChange={(e) => setModelTopP(Number(e.target.value))}
                    className="ref-atelier-range-slider"
                  />
                </div>
              </div>

              <div className="ref-model-seed-row">
                <div className="ref-model-seed-field">
                  <label
                    htmlFor="model-param-seed"
                    className="ref-field-label ref-no-margin"
                  >
                    Seed (Optional)
                  </label>
                  <div className="ref-model-seed-inputs">
                    <input
                      id="model-param-seed"
                      type="number"
                      className="ref-input ref-model-seed-input"
                      value={modelSeedInput}
                      onChange={(e) => setModelSeedInput(e.target.value)}
                      placeholder="Random seed"
                    />
                    <button
                      type="button"
                      className="ref-pill-chip"
                      onClick={() =>
                        setModelSeedInput(
                          String(Math.floor(100000 + Math.random() * 900000))
                        )
                      }
                    >
                      Randomize
                    </button>
                    {modelSeedInput && (
                      <button
                        type="button"
                        className="ref-pill-chip"
                        onClick={() => setModelSeedInput("")}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const activeReferencePreviewUrl =
    uploadedReference?.dataUrl || referenceCardInfo?.imageUrl || "";
  const activeReferenceSourceLabel = uploadedReference
    ? uploadedReference.name
    : referenceCardInfo
    ? `${referenceCardInfo.label} Reference`
    : "";

  const isInspectingLockedCard =
    selectedCanvasNodeId !== "draft" && Boolean(selectedLockedRound);

  return (
    <div className="ref-page-container">
      <input
        ref={fileUploadInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="ref-sr-only-file-input"
        onChange={handleUploadReferenceFile}
      />

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
                onClick={openCreationModalAsNewRoot}
                disabled={isGenerating}
                title="Open creation modal to add a new step"
              >
                <IconPlus size={11} strokeWidth={2.3} />
                <span>New Step</span>
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
                        0.18,
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

          {statusNotice && (
            <div className="ref-flow-floating-toast" role="status">
              <span className="ref-atelier-toast-pill">{statusNotice}</span>
            </div>
          )}

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
                target.closest(".ref-flow-starter-plus-wrapper") ||
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
                    Math.max(0.18, Number((prev.zoom + delta).toFixed(2)))
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
              {/* 1. SVG ORTHOGONAL WIRES LAYER */}
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
                    <path d="M0,0 L9,4.5 L0,9 Z" fill="var(--ref-moss-outer)" />
                  </marker>
                  <marker
                    id="flow-arrow-draft"
                    markerWidth="9"
                    markerHeight="9"
                    refX="7"
                    refY="4.5"
                    orient="auto"
                  >
                    <path
                      d="M0,0 L9,4.5 L0,9 Z"
                      fill="var(--ref-lime-accent)"
                    />
                  </marker>
                </defs>

                {(() => {
                  const byParent = new Map<
                    string,
                    typeof lockedEdgeItems
                  >();
                  for (const edge of lockedEdgeItems) {
                    const list = byParent.get(edge.parentCardId) || [];
                    list.push(edge);
                    byParent.set(edge.parentCardId, list);
                  }

                  const groups = Array.from(byParent.entries()).sort(
                    ([, listA], [, listB]) => {
                      const aHi = listA.some(
                        (e) =>
                          selectedCanvasNodeId === e.parentCardId ||
                          selectedCanvasNodeId === e.childCardId
                      )
                        ? 1
                        : 0;
                      const bHi = listB.some(
                        (e) =>
                          selectedCanvasNodeId === e.parentCardId ||
                          selectedCanvasNodeId === e.childCardId
                      )
                        ? 1
                        : 0;
                      return aHi - bHi;
                    }
                  );

                  return groups.map(([parentCardId, edges]) => {
                    const orderedEdges = [...edges].sort((a, b) => {
                      const aHi =
                        selectedCanvasNodeId === a.childCardId ||
                        selectedCanvasNodeId === a.parentCardId
                          ? 1
                          : 0;
                      const bHi =
                        selectedCanvasNodeId === b.childCardId ||
                        selectedCanvasNodeId === b.parentCardId
                          ? 1
                          : 0;
                      return aHi - bHi;
                    });
                    const anchor = orderedEdges[0]?.wire;

                    return (
                      <g key={`fanout-${parentCardId}`}>
                        {orderedEdges.map(({ key, parentCardId: pId, childCardId, wire }) => {
                          const isHighlighted =
                            selectedCanvasNodeId === childCardId ||
                            selectedCanvasNodeId === pId;
                          return (
                            <path
                              key={`${key}-bridge`}
                              d={wire.path}
                              fill="none"
                              stroke="var(--ref-canvas)"
                              strokeWidth={isHighlighted ? "6.5" : "5.5"}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          );
                        })}
                        {orderedEdges.map(({ key, parentCardId: pId, childCardId, wire }) => {
                          const isHighlighted =
                            selectedCanvasNodeId === childCardId ||
                            selectedCanvasNodeId === pId;
                          return (
                            <path
                              key={key}
                              data-flow-wire="main"
                              d={wire.path}
                              fill="none"
                              stroke={
                                isHighlighted
                                  ? "var(--ref-lime-accent)"
                                  : "var(--ref-moss-outer)"
                              }
                              strokeWidth={isHighlighted ? "3" : "2.2"}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              markerEnd={
                                isHighlighted
                                  ? "url(#flow-arrow-draft)"
                                  : "url(#flow-arrow-locked)"
                              }
                            />
                          );
                        })}
                        {anchor && (
                          <circle
                            cx={anchor.startX}
                            cy={anchor.startY}
                            r="4.5"
                            fill="var(--ref-lime-accent)"
                            stroke="var(--ref-moss-outer)"
                            strokeWidth="1.8"
                          />
                        )}
                      </g>
                    );
                  });
                })()}

                {draftEdgeItems.length > 0 && (
                  <g key="fanout-draft-active">
                    {draftEdgeItems.map(({ key, wire }) => (
                      <path
                        key={`${key}-bridge`}
                        d={wire.path}
                        fill="none"
                        stroke="var(--ref-canvas)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                    {draftEdgeItems.map(({ key, wire }) => (
                      <path
                        key={key}
                        data-flow-wire="draft"
                        d={wire.path}
                        fill="none"
                        stroke="var(--ref-lime-accent)"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="7 5"
                        markerEnd="url(#flow-arrow-draft)"
                      />
                    ))}
                    <circle
                      cx={draftEdgeItems[0].wire.startX}
                      cy={draftEdgeItems[0].wire.startY}
                      r="5"
                      fill="var(--ref-lime-accent)"
                      stroke="var(--ref-ink-primary)"
                      strokeWidth="1.8"
                    />
                  </g>
                )}
              </svg>

              {/* 2. COMPLETED IMMUTABLE IMAGE CARDS */}
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
                    x: 80 + roundIdx * FLOW_HORIZONTAL_SPACING,
                    y: 84 + slotIdx * FLOW_VERTICAL_SPACING,
                  };
                  const isNodeSelected = selectedCanvasNodeId === cardId;
                  const cleanVariantTitle =
                    slot?.label
                      ?.replace(/^[0-9]+\s*•\s*/, "")
                      .split(" (")[0] || `Image #${slotIdx + 1}`;
                  const isReferenceOriginCard =
                    round.editInstruction === "Reference Image";

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
                      {round.parentTurnNumber !== null && (
                        <span
                          className="ref-flow-port input-port"
                          title={`Branched from Card #${
                            round.parentTurnNumber
                          }.${parentVarIdx + 1}`}
                        />
                      )}

                      {/* Right n8n '+' Output Port Button (Opens Creation Modal on Tab 2 with THIS card as reference) */}
                      <button
                        type="button"
                        className="ref-flow-port output-port-btn"
                        disabled={isGenerating}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartBranchFromNode(round, slotIdx);
                        }}
                        title={`Create new step using Card #${
                          round.turnNumber
                        }.${slotIdx + 1} as reference image`}
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
                            #{round.turnNumber}.{slotIdx + 1}
                          </span>
                          <span className="ref-flow-step-ratio">
                            {round.aspectRatio}
                          </span>
                          <span
                            className="ref-flow-step-meta-chip"
                            title={cleanVariantTitle}
                          >
                            {isReferenceOriginCard
                              ? "Reference"
                              : styleTitle || cleanVariantTitle}
                          </span>
                        </div>
                      </div>

                      {/* Single Image Stage */}
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
                                title="Expand image in full screen"
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
                                title="Pin this card as Canonical Character DNA"
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

                      {/* 1-Line Prompt Footer (Click to open read-only Inspector Modal) */}
                      <button
                        type="button"
                        className="ref-flow-node-footer-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveInteractionIndex(roundIdx);
                          setSelectedCanvasNodeId(cardId);
                          setIsStepModalOpen(true);
                        }}
                        title="Click to inspect this card's prompt & parameters"
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

              {/* 3. LIVE GENERATING 1..8 IMAGE CARDS */}
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
                            #{nextTurnNum}.{draftIdx + 1}
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
                              {liveSlot?.label || `Frame #${draftIdx + 1}`}
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

              {/* 4. MINIMALIST '+' STARTER FLOW ITEM WHEN PROJECT IS EMPTY */}
              {!isGenerating && interactions.length === 0 && (
                <div
                  className="ref-flow-starter-plus-wrapper"
                  style={{
                    left: `${draftStep?.positions[0]?.x ?? 140}px`,
                    top: `${draftStep?.positions[0]?.y ?? 140}px`,
                  }}
                >
                  <button
                    type="button"
                    id="flow-starter-plus-btn"
                    className="ref-flow-starter-plus-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCreationModalAsNewRoot();
                    }}
                    title="Start creation flow"
                    aria-label="Start creation flow"
                  >
                    <IconPlus size={24} strokeWidth={2.4} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ==================== UNIFIED 3-STEP CREATION MODAL & CARD INSPECTOR MODAL ==================== */}
      {isStepModalOpen && (
        <div
          className="ref-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={
            isInspectingLockedCard
              ? "Card Inspector Modal"
              : "Creation Flow Wizard Modal"
          }
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsStepModalOpen(false);
          }}
        >
          <div className="ref-wizard-modal-stack">
            {/* STEPPER CONTROL ABOVE THE MODAL SCREEN (Shown during Creation Mode) */}
            {!isInspectingLockedCard && (
              <nav
                className="ref-wizard-stepper-bar"
                aria-label="Creation Wizard Steps"
              >
                {/* Step 01 */}
                <button
                  type="button"
                  className={`ref-wizard-step-pill ${
                    wizardStep === 1
                      ? "is-active"
                      : wizardStep > 1
                      ? "is-completed"
                      : ""
                  }`}
                  onClick={() => setWizardStep(1)}
                >
                  <span className="ref-wizard-step-index">
                    {wizardStep > 1 ? <IconCheck size={11} /> : "01"}
                  </span>
                  <span className="ref-wizard-step-label">Configure</span>
                </button>

                <span
                  className={`ref-wizard-step-connector ${
                    wizardStep > 1 ? "is-lit" : ""
                  }`}
                  aria-hidden="true"
                />

                {/* Step 02 (AI Prompt Enhancement) */}
                <button
                  type="button"
                  disabled={!isStep2Enabled || !canProceedFromStep1}
                  className={`ref-wizard-step-pill ${
                    !isStep2Enabled
                      ? "is-skipped"
                      : wizardStep === 2
                      ? "is-active"
                      : wizardStep === 3
                      ? "is-completed"
                      : ""
                  }`}
                  onClick={() => {
                    if (!isStep2Enabled) return;
                    if (wizardStep === 3) {
                      setWizardStep(2);
                    } else if (wizardStep === 1 && canProceedFromStep1) {
                      void runEnhancePromptForStep2();
                    }
                  }}
                >
                  <span className="ref-wizard-step-index">
                    {isStep2Enabled && wizardStep === 3 ? (
                      <IconCheck size={11} />
                    ) : (
                      "02"
                    )}
                  </span>
                  <span className="ref-wizard-step-label">Enhance Prompt</span>
                  {!isStep2Enabled && (
                    <span className="ref-wizard-step-skip-tag">Skipped</span>
                  )}
                </button>

                <span
                  className={`ref-wizard-step-connector ${
                    wizardStep === 3 ? "is-lit" : ""
                  }`}
                  aria-hidden="true"
                />

                {/* Step 03 (Review AI Variations) */}
                <button
                  type="button"
                  disabled={!isStep3Enabled || !canProceedFromStep1}
                  className={`ref-wizard-step-pill ${
                    !isStep3Enabled
                      ? "is-skipped"
                      : wizardStep === 3
                      ? "is-active"
                      : ""
                  }`}
                  onClick={() => {
                    if (!isStep3Enabled || !canProceedFromStep1) return;
                    if (wizardStep === 3) return;
                    const src =
                      isStep2Enabled && enhancedPromptDraft.trim()
                        ? enhancedPromptDraft.trim()
                        : promptInput.trim();
                    void runGenerateVariationsForStep3(src);
                  }}
                >
                  <span className="ref-wizard-step-index">03</span>
                  <span className="ref-wizard-step-label">AI Variations</span>
                  {!isStep3Enabled && (
                    <span className="ref-wizard-step-skip-tag">Skipped</span>
                  )}
                </button>
              </nav>
            )}

            {/* MAIN MODAL CARD */}
            <div className="ref-flow-step-modal-card">
              <div className="ref-modal-header">
                <strong className="ref-soft-card-title">
                  {isInspectingLockedCard && selectedLockedRound
                    ? `Inspect Card #${selectedLockedRound.turnNumber}.${
                        selectedLockedVariantIdx + 1
                      }`
                    : wizardStep === 1
                    ? "Step 01 • Configure Creation"
                    : wizardStep === 2
                    ? "Step 02 • Review AI-Enhanced Prompt"
                    : `Step 03 • Review ${imageCount} AI Prompt Variations`}
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
                {isInspectingLockedCard && selectedLockedRound ? (
                  /* ==================== READ-ONLY CARD INSPECTOR ==================== */
                  <div className="ref-params-card ref-params-deck">
                    <div className="ref-params-card-header">
                      <div className="ref-inspector-badges-row">
                        <span className="ref-flow-step-badge locked">
                          Card #{selectedLockedRound.turnNumber}.
                          {selectedLockedVariantIdx + 1} (Immutable)
                        </span>
                        {selectedLockedRound.parentTurnNumber && (
                          <span className="ref-pill-chip">
                            Branched from Card #
                            {selectedLockedRound.parentTurnNumber}.
                            {(parentVariantByTurn[
                              selectedLockedRound.turnNumber
                            ] ?? 0) + 1}
                          </span>
                        )}
                      </div>
                      <span className="ref-studio-ratio-readout">
                        {selectedLockedRound.aspectRatio}
                      </span>
                    </div>

                    <div className="ref-flow-inspector-body">
                      {selectedLockedSlot?.imageUrl && (
                        <div className="ref-flow-hero-frame ref-inspector-hero-preview">
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
                          Recorded Prompt (Card #{selectedLockedRound.turnNumber}
                          .{selectedLockedVariantIdx + 1}):
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
                            const styleObj =
                              snap.styleId && snap.styleId !== "none"
                                ? bootstrapData.style_presets.find(
                                    (s) => s.id === snap.styleId
                                  )
                                : undefined;
                            const allMods =
                              bootstrapData.modifier_categories.flatMap(
                                (c) => c.options
                              );
                            return (
                              <>
                                {snap.modelUsed && (
                                  <span className="ref-pill-chip">
                                    Model: {snap.modelUsed}
                                  </span>
                                )}
                                {snap.modelParams && (
                                  <span className="ref-pill-chip">
                                    Temp {snap.modelParams.temperature.toFixed(2)} • Top-P {snap.modelParams.topP.toFixed(2)}
                                    {snap.modelParams.seed !== undefined && snap.modelParams.seed !== null
                                      ? ` • Seed ${snap.modelParams.seed}`
                                      : ""}
                                  </span>
                                )}
                                {styleObj && (
                                  <span className="ref-pill-chip">
                                    {styleObj.title.split(" (")[0]}
                                  </span>
                                )}
                                {snap.modifierIds.map((mId) => {
                                  const found = allMods.find(
                                    (o) => o.id === mId
                                  );
                                  return found ? (
                                    <span key={mId} className="ref-pill-chip">
                                      {found.label.split(" (")[0]}
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
                          Continue Flow from Card #
                          {selectedLockedRound.turnNumber}.
                          {selectedLockedVariantIdx + 1}:
                        </span>
                        <div className="ref-inspector-cta-actions">
                          <button
                            type="button"
                            className="ref-dark-pill-btn"
                            onClick={() =>
                              handleStartBranchFromNode(
                                selectedLockedRound,
                                selectedLockedVariantIdx
                              )
                            }
                          >
                            <IconUploadImage size={14} />
                            <span>Branch with Reference Image</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : wizardStep === 1 ? (
                  /* ==================== STEP 01: CONFIGURE CREATION (2 TABS + SLIDER 1..8 + 2 AI TOGGLES) ==================== */
                  <form
                    className="ref-flow-create-modal-form"
                    onSubmit={handleStep1Submit}
                  >
                    {/* 2-Tab Mode Bar */}
                    <div
                      className="ref-creation-tabs-bar"
                      role="tablist"
                      aria-label="Creation Mode"
                    >
                      <button
                        type="button"
                        id="creation-tab-prompt"
                        role="tab"
                        aria-selected={creationTab === "prompt"}
                        className={`ref-creation-tab-btn ${
                          creationTab === "prompt" ? "active" : ""
                        }`}
                        onClick={() => setCreationTab("prompt")}
                      >
                        <IconPromptText size={15} />
                        <span>From Prompt</span>
                      </button>
                      <button
                        type="button"
                        id="creation-tab-reference"
                        role="tab"
                        aria-selected={creationTab === "reference"}
                        className={`ref-creation-tab-btn ${
                          creationTab === "reference" ? "active" : ""
                        }`}
                        onClick={() => setCreationTab("reference")}
                      >
                        <IconUploadImage size={15} />
                        <span>With Reference Image</span>
                      </button>
                    </div>

                    {!apiKey.trim() && (
                      <div className="ref-studio-apikey-banner" role="status">
                        <span className="ref-studio-apikey-banner-text">
                          <strong>Blueprint Mode:</strong> Add a Gemini API key
                          to render live PNG images.
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

                    {creationTab === "prompt" ? (
                      /* ---------- TAB 1: FROM PROMPT (LEFT = PROMPT + TOGGLE 1, RIGHT = MODIFIERS) ---------- */
                      <div className="ref-creation-two-col">
                        <div className="ref-params-card ref-creation-col-pane">
                          <div className="ref-studio-prompt-editor-group">
                            <div className="ref-studio-label-row">
                              <label
                                className="ref-field-label"
                                htmlFor="studio-master-prompt"
                              >
                                What do you want to generate?
                              </label>
                              <button
                                type="button"
                                className="ref-studio-hints-toggle"
                                aria-expanded={showPromptHints}
                                onClick={() =>
                                  setShowPromptHints((prev) => !prev)
                                }
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
                              className="ref-params-textarea ref-creation-prompt-box"
                              value={promptInput}
                              onChange={(e) => setPromptInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (
                                  (e.ctrlKey || e.metaKey) &&
                                  e.key === "Enter"
                                ) {
                                  e.preventDefault();
                                  void handleStep1Submit();
                                }
                              }}
                              placeholder="Describe your scene, subject, lighting, and atmosphere..."
                            />

                            {/* TOGGLE SWITCH #1: Directly below prompt textarea */}
                            {renderEnhancePromptToggle(
                              "toggle-enhance-prompt-ai"
                            )}

                            {showPromptHints && (
                              <div className="ref-studio-pillars-bar">
                                <div className="ref-studio-delta-chips-row">
                                  {PROMPT_COMPLETENESS_PILLARS.map((pillar) => {
                                    const isDetected =
                                      pillar.regex.test(promptInput);
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
                                            prev === pillar.id
                                              ? null
                                              : pillar.id
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
                        </div>

                        <div className="ref-params-card ref-params-deck ref-creation-col-pane">
                          {renderStyleAndModifiersSection()}
                        </div>
                      </div>
                    ) : (
                      /* ---------- TAB 2: WITH REFERENCE IMAGE (LEFT = PHOTO UPLOAD, RIGHT = PROMPT + TOGGLE 1 + MODIFIERS) ---------- */
                      <div className="ref-creation-two-col">
                        {/* Left Division: Reference Image Dropzone / Preview + Preservation Locks */}
                        <div className="ref-params-card ref-creation-col-pane">
                          <div className="ref-studio-label-row">
                            <span className="ref-field-label">
                              Reference Image
                            </span>
                            {activeReferenceSourceLabel && (
                              <span className="ref-studio-ratio-readout">
                                {activeReferenceSourceLabel}
                              </span>
                            )}
                          </div>

                          {activeReferencePreviewUrl ? (
                            <div className="ref-refimage-preview-stage">
                              <img
                                src={activeReferencePreviewUrl}
                                alt={activeReferenceSourceLabel}
                                className="ref-refimage-preview-img"
                              />
                              <div className="ref-refimage-preview-actions">
                                <button
                                  type="button"
                                  className="ref-studio-ghost-action"
                                  onClick={() =>
                                    fileUploadInputRef.current?.click()
                                  }
                                >
                                  <IconUploadImage size={13} />
                                  <span>Replace Photo</span>
                                </button>
                                <button
                                  type="button"
                                  className="ref-studio-ghost-action"
                                  onClick={() => {
                                    setUploadedReference(null);
                                    setReferenceCardInfo(null);
                                  }}
                                >
                                  <IconClose size={11} />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                          ) : referenceCardInfo ? (
                            <div className="ref-refimage-preview-stage is-blueprint-ref">
                              <div className="ref-flow-slot-blueprint">
                                <strong>
                                  {referenceCardInfo.label} Linked
                                </strong>
                                <span>
                                  Blueprint reference card selected from canvas
                                </span>
                              </div>
                              <div className="ref-refimage-preview-actions">
                                <button
                                  type="button"
                                  className="ref-studio-ghost-action"
                                  onClick={() =>
                                    fileUploadInputRef.current?.click()
                                  }
                                >
                                  <IconUploadImage size={13} />
                                  <span>Upload Photo Instead</span>
                                </button>
                                <button
                                  type="button"
                                  className="ref-studio-ghost-action"
                                  onClick={() => setReferenceCardInfo(null)}
                                >
                                  <IconClose size={11} />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              id="refimage-dropzone-btn"
                              className={`ref-refimage-dropzone ${
                                isDraggingOverDropzone ? "is-dragover" : ""
                              }`}
                              onClick={() =>
                                fileUploadInputRef.current?.click()
                              }
                              onDragOver={(e) => {
                                e.preventDefault();
                                setIsDraggingOverDropzone(true);
                              }}
                              onDragLeave={() =>
                                setIsDraggingOverDropzone(false)
                              }
                              onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingOverDropzone(false);
                                const file = e.dataTransfer.files?.[0];
                                if (file) readImageFileIntoTab2(file);
                              }}
                            >
                              <span className="ref-refimage-dropzone-icon">
                                <IconUploadImage size={26} strokeWidth={1.8} />
                              </span>
                              <strong className="ref-refimage-dropzone-title">
                                Add a reference photo
                              </strong>
                              <span className="ref-refimage-dropzone-sub">
                                Click to browse, drag & drop, or paste with
                                Ctrl+V (PNG, JPG, WebP)
                              </span>
                            </button>
                          )}

                          <div className="ref-studio-locks-row ref-refimage-locks-bar">
                            <span className="ref-studio-locks-label">
                              Preserve:
                            </span>
                            <button
                              type="button"
                              aria-pressed={preservationLocks.keepCharacter}
                              className={`ref-studio-lock-chip ${
                                preservationLocks.keepCharacter ? "locked" : ""
                              }`}
                              onClick={() => handleToggleLock("keepCharacter")}
                            >
                              {preservationLocks.keepCharacter ? "✓ " : ""}
                              Character
                            </button>
                            <button
                              type="button"
                              aria-pressed={preservationLocks.keepPose}
                              className={`ref-studio-lock-chip ${
                                preservationLocks.keepPose ? "locked" : ""
                              }`}
                              onClick={() => handleToggleLock("keepPose")}
                            >
                              {preservationLocks.keepPose ? "✓ " : ""}
                              Pose
                            </button>
                            <button
                              type="button"
                              aria-pressed={preservationLocks.keepBackground}
                              className={`ref-studio-lock-chip ${
                                preservationLocks.keepBackground ? "locked" : ""
                              }`}
                              onClick={() =>
                                handleToggleLock("keepBackground")
                              }
                            >
                              {preservationLocks.keepBackground ? "✓ " : ""}
                              Background
                            </button>
                          </div>
                        </div>

                        {/* Right Division: Prompt + Toggle 1 + Modifiers */}
                        <div className="ref-params-card ref-params-deck ref-creation-col-pane ref-tab2-right-pane">
                          <div className="ref-tab2-prompt-block">
                            <div className="ref-studio-label-row">
                              <label
                                className="ref-field-label"
                                htmlFor="studio-reference-prompt"
                              >
                                Prompt for Reference Generation
                              </label>
                              {referenceCardInfo?.prompt && (
                                <button
                                  type="button"
                                  className="ref-studio-inline-link-btn"
                                  onClick={() =>
                                    setPromptInput(referenceCardInfo.prompt)
                                  }
                                >
                                  Load card prompt ↗
                                </button>
                              )}
                            </div>

                            <textarea
                              id="studio-reference-prompt"
                              className="ref-params-textarea ref-tab2-prompt-textarea"
                              value={promptInput}
                              onChange={(e) => setPromptInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (
                                  (e.ctrlKey || e.metaKey) &&
                                  e.key === "Enter"
                                ) {
                                  e.preventDefault();
                                  void handleStep1Submit();
                                }
                              }}
                              placeholder="Describe how to transform, stage, or restyle this reference image..."
                            />

                            {/* TOGGLE SWITCH #1: Directly below prompt textarea */}
                            {renderEnhancePromptToggle(
                              "toggle-enhance-prompt-ai-ref"
                            )}
                          </div>

                          <div className="ref-tab2-modifiers-divider" />

                          {renderStyleAndModifiersSection()}
                        </div>
                      </div>
                    )}

                    {/* SHARED FOOTER OF STEP 1: SLIDER (1..8) + TOGGLE SWITCH #2 BELOW SLIDER + PRIMARY ACTION */}
                    <div className="ref-creation-step1-footer">
                      <div className="ref-slider-footer-block">
                        <div className="ref-slider-header-row">
                          <label
                            htmlFor="creation-image-count-slider"
                            className="ref-slider-question-label"
                          >
                            How many images should be generated?
                          </label>
                          <span className="ref-slider-count-badge">
                            {imageCount}{" "}
                            {imageCount === 1 ? "image" : "images"}
                          </span>
                        </div>

                        <div className="ref-slider-track-wrap">
                          <input
                            id="creation-image-count-slider"
                            type="range"
                            min={1}
                            max={8}
                            step={1}
                            value={imageCount}
                            style={
                              {
                                "--slider-pct": `${Math.round(
                                  ((imageCount - 1) / 7) * 100
                                )}%`,
                              } as React.CSSProperties
                            }
                            onChange={(e) =>
                              setImageCount(Number(e.target.value))
                            }
                            className="ref-atelier-range-slider"
                          />
                          <div
                            className="ref-slider-ticks-row"
                            aria-hidden="true"
                          >
                            {IMAGE_COUNT_TICKS.map((n) => (
                              <button
                                key={n}
                                type="button"
                                tabIndex={-1}
                                className={`ref-slider-tick-btn ${
                                  imageCount === n ? "active" : ""
                                }`}
                                onClick={() => setImageCount(n)}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* TOGGLE SWITCH #2: Directly below slider when imageCount > 1 */}
                        {imageCount > 1 && (
                          <div className="ref-toggle-switch-row ref-slider-vary-toggle">
                            <div className="ref-toggle-switch-copy">
                              <label
                                htmlFor="toggle-vary-prompts-ai"
                                className="ref-toggle-switch-title"
                              >
                                Vary prompt using AI
                              </label>
                              <span className="ref-toggle-switch-sub">
                                Generate {imageCount} distinct AI prompt
                                variations and review them in Step 3
                              </span>
                            </div>
                            <button
                              id="toggle-vary-prompts-ai"
                              type="button"
                              role="switch"
                              aria-checked={varyPromptsWithAi}
                              className={`ref-atelier-switch ${
                                varyPromptsWithAi ? "is-on" : ""
                              }`}
                              onClick={() =>
                                setVaryPromptsWithAi((prev) => !prev)
                              }
                            >
                              <span className="ref-atelier-switch-thumb" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="ref-wizard-footer-actions">
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
                          disabled={!canProceedFromStep1}
                        >
                          {!isPreparingStep2 &&
                            !isPreparingStep3 &&
                            !isStep2Enabled &&
                            !isStep3Enabled && <IconPlay size={11} />}
                          {(isPreparingStep2 || isPreparingStep3) && (
                            <IconAtelierStar size={12} />
                          )}
                          <span>
                            {isPreparingStep2
                              ? "Enhancing Prompt..."
                              : isPreparingStep3
                              ? `Generating ${imageCount} Variations...`
                              : isStep2Enabled
                              ? "Next: Enhance Prompt →"
                              : isStep3Enabled
                              ? `Next: Review ${imageCount} Variations →`
                              : `Generate ${imageCount} ${
                                  imageCount === 1 ? "Image" : "Images"
                                }`}
                          </span>
                          <span className="ref-lime-badge">{imageCount}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                ) : wizardStep === 2 ? (
                  /* ==================== STEP 02: REVIEW AI-ENHANCED PROMPT ==================== */
                  <form
                    className="ref-wizard-review-form"
                    onSubmit={handleStep2Submit}
                  >
                    <div className="ref-wizard-step2-canvas">
                      <div className="ref-wizard-original-summary">
                        <span className="ref-wizard-summary-tag">
                          Original Input
                        </span>
                        <p className="ref-wizard-original-text">
                          {promptInput}
                        </p>
                      </div>

                      <div className="ref-wizard-enhanced-editor">
                        <div className="ref-studio-label-row">
                          <div className="ref-wizard-exact-label-group">
                            <label
                              htmlFor="wizard-enhanced-prompt-textarea"
                              className="ref-field-label ref-no-margin"
                            >
                              {isStep3Enabled
                                ? "Enhanced Prompt (Input for Step 03 Variations)"
                                : "Exact Prompt Sent to Model"}
                            </label>
                            <span className="ref-wizard-model-payload-chip">
                              {isStep3Enabled ? "→ Step 03" : model}
                            </span>
                            {!isStep3Enabled && creationTab === "reference" && (
                              <span className="ref-wizard-model-payload-chip is-ref">
                                + Reference Image
                              </span>
                            )}
                          </div>
                          <div className="ref-wizard-step-actions-inline">
                            <button
                              type="button"
                              className="ref-studio-ghost-action"
                              onClick={() => openSettingsModal()}
                              title="Edit the Enhancement Prompt instruction in Studio Settings"
                            >
                              <span>Prompt Settings</span>
                            </button>
                            <button
                              type="button"
                              className="ref-studio-ghost-action accent"
                              disabled={isPreparingStep2}
                              onClick={() => void runEnhancePromptForStep2()}
                            >
                              <IconRefresh size={12} />
                              <span>
                                {isPreparingStep2
                                  ? "Regenerating..."
                                  : "Regenerate with AI"}
                              </span>
                            </button>
                          </div>
                        </div>

                        <textarea
                          id="wizard-enhanced-prompt-textarea"
                          className="ref-params-textarea ref-wizard-enhanced-textarea"
                          value={enhancedPromptDraft}
                          onChange={(e) =>
                            setEnhancedPromptDraft(e.target.value)
                          }
                          placeholder="Exact model prompt..."
                        />

                        <span className="ref-wizard-exact-footnote">
                          {isStep3Enabled
                            ? `Includes your selected style, modifiers, locks, and aspect ratio. Next, Step 03 will generate ${imageCount} exact model prompts for review.`
                            : `Sent verbatim to ${model} without any hidden prefixes, modifiers, or suffixes added afterward.`}
                        </span>
                      </div>
                    </div>

                    <div className="ref-flow-create-modal-footer">
                      <button
                        type="button"
                        className="ref-mura-btn-outline lg"
                        onClick={() => setWizardStep(1)}
                      >
                        ← Back to Configure
                      </button>

                      <button
                        type="submit"
                        id="wizard-step2-primary-btn"
                        className="ref-dark-pill-btn"
                        disabled={
                          !enhancedPromptDraft.trim() ||
                          isPreparingStep3 ||
                          isGenerating
                        }
                      >
                        {!isStep3Enabled && !isPreparingStep3 && (
                          <IconPlay size={11} />
                        )}
                        <span>
                          {isPreparingStep3
                            ? `Generating ${imageCount} Variations...`
                            : isStep3Enabled
                            ? `Next: Review ${imageCount} Variations →`
                            : `Generate ${imageCount} ${
                                imageCount === 1 ? "Image" : "Images"
                              }`}
                        </span>
                        <span className="ref-lime-badge">{imageCount}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  /* ==================== STEP 03: REVIEW AI-GENERATED PROMPT VARIATIONS ==================== */
                  <form
                    className="ref-wizard-review-form"
                    onSubmit={handleStep3Submit}
                  >
                    <div className="ref-wizard-step3-canvas">
                      <div className="ref-wizard-step3-header">
                        <div className="ref-wizard-step3-header-copy">
                          <div className="ref-wizard-exact-label-group">
                            <strong className="ref-wizard-step3-title">
                              Exact Prompts Sent to Model (
                              {variationDrafts.length})
                            </strong>
                            <span className="ref-wizard-model-payload-chip">
                              {model}
                            </span>
                            {creationTab === "reference" && (
                              <span className="ref-wizard-model-payload-chip is-ref">
                                + Reference Image
                              </span>
                            )}
                          </div>
                          <span className="ref-wizard-step3-sub">
                            Each box below shows the exact, complete prompt
                            string sent verbatim to {model} — edit freely before
                            generating.
                          </span>
                        </div>

                        <div className="ref-wizard-step-actions-inline">
                          <button
                            type="button"
                            className="ref-studio-ghost-action"
                            onClick={() => openSettingsModal()}
                            title="Edit the Variation Prompt instruction in Studio Settings"
                          >
                            <span>Prompt Settings</span>
                          </button>
                          <button
                            type="button"
                            className="ref-studio-ghost-action accent"
                            disabled={isPreparingStep3}
                            onClick={() => {
                              const src =
                                isStep2Enabled && enhancedPromptDraft.trim()
                                  ? enhancedPromptDraft.trim()
                                  : promptInput.trim();
                              void runGenerateVariationsForStep3(src);
                            }}
                          >
                            <IconRefresh size={12} />
                            <span>
                              {isPreparingStep3
                                ? "Regenerating..."
                                : "Regenerate Variations"}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="ref-variations-review-list">
                        {variationDrafts.map((item, idx) => (
                          <div
                            key={`var-draft-${idx}`}
                            className="ref-variation-review-row"
                          >
                            <div className="ref-variation-review-meta">
                              <span className="ref-variation-index-num">
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <label
                                htmlFor={`variation-prompt-input-${idx}`}
                                className="ref-variation-title-text"
                              >
                                {item.label.replace(/^[0-9]+\s*•\s*/, "")}
                              </label>
                            </div>
                            <textarea
                              id={`variation-prompt-input-${idx}`}
                              className="ref-params-textarea ref-variation-row-textarea"
                              rows={Math.max(
                                4,
                                Math.ceil(item.prompt.length / 88)
                              )}
                              value={item.prompt}
                              onChange={(e) => {
                                const nextVal = e.target.value;
                                setVariationDrafts((prev) =>
                                  prev.map((v, vIdx) =>
                                    vIdx === idx ? { ...v, prompt: nextVal } : v
                                  )
                                );
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="ref-flow-create-modal-footer">
                      <button
                        type="button"
                        className="ref-mura-btn-outline lg"
                        onClick={() => setWizardStep(isStep2Enabled ? 2 : 1)}
                      >
                        ← Back to {isStep2Enabled ? "Step 02" : "Configure"}
                      </button>

                      <button
                        type="submit"
                        id="wizard-step3-generate-btn"
                        className="ref-dark-pill-btn"
                        disabled={
                          isGenerating ||
                          variationDrafts.some((v) => !v.prompt.trim())
                        }
                      >
                        <IconPlay size={11} />
                        <span>Generate {imageCount} Images</span>
                        <span className="ref-lime-badge">{imageCount}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
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
                  label: `DNA: ${canonicalDnaRef.label}`,
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
                  <div className="ref-lightbox-header-left">
                    <span className="ref-pill-chip active">
                      Step #{lightboxSlot.turnNumber} •{" "}
                      {lightboxSlot.slot.label}
                    </span>
                    {activeInteraction && (
                      <div className="ref-lightbox-nav-pair">
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
                  <div className="ref-lightbox-header-right">
                    <button
                      type="button"
                      className="ref-dark-pill-btn"
                      onClick={() => {
                        void handleChooseVariant(lightboxSlot.index);
                        setLightboxSlot(null);
                      }}
                    >
                      <span>Select Image & Load Prompt</span>
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
                        After • Step #{lightboxSlot.turnNumber} (
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
            className="ref-modal-card ref-project-rename-modal"
            onSubmit={handleSaveProjectTitleModal}
          >
            <div className="ref-modal-header">
              <strong
                id="edit-project-title-modal-heading"
                className="ref-soft-card-title"
              >
                Edit Project Name
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

            <div className="ref-project-rename-actions">
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
