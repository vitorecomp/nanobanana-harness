"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import {
  createConversation,
  getConversationDetail,
  listUserConversations,
  saveConversationTurn,
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
  variants: QuadGeneratedSlot[];
}

const ASPECT_RATIO_OPTIONS = ["1:1", "3:4", "4:3", "16:9", "9:16"] as const;

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
  const [model] = useState<NanoBananaModel>("gemini-2.5-flash-image");

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>("Novo Projeto");
  const [promptInput, setPromptInput] = useState<string>("");
  const [selectedStyleId, setSelectedStyleId] =
    useState<string>("editorial-anime");
  const [selectedAspectRatio, setSelectedAspectRatio] =
    useState<string>("3:4");
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([
    "golden-hour",
    "lens-85mm",
  ]);
  const [useReferenceImage, setUseReferenceImage] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Lightbox modal state for inspecting any of the 4 generated images at full resolution
  const [lightboxSlot, setLightboxSlot] = useState<{
    slot: QuadGeneratedSlot;
    index: number;
    turnNumber: number;
  } | null>(null);

  // Interactions history in the top 15% bar; bottom 60% shows ONLY the active/latest generation's 4 slots
  const [interactions, setInteractions] = useState<StudioInteractionRound[]>(
    []
  );
  const [activeInteractionIndex, setActiveInteractionIndex] =
    useState<number>(-1);

  const loadProjectById = useCallback(
    async (convId: string) => {
      setActiveProjectId(convId);
      const detail = await getConversationDetail(convId, activeUser.id);
      if (!detail) return;
      setProjectTitle(detail.title);
      if (detail.style_id) setSelectedStyleId(detail.style_id);

      const loadedRounds: StudioInteractionRound[] = detail.turns.map((t) => {
        const savedVars = Array.isArray(t.variants) ? t.variants : [];
        const paddedVariants: QuadGeneratedSlot[] =
          savedVars.length > 0
            ? savedVars.map((v, i) => ({
                label: v.label || `Versão #${i + 1}`,
                prompt: v.prompt || t.master_prompt,
                imageUrl: v.imageUrl || "",
                mimeType: "image/png",
                base64Data: "",
              }))
            : [
                {
                  label: "1 • Prompt Base",
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
    [activeUser.id]
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

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxSlot) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxSlot(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxSlot]);

  // Update current project name in state and persist immediately in SQLite + subfolder
  const handleProjectTitleChange = (nextTitle: string) => {
    setProjectTitle(nextTitle);
    if (activeProjectId) {
      void updateConversationTitle(activeProjectId, nextTitle);
    }
  };

  // Reset to a completely empty new project (all 4 slots empty)
  const handleNewProject = () => {
    setActiveProjectId(null);
    setProjectTitle("Novo Projeto");
    setPromptInput("");
    setInteractions([]);
    setActiveInteractionIndex(-1);
    setLightboxSlot(null);
  };

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

    try {
      const activeStyleObj =
        bootstrapData.style_presets.find((s) => s.id === selectedStyleId) ||
        bootstrapData.style_presets[0];

      const allModifierOpts = bootstrapData.modifier_categories.flatMap(
        (c) => c.options
      );
      const activeModifierLabels = selectedModifiers
        .map(
          (id) => allModifierOpts.find((o) => o.id === id)?.label.split(" (")[0]
        )
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
      });

      let targetConvId = activeProjectId;
      if (!targetConvId) {
        const created = await createConversation({
          user_id: activeUser.id,
          title: projectTitle.trim() || "Novo Projeto",
          style_id: selectedStyleId,
        });
        targetConvId = created?.id || `conv_${Date.now()}`;
        setActiveProjectId(targetConvId);
      }

      const nextTurnNumber = interactions.length + 1;
      const defaultChosen = quadVariants[0];

      const savedTurn = await saveConversationTurn(targetConvId, {
        user_id: activeUser.id,
        title: projectTitle.trim() || "Novo Projeto",
        parent_turn_number: parentTurnNumber,
        role: "assistant",
        raw_idea: cleanPrompt,
        master_prompt: defaultChosen.prompt,
        edit_instruction: parentTurnNumber
          ? `Interação #${nextTurnNumber} (originada de #${parentTurnNumber})`
          : `Interação #${nextTurnNumber}`,
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
              label: v.label,
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
    } finally {
      setIsGenerating(false);
    }
  };

  // Bottom 60% shows ONLY the active/latest generation's 4 slots (or 4 empty slots when opening a new project)
  const activeInteraction =
    activeInteractionIndex >= 0 ? interactions[activeInteractionIndex] : null;

  const quadSlots: Array<QuadGeneratedSlot | null> = [
    activeInteraction?.variants[0] || null,
    activeInteraction?.variants[1] || null,
    activeInteraction?.variants[2] || null,
    activeInteraction?.variants[3] || null,
  ];

  return (
    <div className="ref-page-container">
      <div className="ref-studio-three-part-layout">
        {/* ==================== PART 1: TOP 15% INTERACTIONS HISTORY BAR WITH ORIGIN ARROWS ==================== */}
        <section
          className="ref-studio-top-interactions"
          aria-label="Histórico de Interações"
        >
          <div className="ref-interactions-history-strip">
            {interactions.map((round, idx) => {
              const isCurrent = idx === activeInteractionIndex;
              const isOriginOfCurrent =
                activeInteraction?.parentTurnNumber === round.turnNumber;

              return (
                <React.Fragment key={round.id}>
                  {/* Arrow pointing from the origin interaction of the modification */}
                  {idx > 0 && (
                    <div
                      className={`ref-interaction-arrow-connector ${
                        round.parentTurnNumber &&
                        round.parentTurnNumber !== round.turnNumber - 1
                          ? "branched"
                          : ""
                      }`}
                      title={
                        round.parentTurnNumber
                          ? `Modificação originada da Interação #${round.parentTurnNumber}`
                          : undefined
                      }
                    >
                      {round.parentTurnNumber &&
                      round.parentTurnNumber !== round.turnNumber - 1 ? (
                        <span className="ref-interaction-branch-badge">
                          de #{round.parentTurnNumber} ➔
                        </span>
                      ) : (
                        <span className="ref-interaction-seq-arrow">➔</span>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    className={`ref-interaction-history-item ${
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
                        alt={`Interação #${round.turnNumber}`}
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
                          gap: "6px",
                        }}
                      >
                        <span className="ref-interaction-turn">
                          Interação #{round.turnNumber}
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
        </section>

        {/* ==================== PART 2 & 3: BOTTOM 85% SPLIT (60% LEFT / 40% RIGHT) ==================== */}
        <div className="ref-studio-bottom-split">
          {/* LEFT 60%: ONLY THE 4 IMAGES OF THE LATEST/ACTIVE GENERATION (EMPTY ON NEW PROJECT) */}
          <section
            className="ref-studio-left-images-60"
            aria-label="4 imagens da geração atual"
          >
            <div className="ref-quad-images-grid">
              {quadSlots.map((slot, idx) => {
                const isSelected =
                  slot !== null &&
                  activeInteraction?.selectedVariantIndex === idx;

                return (
                  <div
                    key={
                      activeInteraction
                        ? `${activeInteraction.id}-slot-${idx}`
                        : `empty-slot-${idx}`
                    }
                    className={`ref-quad-image-card ${
                      isSelected ? "selected" : ""
                    }`}
                    onClick={() => {
                      if (!slot) return;
                      void handleChooseVariant(idx);
                    }}
                    onDoubleClick={() => {
                      if (!slot?.imageUrl || !activeInteraction) return;
                      setLightboxSlot({
                        slot,
                        index: idx,
                        turnNumber: activeInteraction.turnNumber,
                      });
                    }}
                  >
                    {slot && (
                      <div className="ref-quad-card-header">
                        <span
                          className="ref-quad-card-badge"
                          title={slot.label}
                        >
                          {slot.label}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            alignItems: "center",
                          }}
                        >
                          <span
                            className={`ref-pill-chip ${
                              isSelected ? "active" : ""
                            }`}
                            style={{ padding: "2px 8px", fontSize: "0.68rem" }}
                          >
                            {isSelected ? "✓ Escolhida" : "Escolher"}
                          </span>
                          {slot.imageUrl && (
                            <>
                              <button
                                type="button"
                                className="ref-card-expand-circle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!activeInteraction) return;
                                  setLightboxSlot({
                                    slot,
                                    index: idx,
                                    turnNumber: activeInteraction.turnNumber,
                                  });
                                }}
                                title="Expandir imagem (Lightbox)"
                              >
                                ⤢
                              </button>
                              <button
                                type="button"
                                className="ref-card-expand-circle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const a = document.createElement("a");
                                  a.href = slot.imageUrl;
                                  a.download = `interacao-${
                                    activeInteraction?.turnNumber || 1
                                  }-v${idx + 1}.png`;
                                  a.click();
                                }}
                                title="Baixar imagem"
                              >
                                ↓
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="ref-quad-image-frame">
                      {slot?.imageUrl ? (
                        <img
                          src={slot.imageUrl}
                          alt={slot.label}
                          className="ref-quad-img"
                        />
                      ) : null}
                    </div>

                    {slot && (
                      <p className="ref-quad-prompt-caption">{slot.prompt}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* RIGHT 40%: PROMPTS & PARAMETERS */}
          <aside
            className="ref-studio-right-params-40"
            aria-label="Prompts e Parâmetros"
          >
            {/* Prompt Editor & Interaction Trigger Card */}
            <form
              className="ref-params-card"
              onSubmit={handleGenerateInteraction}
            >
              <div className="ref-params-card-header">
                <strong className="ref-soft-card-title">
                  Prompt da Geração
                </strong>
                {activeInteraction?.chosenImageUrl ? (
                  <button
                    type="button"
                    className={`ref-pill-chip ${
                      useReferenceImage ? "active" : ""
                    }`}
                    onClick={() => setUseReferenceImage((prev) => !prev)}
                    title="Ativar ou desativar o envio da imagem escolhida como referência visual na próxima geração"
                  >
                    {useReferenceImage
                      ? "✓ Referência Visual: ON"
                      : "Referência Visual: OFF"}
                  </button>
                ) : (
                  <span className="ref-pill-chip">
                    1 Base + 3 Ênfases Gemini = 4 Imagens
                  </span>
                )}
              </div>

              <div className="ref-params-field-group" style={{ flex: 1 }}>
                <label
                  className="ref-field-label"
                  htmlFor="studio-master-prompt"
                >
                  {activeInteraction
                    ? `Prompt da imagem escolhida (Interação #${activeInteraction.turnNumber}) — modifique para gerar nova interação`
                    : "Digite seu prompt inicial"}
                </label>
                <textarea
                  id="studio-master-prompt"
                  className="ref-params-textarea"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="Digite o prompt da cena... O Gemini criará dinamicamente mais 3 versões com ênfases nas partes da cena para gerar as 4 imagens."
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <button
                  type="submit"
                  id="generate-nanobanana-primary-btn"
                  className="ref-dark-pill-btn"
                  disabled={isGenerating || !promptInput.trim()}
                >
                  <span>
                    {isGenerating
                      ? "Gerando 3 ênfases + 4 imagens..."
                      : activeInteraction
                      ? `Interagir a partir de #${activeInteraction.turnNumber} (4 Imagens)`
                      : "Gerar 4 Imagens"}
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
                <strong className="ref-soft-card-title">Parâmetros</strong>
                <span className="ref-pill-chip">{selectedAspectRatio}</span>
              </div>

              <div className="ref-params-field-group">
                <span className="ref-field-label">
                  Proporção (Aspect Ratio)
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
                <span className="ref-field-label">Estilo Visual</span>
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
                <span className="ref-field-label">
                  Modificadores (Lente, Luz & Atmosfera)
                </span>
                <div className="ref-params-pills-wrap">
                  {bootstrapData.modifier_categories
                    .flatMap((c) => c.options)
                    .map((opt) => {
                      const active = selectedModifiers.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          className={`ref-pill-chip ${active ? "active" : ""}`}
                          onClick={() => handleToggleModifier(opt.id)}
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
      </div>

      {/* ==================== FOOTER BAR (LEFT: NOME DO PROJETO ATUAL | RIGHT: + NOVO PROJETO) ==================== */}
      <div className="ref-bottom-scrubber-bar">
        <div className="ref-bottom-project-title-box">
          <span className="ref-interactions-label">Projeto:</span>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => handleProjectTitleChange(e.target.value)}
            className="ref-bottom-project-title-input"
            placeholder="Nome do projeto..."
          />
        </div>

        <button
          type="button"
          className="ref-dark-pill-btn"
          onClick={handleNewProject}
          title="Abrir novo projeto vazio"
        >
          <span>+ Novo Projeto</span>
        </button>
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
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="ref-pill-chip active">
                  Interação #{lightboxSlot.turnNumber} •{" "}
                  {lightboxSlot.slot.label}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  className="ref-dark-pill-btn"
                  onClick={() => {
                    void handleChooseVariant(lightboxSlot.index);
                    setLightboxSlot(null);
                  }}
                >
                  <span>✓ Escolher esta Imagem e Carregar Prompt</span>
                </button>
                <button
                  type="button"
                  className="ref-pill-chip"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = lightboxSlot.slot.imageUrl;
                    a.download = `interacao-${lightboxSlot.turnNumber}-v${
                      lightboxSlot.index + 1
                    }.png`;
                    a.click();
                  }}
                >
                  ↓ Baixar PNG
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
