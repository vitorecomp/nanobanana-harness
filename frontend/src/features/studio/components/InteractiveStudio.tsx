"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BootstrapResponse,
  NanoBananaModel,
  SessionFrame,
} from "../types/studio.types";
import {
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
  variants: QuadGeneratedSlot[];
}

const ASPECT_RATIO_OPTIONS = ["1:1", "3:4", "4:3", "16:9", "9:16"] as const;

const ATELIER_EMPTY_BLUEPRINTS = [
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
  } = useStudioSession();
  const [model] = useState<NanoBananaModel>("gemini-2.5-flash-image");

  const [promptInput, setPromptInput] = useState<string>("");
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
          variants: paddedVariants,
        };
      });

      setInteractions(loadedRounds);
      if (loadedRounds.length > 0) {
        const lastIdx = loadedRounds.length - 1;
        setActiveInteractionIndex(lastIdx);
        setPromptInput(loadedRounds[lastIdx].chosenPrompt);
        if (loadedRounds[lastIdx].aspectRatio) {
          setSelectedAspectRatio(loadedRounds[lastIdx].aspectRatio);
        }
      } else {
        setActiveInteractionIndex(-1);
        setPromptInput("");
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
    listUserConversations(activeUser.id).then((list) => {
      if (list.length > 0) {
        void loadProjectById(list[0].id);
      }
    });
  }, [externalPresetRequest, activeUser.id, loadProjectById]);

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
    setProjectTitle("New Project");
    setPromptInput("");
    setInteractions([]);
    setActiveInteractionIndex(-1);
    setLightboxSlot(null);
    setLiveDraftSlots([null, null, null, null]);
    setGenerationStage("idle");
    showTransientNotice("✦ New project started with 4 ready frames");
  }, [newProjectNonce, setActiveProjectId, setProjectTitle, showTransientNotice]);

  const handleToggleModifier = (modId: string) => {
    setSelectedModifiers((prev) =>
      prev.includes(modId) ? prev.filter((m) => m !== modId) : [...prev, modId]
    );
  };

  // User clicks one of the 4 generated cards to choose the one they like best and modify its prompt
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

  // Main flow: user types/modifies a prompt -> Gemini creates 3 dynamic scene-part emphasis versions -> 4 images are generated
  const handleGenerateInteraction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPrompt = promptInput.trim();
    if (!cleanPrompt || isGenerating) return;

    setIsGenerating(true);
    setGenerationStage("analyzing-scene");
    setCompletedSlotsCount(0);
    setLiveDraftSlots([
      {
        label: "1 • Base Prompt",
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

      // Send chosen image as visual reference if enabled and available
      let referencePart = null;
      if (useReferenceImage && originRound?.chosenImageUrl) {
        referencePart =
          parseDataUrl(originRound.chosenImageUrl) ||
          (await imageUrlToInlinePart(originRound.chosenImageUrl));
      }

      const quadVariants = await generateQuadWithNanoBanana({
        apiKey,
        model,
        basePrompt: cleanPrompt,
        styleLabel: activeStyleObj?.title.split(" (")[0],
        modifierLabels: activeModifierLabels,
        aspectRatio: selectedAspectRatio,
        referenceImage: referencePart,
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
      }

      const nextTurnNumber = interactions.length + 1;
      const defaultChosen = quadVariants[0];

      const savedTurn = await saveConversationTurn(targetConvId, {
        user_id: activeUser.id,
        title: projectTitle.trim() || "New Project",
        parent_turn_number: parentTurnNumber,
        role: "assistant",
        raw_idea: cleanPrompt,
        master_prompt: defaultChosen.prompt,
        edit_instruction: parentTurnNumber
          ? `Interaction #${nextTurnNumber} (branched from #${parentTurnNumber})`
          : `Interaction #${nextTurnNumber}`,
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
        variants: persistedVariants,
      };

      setInteractions((prev) => {
        const next = [...prev, newRound];
        setActiveInteractionIndex(next.length - 1);
        return next;
      });

      const renderedCount = persistedVariants.filter((v) =>
        Boolean(v.imageUrl)
      ).length;
      if (!apiKey.trim()) {
        showTransientNotice(
          "✦ 4 prompt variations created! Add your Gemini API key in ⚙ Settings to render PNGs."
        );
      } else if (renderedCount > 0) {
        showTransientNotice(
          `✦ Interaction #${nextTurnNumber} complete • ${renderedCount} PNGs saved in ~/Pictures/nanobanana/`
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
              const blueprint = ATELIER_EMPTY_BLUEPRINTS[idx];

              return (
                <div
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
                  {/* 1. TOP ROUNDED ARTWORK FRAME (Matches reference card layout) */}
                  <div className="ref-quad-image-frame">
                    {slot?.imageUrl ? (
                      <img
                        src={slot.imageUrl}
                        alt={slot.label}
                        className="ref-quad-img ref-quad-img-reveal"
                      />
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

                  {/* 2. MIDDLE METADATA BLOCK (Bold Title + Parenthesized Tag + Prompt + Dots) */}
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
                          ? `(#${activeInteraction.turnNumber} • ${selectedAspectRatio})`
                          : isGenerating
                          ? slot?.imageUrl
                            ? "(Ready)"
                            : "(Generating...)"
                          : `(${selectedAspectRatio})`}
                      </span>
                    </div>

                    <div className="ref-mura-meta-row">
                      <span className="ref-mura-meta-prompt">
                        {slot
                          ? slot.prompt
                          : `Frame #${idx + 1} awaiting prompt`}
                      </span>
                      <span
                        className="ref-mura-dots"
                        aria-label={`Frame ${idx + 1} of 4`}
                      >
                        {[0, 1, 2, 3].map((dotIdx) => (
                          <i
                            key={dotIdx}
                            className={`ref-mura-dot ${
                              dotIdx <= idx ? "filled" : ""
                            } ${dotIdx === idx ? "current" : ""}`}
                          />
                        ))}
                      </span>
                    </div>

                    {/* 3. BOTTOM ACTION PILLS ROW ([Solid Pill] [Outlined Pill]) */}
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
                        <>
                          <button
                            type="button"
                            className="ref-mura-btn-outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!activeInteraction) return;
                              setLightboxSlot({
                                slot,
                                index: idx,
                                turnNumber: activeInteraction.turnNumber,
                              });
                            }}
                            title="Expand image in full screen"
                          >
                            View Image ⤢
                          </button>
                          <button
                            type="button"
                            className="ref-mura-btn-outline icon-only"
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
                          >
                            ↓
                          </button>
                        </>
                      ) : (
                        <span className="ref-mura-btn-outline disabled">
                          {isGenerating ? "Rendering..." : "View Image"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT 40%: PROMPTS & PARAMETERS */}
        <aside
          className="ref-studio-right-params-40"
          aria-label="Prompts and Parameters"
        >
          {/* Prompt Editor & Interaction Trigger Card */}
          <form
            className="ref-params-card"
            onSubmit={handleGenerateInteraction}
          >
            <div className="ref-params-card-header">
              <strong className="ref-soft-card-title">
                Generation Prompt
              </strong>
              {activeInteraction?.chosenImageUrl ? (
                <button
                  type="button"
                  className={`ref-pill-chip ${
                    useReferenceImage ? "active" : ""
                  }`}
                  onClick={() => setUseReferenceImage((prev) => !prev)}
                  title="Enable or disable sending the selected image as a visual reference in the next generation"
                >
                  {useReferenceImage
                    ? "✓ Visual Reference: ON"
                    : "Visual Reference: OFF"}
                </button>
              ) : (
                <span className="ref-pill-chip">
                  1 Base + 3 Gemini Emphases = 4 Images
                </span>
              )}
            </div>

            <div className="ref-params-field-group" style={{ flex: 1 }}>
              <label
                className="ref-field-label"
                htmlFor="studio-master-prompt"
              >
                {activeInteraction
                  ? `Selected image prompt (Interaction #${activeInteraction.turnNumber}) — edit to generate next interaction`
                  : "Enter your initial prompt (Ctrl + Enter to generate)"}
              </label>
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
                placeholder="Describe your scene... Gemini will dynamically create 3 additional emphasis variations to render all 4 images."
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div className="ref-studio-feedback-slot" aria-live="polite">
                {statusNotice ? (
                  <span className="ref-atelier-toast-pill">
                    {statusNotice}
                  </span>
                ) : (
                  <span className="ref-atelier-shortcut-hint">
                    Shortcut: <kbd>Ctrl</kbd>+<kbd>↵</kbd>
                  </span>
                )}
              </div>

              <button
                type="submit"
                id="generate-nanobanana-primary-btn"
                className="ref-dark-pill-btn"
                disabled={isGenerating || !promptInput.trim()}
              >
                <span>
                  {isGenerating
                    ? generationStage === "analyzing-scene"
                      ? "Gemini composing 3 emphases..."
                      : `Rendering images (${completedSlotsCount}/4)...`
                    : activeInteraction
                    ? `Iterate from #${activeInteraction.turnNumber} (4 Images)`
                    : "Generate 4 Images"}
                </span>
                <span className="ref-lime-badge">
                  {interactions.length + 1}
                </span>
              </button>
            </div>
          </form>

          {/* Parameters Card (Aspect Ratio + Styles + Modifiers) */}
          <div className="ref-params-card">
            <div className="ref-params-card-header">
              <strong className="ref-soft-card-title">Parameters</strong>
              <span className="ref-pill-chip">{selectedAspectRatio}</span>
            </div>

            <div className="ref-params-field-group">
              <span className="ref-field-label">
                Aspect Ratio
              </span>
              <div className="ref-params-pills-wrap">
                {ASPECT_RATIO_OPTIONS.map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    className={`ref-pill-chip ${
                      selectedAspectRatio === ratio ? "active" : ""
                    }`}
                    onClick={() => setSelectedAspectRatio(ratio)}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div className="ref-params-field-group">
              <span className="ref-field-label">Visual Style</span>
              <div className="ref-params-pills-wrap">
                {bootstrapData.style_presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`ref-pill-chip ${
                      selectedStyleId === preset.id ? "active" : ""
                    }`}
                    onClick={() => setSelectedStyleId(preset.id)}
                  >
                    {preset.title.split(" (")[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="ref-params-field-group">
              <div className="ref-studio-mod-header-row">
                <span className="ref-field-label">
                  Modifiers ({selectedModifiers.length} active)
                </span>
                <Link href="/modifiers" className="ref-studio-mod-manage-link">
                  ✦ Categories & AI ↗
                </Link>
              </div>

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
          </div>
        </aside>
      </div>

      {/* ==================== LIGHTBOX MODAL FOR FULL-SIZE IMAGE INSPECTION ==================== */}
      {lightboxSlot && (
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
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
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
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
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
                  className="ref-circle-icon-btn"
                  style={{ width: "34px", height: "34px" }}
                  onClick={() => setLightboxSlot(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="ref-lightbox-image-box">
              <img
                src={lightboxSlot.slot.imageUrl}
                alt={lightboxSlot.slot.label}
                className="ref-lightbox-img"
              />
            </div>

            <p className="ref-lightbox-prompt-text">
              {lightboxSlot.slot.prompt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
