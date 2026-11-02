"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BootstrapResponse,
  AnalyzePromptResponse,
  QuickIterationChip,
  NanoBananaModel,
  SessionFrame,
} from "../types/studio.types";
import {
  analyzeWithCopilot,
  refineWithCopilot,
  buildLocalFallbackAnalysis,
} from "../services/copilotService";
import {
  generateWithNanoBanana,
  simulateNanoBananaTurn,
  imageUrlToInlinePart,
  parseDataUrl,
  getShowcaseFallbackDataUrl,
} from "../services/nanobananaClient";
import {
  AuthProvider,
  GoogleUserProfile,
  GoogleGLogo,
  FacebookFLogo,
} from "@/features/auth";
import {
  createConversation,
  getConversationDetail,
  saveConversationTurn,
  toggleTurnPublish,
} from "@/features/history";

export type { SessionFrame };

interface InteractiveStudioProps {
  bootstrapData: BootstrapResponse;
  backendOnline: boolean;
  apiKey: string;
  setApiKey: (key: string) => void;
  googleUser: GoogleUserProfile | null;
  onRequestGoogleLogin: (provider?: AuthProvider) => void;
  onGoogleLogout: () => void;
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

const STARTER_IDEAS = [
  {
    label: "Urban Explorer",
    idea: "A futuristic explorer wearing aviator goggles on the forehead walking down a sunlit street",
  },
  {
    label: "Editorial Duo",
    idea: "Two young characters in utility jackets walking side by side beneath a pastel teal sky",
  },
  {
    label: "Neo-Tokyo Pilot",
    idea: "Portrait of a cybernetic pilot wearing a structured cream jacket with acid-yellow graphic insignia",
  },
  {
    label: "Brutalist Conservatory",
    idea: "Sun-drenched brutalist concrete conservatory filled with lush tropical botanicals",
  },
];

export default function InteractiveStudio({
  bootstrapData,
  backendOnline,
  apiKey,
  setApiKey,
  googleUser,
  onRequestGoogleLogin,
  externalPresetRequest,
}: InteractiveStudioProps) {
  const router = useRouter();

  // Volatile RAM-only API Key visibility state
  const [showKey, setShowKey] = useState<boolean>(false);
  const [model, setModel] = useState<NanoBananaModel>(
    "gemini-2.5-flash-image"
  );
  const [simulationMode, setSimulationMode] = useState<boolean>(
    apiKey.trim().length <= 8
  );
  const [keyClearedBanner, setKeyClearedBanner] = useState<boolean>(false);

  // Co-Pilot Prompt State
  const [idea, setIdea] = useState<string>(
    "A futuristic urban explorer with aviator goggles resting on the forehead on a sunlit street"
  );
  const [selectedStyleId, setSelectedStyleId] =
    useState<string>("editorial-anime");
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([
    "golden-hour",
    "lens-35mm",
  ]);
  const [activeModifierCategory, setActiveModifierCategory] =
    useState<string>("lighting");
  const [answeredQuestions, setAnsweredQuestions] = useState<
    Record<string, string>
  >({});

  // Analysis response from Python Backend (/api/interactive/analyze)
  const [analysis, setAnalysis] = useState<AnalyzePromptResponse>(() =>
    buildLocalFallbackAnalysis(
      "A futuristic urban explorer with aviator goggles resting on the forehead on a sunlit street",
      "editorial-anime",
      ["golden-hour", "lens-35mm"]
    )
  );
  const [activeVariationId, setActiveVariationId] = useState<string | null>(
    null
  );
  const [masterPrompt, setMasterPrompt] = useState<string>(
    analysis.master_prompt
  );
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [copilotConnected, setCopilotConnected] =
    useState<boolean>(backendOnline);

  // PostgreSQL Conversation & RustFS Bucket State
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [storageStatusBadge, setStorageStatusBadge] = useState<string | null>(
    null
  );

  // Nano Banana Live Canvas & Multi-Turn Timeline State
  const [timeline, setTimeline] = useState<SessionFrame[]>([
    {
      id: "initial-showcase-turn-1",
      turn: 1,
      imageUrl: "/showcase/step-1-base.png",
      mimeType: "image/png",
      base64Data: "",
      promptUsed:
        "Portrait of a young anime explorer with copper hair, aviator goggles resting on forehead, olive-green utility jacket over white tee, high-craft editorial anime illustration, crisp cel-shaded ink linework, warm bone backdrop #E9E7DF.",
      instructionUsed: "Initial Base Concept (Turn #1)",
      explanation:
        "Initial frame ready on the canvas. Generate a new frame or apply multi-turn refinements directly on top of this artwork.",
      modelUsed: "gemini-2.5-flash-image (Preview)",
      mode: "simulation",
      timestamp: "Active Session",
      isPublished: false,
    },
  ]);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);
  const [keepConsistency, setKeepConsistency] = useState<boolean>(true);
  const [comparePrevious, setComparePrevious] = useState<boolean>(false);

  // Multi-turn refinement state (/api/interactive/refine)
  const [customInstruction, setCustomInstruction] = useState<string>("");
  const [quickChips, setQuickChips] = useState<QuickIterationChip[]>(
    bootstrapData.quick_iteration_chips
  );
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setCopilotConnected(backendOnline);
  }, [backendOnline]);

  useEffect(() => {
    if (bootstrapData.quick_iteration_chips?.length > 0) {
      setQuickChips(bootstrapData.quick_iteration_chips);
    }
  }, [bootstrapData.quick_iteration_chips]);

  // Run Co-Pilot Analysis against Python Backend
  const runAnalysis = useCallback(
    async (
      nextIdea: string,
      nextStyleId: string,
      nextModifiers: string[],
      stepCount = 1
    ) => {
      setIsAnalyzing(true);
      const result = await analyzeWithCopilot({
        idea: nextIdea,
        style_id: nextStyleId,
        modifiers: nextModifiers,
        step: stepCount,
      });
      setAnalysis(result.data);
      setMasterPrompt(result.data.master_prompt);
      setActiveVariationId(null);
      setCopilotConnected(result.online);
      setIsAnalyzing(false);
    },
    []
  );

  useEffect(() => {
    runAnalysis(idea, selectedStyleId, selectedModifiers, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load an existing Conversation and all its turns from PostgreSQL + RustFS Bucket
  const loadConversationFromBackend = useCallback(
    async (conversationId: string) => {
      if (!googleUser) return;
      const detail = await getConversationDetail(conversationId, googleUser.id);
      if (!detail) return;

      setActiveConversationId(detail.id);
      if (detail.style_id) setSelectedStyleId(detail.style_id);

      if (detail.turns.length > 0) {
        const restoredFrames: SessionFrame[] = detail.turns.map((t, idx) => ({
          id: t.id || `db-turn-${idx + 1}`,
          turn: t.turn_number || idx + 1,
          imageUrl: t.image_url || "/showcase/step-1-base.png",
          mimeType: "image/png",
          base64Data: "",
          promptUsed: t.master_prompt,
          instructionUsed:
            t.edit_instruction || `Turn #${t.turn_number || idx + 1} (Postgres)`,
          explanation: `Restored from PostgreSQL & RustFS Bucket (${
            t.image_bucket_key || "nanobanana-images"
          })`,
          modelUsed: t.model_used || "gemini-2.5-flash-image",
          mode: "simulation",
          timestamp: t.created_at
            ? new Date(t.created_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Saved",
          bucketKey: t.image_bucket_key,
          savedToPostgres: true,
          isPublished: Boolean(t.is_published),
        }));
        setTimeline(restoredFrames);
        setActiveFrameIndex(restoredFrames.length - 1);
        const lastTurn = detail.turns[detail.turns.length - 1];
        if (lastTurn.raw_idea) setIdea(lastTurn.raw_idea);
        if (lastTurn.master_prompt) setMasterPrompt(lastTurn.master_prompt);
        setStorageStatusBadge(
          `Session '${detail.title}' loaded (${detail.turns.length} turns from PostgreSQL + RustFS)`
        );
      }
    },
    [googleUser]
  );

  // Handle remix/preset requests triggered from Home or Gallery pages
  useEffect(() => {
    if (!externalPresetRequest) return;

    if (externalPresetRequest.conversationId) {
      loadConversationFromBackend(externalPresetRequest.conversationId);
      return;
    }

    if (externalPresetRequest.styleId) {
      setSelectedStyleId(externalPresetRequest.styleId);
    }
    setIdea(externalPresetRequest.idea);
    if (externalPresetRequest.prompt) {
      setMasterPrompt(externalPresetRequest.prompt);
    } else {
      runAnalysis(
        externalPresetRequest.idea,
        externalPresetRequest.styleId || selectedStyleId,
        selectedModifiers,
        timeline.length + 1
      );
    }
    if (externalPresetRequest.imageUrl) {
      const loadedFrame: SessionFrame = {
        id: `loaded-${externalPresetRequest.nonce}`,
        turn: externalPresetRequest.turn || timeline.length + 1,
        imageUrl: externalPresetRequest.imageUrl,
        mimeType: "image/png",
        base64Data: "",
        promptUsed:
          externalPresetRequest.prompt || externalPresetRequest.idea,
        instructionUsed: `Remixed from Gallery (Turn #${
          externalPresetRequest.turn || 1
        })`,
        explanation:
          "Frame loaded from Gallery for multi-turn iteration with Nano Banana.",
        modelUsed: "gemini-2.5-flash-image",
        mode: "simulation",
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setTimeline((prev) => {
        const updated = [...prev, loadedFrame];
        setActiveFrameIndex(updated.length - 1);
        return updated;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPresetRequest]);

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    setKeyClearedBanner(false);
    setErrorMessage(null);
    if (val.trim().length > 8) {
      setSimulationMode(false);
    }
  };

  const handleClearKeyFromRam = () => {
    setApiKey("");
    setSimulationMode(true);
    setKeyClearedBanner(true);
    setErrorMessage(null);
  };

  const handleToggleModifier = (modId: string) => {
    const next = selectedModifiers.includes(modId)
      ? selectedModifiers.filter((m) => m !== modId)
      : [...selectedModifiers, modId];
    setSelectedModifiers(next);
    runAnalysis(idea, selectedStyleId, next, timeline.length);
  };

  const handleSelectStyle = (styleId: string) => {
    setSelectedStyleId(styleId);
    runAnalysis(idea, styleId, selectedModifiers, timeline.length);
  };

  const handleAnswerGuidedQuestion = (
    questionId: string,
    optionLabel: string,
    promptAddition: string
  ) => {
    setAnsweredQuestions((prev) => ({ ...prev, [questionId]: optionLabel }));
    const enrichedIdea = idea.includes(promptAddition)
      ? idea
      : `${idea.trim()}, ${promptAddition}`;
    setIdea(enrichedIdea);
    runAnalysis(
      enrichedIdea,
      selectedStyleId,
      selectedModifiers,
      timeline.length + 1
    );
  };

  // Start a new PostgreSQL Conversation
  const handleStartNewConversation = async () => {
    if (!googleUser) {
      onRequestGoogleLogin();
      return;
    }
    const title = idea.trim().slice(0, 60) || "New Creative Session";
    const created = await createConversation({
      user_id: googleUser.id,
      title,
      style_id: selectedStyleId,
    });
    if (created) {
      setActiveConversationId(created.id);
      setStorageStatusBadge(
        `New conversation created in PostgreSQL (${created.id})`
      );
    }
  };

  // Persist a generated turn to PostgreSQL + RustFS Bucket
  const persistTurnToBackend = async (
    frame: SessionFrame,
    editInst?: string,
    publishImmediately = false
  ): Promise<SessionFrame> => {
    if (!googleUser) return frame;
    const targetConvId = activeConversationId || "new";
    const saved = await saveConversationTurn(targetConvId, {
      user_id: googleUser.id,
      role: "assistant",
      raw_idea: idea,
      master_prompt: frame.promptUsed,
      edit_instruction: editInst || frame.instructionUsed,
      style_id: selectedStyleId,
      modifiers: selectedModifiers,
      completeness_score: analysis.completeness_score,
      analysis: {
        detected_dimensions: analysis.detected_dimensions,
        missing_dimensions: analysis.missing_dimensions,
      },
      image_data_url: frame.imageUrl,
      aspect_ratio: "3:4",
      model_used: frame.modelUsed,
      is_published: publishImmediately,
    });

    if (saved) {
      setActiveConversationId(saved.conversation_id);
      setStorageStatusBadge(
        `✓ Saved to PostgreSQL & RustFS Bucket (${
          saved.image_bucket_key || "nanobanana-images"
        })${saved.is_published ? " • Published to Gallery!" : ""}`
      );
      return {
        ...frame,
        id: saved.id,
        imageUrl: saved.image_url || frame.imageUrl,
        bucketKey: saved.image_bucket_key,
        savedToPostgres: true,
        isPublished: Boolean(saved.is_published),
      };
    }
    return frame;
  };

  const activeFrame = timeline[activeFrameIndex] || timeline[0];
  const previousFrame =
    activeFrameIndex > 0 ? timeline[activeFrameIndex - 1] : null;

  // Publish or unpublish the currently active frame to the Community Gallery
  const handlePublishActiveFrame = async () => {
    if (!activeFrame) return;
    setIsPublishing(true);
    setErrorMessage(null);

    try {
      // If the frame hasn't been saved to PostgreSQL yet (e.g. initial preview), save + publish it first
      if (!activeFrame.savedToPostgres || activeFrame.id.startsWith("initial-") || activeFrame.id.startsWith("loaded-")) {
        const persisted = await persistTurnToBackend(
          activeFrame,
          activeFrame.instructionUsed,
          true
        );
        setTimeline((prev) =>
          prev.map((item, idx) =>
            idx === activeFrameIndex ? persisted : item
          )
        );
      } else {
        const desiredState = !activeFrame.isPublished;
        const updated = await toggleTurnPublish(activeFrame.id, desiredState);
        if (updated) {
          setTimeline((prev) =>
            prev.map((item, idx) =>
              idx === activeFrameIndex
                ? { ...item, isPublished: Boolean(updated.is_published) }
                : item
            )
          );
          setStorageStatusBadge(
            updated.is_published
              ? "★ Published to Public Community Gallery (/gallery)"
              : "Removed from Public Community Gallery"
          );
        }
      }
    } finally {
      setIsPublishing(false);
    }
  };

  // Execute Generation (Direct Browser Call to Google Nano Banana or Interactive Simulation)
  const executeGeneration = async (options?: {
    overridePrompt?: string;
    instructionLabel?: string;
    explanationText?: string;
    forceReference?: boolean;
  }) => {
    setIsGenerating(true);
    setErrorMessage(null);

    const promptToSend = (options?.overridePrompt || masterPrompt).trim();
    const shouldUseReference =
      options?.forceReference !== undefined
        ? options.forceReference
        : keepConsistency && Boolean(activeFrame);
    const nextTurnNumber = timeline.length + 1;

    try {
      let generatedFrame: SessionFrame;

      if (!simulationMode && apiKey.trim()) {
        let referencePart = null;
        if (shouldUseReference && activeFrame) {
          if (activeFrame.base64Data) {
            referencePart = {
              mimeType: activeFrame.mimeType || "image/png",
              data: activeFrame.base64Data,
            };
          } else if (activeFrame.imageUrl) {
            referencePart =
              parseDataUrl(activeFrame.imageUrl) ||
              (await imageUrlToInlinePart(activeFrame.imageUrl));
          }
        }

        const liveResult = await generateWithNanoBanana({
          apiKey,
          model,
          prompt: promptToSend,
          referenceImage: referencePart,
        });

        generatedFrame = {
          id: `turn-${Date.now()}`,
          turn: nextTurnNumber,
          imageUrl: liveResult.imageDataUrl,
          mimeType: liveResult.mimeType,
          base64Data: liveResult.base64Data,
          promptUsed: promptToSend,
          instructionUsed:
            options?.instructionLabel ||
            (shouldUseReference
              ? `Multi-Turn Edit on Turn #${activeFrame.turn}`
              : "Direct Initial Generation"),
          explanation: liveResult.modelText || options?.explanationText,
          modelUsed: liveResult.modelUsed,
          mode: "direct-api",
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
      } else {
        const simResult = simulateNanoBananaTurn(nextTurnNumber, promptToSend);
        generatedFrame = {
          id: `sim-turn-${Date.now()}`,
          turn: nextTurnNumber,
          imageUrl: simResult.imageDataUrl,
          mimeType: simResult.mimeType,
          base64Data: simResult.base64Data,
          promptUsed: promptToSend,
          instructionUsed:
            options?.instructionLabel ||
            (shouldUseReference
              ? `Multi-Turn Refinement on Turn #${activeFrame.turn}`
              : "Simulated Initial Generation"),
          explanation: options?.explanationText || simResult.modelText,
          modelUsed: simResult.modelUsed,
          mode: "simulation",
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
      }

      if (googleUser) {
        generatedFrame = await persistTurnToBackend(
          generatedFrame,
          options?.instructionLabel
        );
      }

      setTimeline((prev) => {
        const next = [...prev, generatedFrame];
        setActiveFrameIndex(next.length - 1);
        return next;
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unexpected error while generating image with Nano Banana.";
      setErrorMessage(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Multi-turn Refinement via Python Backend POST /api/interactive/refine + Generation
  const handleRefineAndGenerate = async (instructionText: string) => {
    const cleanInstruction = instructionText.trim();
    if (!cleanInstruction) return;

    setIsGenerating(true);
    setErrorMessage(null);

    const refineRes = await refineWithCopilot({
      current_prompt: activeFrame?.promptUsed || masterPrompt,
      instruction: cleanInstruction,
      style_id: selectedStyleId,
      modifiers: selectedModifiers,
    });

    setCopilotConnected(refineRes.online);
    setMasterPrompt(refineRes.data.refined_prompt);
    if (refineRes.data.next_suggestions?.length > 0) {
      setQuickChips(refineRes.data.next_suggestions);
    }
    setCustomInstruction("");

    const promptForTurn = `${refineRes.data.edit_instruction}\n\nFull Scene Specification: ${refineRes.data.refined_prompt}`;
    await executeGeneration({
      overridePrompt: promptForTurn,
      instructionLabel: cleanInstruction,
      explanationText: refineRes.data.explanation,
      forceReference: true,
    });
  };

  const currentModCategory =
    bootstrapData.modifier_categories.find(
      (c) => c.id === activeModifierCategory
    ) || bootstrapData.modifier_categories[0];

  return (
    <section
      id="interactive-studio"
      className="editorial-section editorial-section-alt"
      aria-labelledby="studio-heading"
    >
      <div className="section-header-row">
        <div>
          <h1 id="studio-heading" className="section-display-title">
            NANO BANANA CREATION STUDIO
          </h1>
        </div>
        <p className="section-lead-copy">
          Craft your scene with the <strong>Python Art-Direction Co-Pilot</strong>
          , generate directly in your browser with{" "}
          <strong>Google Nano Banana</strong>, and publish your favorite turns
          to the <strong>Community Gallery</strong>.
        </p>
      </div>

      {/* COMPACT CREATOR & GALLERY BAR */}
      <div
        className="studio-auth-banner"
        role="region"
        aria-label="Creator Session and Gallery Shortcuts"
      >
        {googleUser ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <img
                src={googleUser.picture}
                alt={googleUser.name}
                className="user-avatar-img"
              />
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  {googleUser.provider === "facebook" ? (
                    <FacebookFLogo size={18} />
                  ) : (
                    <GoogleGLogo size={18} />
                  )}
                  <strong style={{ fontSize: "0.98rem" }}>
                    {googleUser.name}
                  </strong>
                  <span className="backend-status-pill online">
                    {googleUser.id === "usr_local_dev"
                      ? "Local Dev Creator • usr_local_dev"
                      : `${
                          googleUser.provider === "facebook"
                            ? "Facebook"
                            : "Google"
                        } Session • ${googleUser.id}`}
                  </span>
                  {storageStatusBadge && (
                    <span className="persistence-status-toast">
                      {storageStatusBadge}
                    </span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: "0.84rem",
                    color: "var(--text-secondary)",
                    marginTop: "2px",
                  }}
                >
                  Every generated turn is automatically saved to{" "}
                  <strong>PostgreSQL</strong> &amp;{" "}
                  <strong>RustFS Bucket</strong> (your Gemini API Key remains
                  100% in volatile React RAM).
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                id="studio-new-conversation-btn"
                className="interactive-chip selected"
                onClick={handleStartNewConversation}
              >
                + New Session
              </button>
              <button
                type="button"
                id="studio-view-personal-gallery-btn"
                className="interactive-chip"
                onClick={() => router.push("/gallery?tab=personal")}
              >
                My Personal Gallery →
              </button>
              <button
                type="button"
                id="studio-view-public-gallery-btn"
                className="interactive-chip"
                onClick={() => router.push("/gallery")}
              >
                Published Gallery
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <GoogleGLogo size={26} />
                <FacebookFLogo size={26} />
              </div>
              <div>
                <strong style={{ fontSize: "1rem", display: "block" }}>
                  Sign In to Save Conversations (PostgreSQL) &amp; Images
                  (RustFS Bucket)
                </strong>
                <p
                  style={{
                    fontSize: "0.86rem",
                    color: "var(--text-secondary)",
                    maxWidth: "65ch",
                  }}
                >
                  Connect your Google or Facebook account to save your prompt
                  evolution history and publish your creations.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="join-pill-btn"
                onClick={() => router.push("/login")}
                style={{ backgroundColor: "var(--accent-yellow)" }}
              >
                <GoogleGLogo size={18} />
                <span>Sign In on /login ★</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* 2-COLUMN WORKSPACE: LEFT CO-PILOT | RIGHT NANO BANANA CANVAS */}
      <div className="studio-workspace-grid">
        {/* ==================== LEFT COLUMN: PYTHON CO-PILOT & RAM API KEY ==================== */}
        <div className="studio-left-column">
          {/* 1. VOLATILE RAM API KEY CONTROL BAR */}
          <div
            className="ram-key-bar"
            role="region"
            aria-label="Gemini API Key Configuration in Volatile RAM"
          >
            <div className="ram-key-header">
              <span className="ram-key-title">
                <span
                  className={`ram-indicator-dot ${
                    apiKey.trim() ? "connected" : ""
                  }`}
                />
                GOOGLE GEMINI API KEY (NANO BANANA)
              </span>
              <span className="ram-badge">
                RAM-ONLY • React useState • Zero Disk
              </span>
            </div>

            <div className="ram-key-input-row">
              <div className="ram-input-wrapper">
                <input
                  id="gemini-ram-api-key-input"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="Paste your Gemini API Key (AIzaSy...) for direct browser calls"
                  className="ram-password-input"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Gemini API Key in volatile RAM"
                />
              </div>

              <button
                type="button"
                id="toggle-show-api-key-btn"
                className="key-action-btn"
                onClick={() => setShowKey((prev) => !prev)}
              >
                {showKey ? "Hide" : "Show"}
              </button>

              <button
                type="button"
                id="clear-ram-api-key-btn"
                className="key-action-btn danger"
                onClick={handleClearKeyFromRam}
                title="Immediately wipe API Key from volatile RAM"
              >
                Wipe RAM
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <label
                  htmlFor="nanobanana-model-select"
                  style={{ fontSize: "0.78rem", fontWeight: 700 }}
                >
                  Model:
                </label>
                <select
                  id="nanobanana-model-select"
                  value={model}
                  onChange={(e) => setModel(e.target.value as NanoBananaModel)}
                  style={{
                    background: "#1E1E1C",
                    color: "#FFFFFF",
                    border: "1.5px solid rgba(255,255,255,0.28)",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    fontSize: "0.78rem",
                    fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  <option value="gemini-2.5-flash-image">
                    gemini-2.5-flash-image (Nano Banana)
                  </option>
                  <option value="gemini-2.0-flash-exp-image-generation">
                    gemini-2.0-flash-exp-image-generation
                  </option>
                </select>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  color: simulationMode ? "var(--accent-yellow)" : "#FFFFFF",
                  fontWeight: 700,
                }}
              >
                <input
                  id="toggle-simulation-mode-checkbox"
                  type="checkbox"
                  checked={simulationMode}
                  onChange={(e) => setSimulationMode(e.target.checked)}
                  style={{ width: "16px", height: "16px" }}
                />
                <span>
                  {simulationMode
                    ? "Interactive Simulation Mode Active (No API Key Required)"
                    : "Direct Browser → Google Gemini API Call Active"}
                </span>
              </label>
            </div>

            {keyClearedBanner && (
              <p className="ram-security-footnote" role="status">
                ✓ Key wiped from volatile React RAM. Switched back to
                Interactive Simulation Mode.
              </p>
            )}
          </div>

          {/* 2. PYTHON CO-PILOT PANEL */}
          <div className="copilot-panel-card">
            <div className="copilot-panel-header">
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <h2 style={{ fontSize: "1.12rem", fontWeight: 800 }}>
                  1. Visual Concept &amp; Art Direction
                </h2>
                <span
                  className={`backend-status-pill ${
                    copilotConnected ? "online" : ""
                  }`}
                >
                  {copilotConnected
                    ? "● Python Co-Pilot Online (:8000)"
                    : "● Local Heuristic Fallback"}
                </span>
              </div>

              <div className="completeness-meter-wrap">
                <span>Completeness: {analysis.completeness_score}%</span>
                <div className="completeness-bar-track" aria-hidden="true">
                  <div
                    className="completeness-bar-fill"
                    style={{ width: `${analysis.completeness_score}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Starter Ideas */}
            <div className="field-block" style={{ marginBottom: "14px" }}>
              <span className="field-block-title">
                Quick Starter Concepts (1 Click):
              </span>
              <div className="chips-wrap">
                {STARTER_IDEAS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="interactive-chip"
                    onClick={() => {
                      setIdea(preset.idea);
                      runAnalysis(
                        preset.idea,
                        selectedStyleId,
                        selectedModifiers,
                        timeline.length + 1
                      );
                    }}
                  >
                    <span>+ {preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Raw Idea Textarea */}
            <div className="field-block" style={{ marginBottom: "18px" }}>
              <div className="field-label-row">
                <label
                  htmlFor="copilot-idea-input"
                  className="field-block-title"
                >
                  Describe your scene or character in plain English:
                </label>
                <button
                  type="button"
                  id="copilot-analyze-btn"
                  className="interactive-chip selected"
                  style={{ minHeight: "34px", padding: "4px 12px" }}
                  onClick={() =>
                    runAnalysis(
                      idea,
                      selectedStyleId,
                      selectedModifiers,
                      timeline.length + 1
                    )
                  }
                  disabled={isAnalyzing}
                >
                  {isAnalyzing
                    ? "Analyzing..."
                    : "Diagnose with Python Co-Pilot ↻"}
                </button>
              </div>
              <textarea
                id="copilot-idea-input"
                className="studio-textarea"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="E.g., An urban explorer with aviator goggles walking down a sunlit Tokyo street..."
              />

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginTop: "4px",
                }}
              >
                {analysis.detected_dimensions.map((dim) => (
                  <span
                    key={dim}
                    style={{
                      fontSize: "0.73rem",
                      fontWeight: 700,
                      padding: "2px 9px",
                      borderRadius: "999px",
                      background: "#0B0B0B",
                      color: "var(--accent-yellow)",
                    }}
                  >
                    ✓ {dim}
                  </span>
                ))}
                {analysis.missing_dimensions.map((dim) => (
                  <span
                    key={dim}
                    style={{
                      fontSize: "0.73rem",
                      fontWeight: 700,
                      padding: "2px 9px",
                      borderRadius: "999px",
                      border: "1.5px dashed #0B0B0B",
                      color: "var(--text-secondary)",
                    }}
                  >
                    + Suggest {dim}
                  </span>
                ))}
              </div>
            </div>

            {/* Style Presets */}
            <div className="field-block" style={{ marginBottom: "18px" }}>
              <span className="field-block-title">
                2. Base Art Direction Style:
              </span>
              <div className="chips-wrap" role="radiogroup">
                {bootstrapData.style_presets.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedStyleId === style.id}
                    className={`interactive-chip ${
                      selectedStyleId === style.id ? "selected" : ""
                    }`}
                    onClick={() => handleSelectStyle(style.id)}
                  >
                    <span>{style.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Modifier Categories & Chips */}
            <div className="field-block" style={{ marginBottom: "18px" }}>
              <div className="field-label-row">
                <span className="field-block-title">
                  3. Optical, Lighting &amp; Palette Modifiers (
                  {selectedModifiers.length} active):
                </span>
              </div>

              <div
                className="chips-wrap"
                style={{ marginBottom: "8px" }}
                role="tablist"
              >
                {bootstrapData.modifier_categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={activeModifierCategory === cat.id}
                    className={`interactive-chip ${
                      activeModifierCategory === cat.id ? "selected" : ""
                    }`}
                    onClick={() => setActiveModifierCategory(cat.id)}
                  >
                    {cat.title}
                  </button>
                ))}
              </div>

              {currentModCategory && (
                <div className="chips-wrap">
                  {currentModCategory.options.map((opt) => {
                    const isSelected = selectedModifiers.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={isSelected}
                        className={`interactive-chip ${
                          isSelected ? "selected" : ""
                        }`}
                        onClick={() => handleToggleModifier(opt.id)}
                      >
                        <span>
                          {isSelected ? "✓ " : "+ "}
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Guided Questions from Python Co-Pilot */}
            {analysis.guided_questions?.length > 0 && (
              <div className="field-block" style={{ marginBottom: "18px" }}>
                <span className="field-block-title">
                  4. Interactive Questions from Python Co-Pilot (Click to Enrich):
                </span>
                <div className="guided-questions-list">
                  {analysis.guided_questions.map((q) => (
                    <div key={q.id} className="guided-question-card">
                      <div className="guided-q-title">
                        <span>{q.question}</span>
                        <span className="guided-q-dim">{q.dimension}</span>
                      </div>
                      <div className="chips-wrap">
                        {q.options.map((opt) => {
                          const isChosen =
                            answeredQuestions[q.id] === opt.label;
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              className={`interactive-chip ${
                                isChosen ? "selected" : ""
                              }`}
                              onClick={() =>
                                handleAnswerGuidedQuestion(
                                  q.id,
                                  opt.label,
                                  opt.prompt_addition
                                )
                              }
                            >
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3 Curated Variations */}
            {analysis.variations?.length > 0 && (
              <div className="field-block" style={{ marginBottom: "18px" }}>
                <span className="field-block-title">
                  5. Choose a Directorial Variation (or edit the Master Prompt
                  below):
                </span>
                <div className="variations-grid">
                  {analysis.variations.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`variation-card-btn ${
                        activeVariationId === v.id ? "active-variation" : ""
                      }`}
                      onClick={() => {
                        setActiveVariationId(v.id);
                        setMasterPrompt(v.full_prompt);
                      }}
                    >
                      <span className="variation-card-title">{v.title}</span>
                      <span className="variation-card-focus">{v.focus}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Editable Master Prompt + Primary Generate Button */}
            <div className="master-prompt-box">
              <div className="field-label-row">
                <label
                  htmlFor="master-prompt-textarea"
                  className="field-block-title"
                >
                  Optimized Master Prompt (Sent directly to Nano Banana):
                </label>
                <span className="field-hint">Editable before generation</span>
              </div>

              <textarea
                id="master-prompt-textarea"
                className="master-prompt-textarea"
                value={masterPrompt}
                onChange={(e) => setMasterPrompt(e.target.value)}
              />

              <button
                type="button"
                id="generate-nanobanana-primary-btn"
                className="primary-yellow-cta"
                disabled={isGenerating}
                onClick={() => executeGeneration()}
              >
                <span>
                  {isGenerating
                    ? "Generating in Browser with Nano Banana..."
                    : simulationMode
                    ? "★ Generate Frame (Interactive Simulation)"
                    : `★ Generate with Nano Banana (${model})`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ==================== RIGHT COLUMN: LIVE CANVAS & MULTI-TURN REFINEMENT ==================== */}
        <div className="canvas-panel-card">
          <div className="copilot-panel-header">
            <div>
              <h2 style={{ fontSize: "1.12rem", fontWeight: 800 }}>
                Live Canvas &amp; Multi-Turn Evolution
              </h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Turn #{activeFrame.turn} • {activeFrame.instructionUsed}
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {previousFrame && (
                <button
                  type="button"
                  id="toggle-compare-previous-btn"
                  className={`interactive-chip ${
                    comparePrevious ? "selected" : ""
                  }`}
                  style={{ minHeight: "36px", padding: "4px 12px" }}
                  onClick={() => setComparePrevious((prev) => !prev)}
                >
                  {comparePrevious
                    ? "Viewing Previous Turn"
                    : "Compare Before/After"}
                </button>
              )}

              <button
                type="button"
                id="publish-active-frame-btn"
                className={`interactive-chip ${
                  activeFrame.isPublished ? "selected" : ""
                }`}
                style={{ minHeight: "36px", padding: "4px 14px" }}
                disabled={isPublishing}
                onClick={handlePublishActiveFrame}
              >
                {isPublishing
                  ? "Publishing..."
                  : activeFrame.isPublished
                  ? "★ Published in Gallery (Unpublish)"
                  : "★ Publish to Community Gallery"}
              </button>

              <a
                href={activeFrame.imageUrl}
                download={`nanobanana-turn-${activeFrame.turn}.png`}
                className="interactive-chip"
                style={{
                  minHeight: "36px",
                  padding: "4px 12px",
                  textDecoration: "none",
                }}
              >
                Download PNG ↓
              </a>
            </div>
          </div>

          {errorMessage && (
            <div className="editorial-alert" role="alert">
              <strong>Generation Notice:</strong> {errorMessage}
              <div style={{ marginTop: "8px" }}>
                <button
                  type="button"
                  className="interactive-chip"
                  onClick={() => {
                    setSimulationMode(true);
                    setErrorMessage(null);
                  }}
                >
                  Switch to Interactive Simulation Mode
                </button>
              </div>
            </div>
          )}

          {/* Active Image Viewport */}
          <div className="canvas-viewport-frame">
            <div className="canvas-viewport-topbar">
              <span>
                {comparePrevious && previousFrame
                  ? `COMPARING: TURN #${previousFrame.turn} (PREVIOUS)`
                  : `ACTIVE FRAME: TURN #${activeFrame.turn} (${activeFrame.timestamp})`}
              </span>
              <div
                style={{ display: "flex", gap: "10px", alignItems: "center" }}
              >
                {activeFrame.isPublished && (
                  <span
                    style={{
                      background: "var(--accent-yellow)",
                      color: "#0B0B0B",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "0.7rem",
                      fontWeight: 800,
                    }}
                  >
                    PUBLISHED ★
                  </span>
                )}
                {activeFrame.savedToPostgres && (
                  <span
                    style={{
                      background: "rgba(242,250,60,0.18)",
                      color: "var(--accent-yellow)",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "0.7rem",
                      border: "1px solid rgba(242,250,60,0.4)",
                    }}
                  >
                    ✓ Postgres + RustFS
                  </span>
                )}
                <span style={{ color: "var(--accent-yellow)" }}>
                  {activeFrame.modelUsed}
                </span>
              </div>
            </div>

            <div className="canvas-image-stage">
              <img
                src={
                  comparePrevious && previousFrame
                    ? previousFrame.imageUrl
                    : activeFrame.imageUrl
                }
                alt={activeFrame.instructionUsed || "Nano Banana Generated Frame"}
                onError={(e) => {
                  const target = e.currentTarget;
                  const fallback = getShowcaseFallbackDataUrl(
                    activeFrame.imageUrl
                  );
                  if (target.src !== fallback) {
                    target.src = fallback;
                  }
                }}
              />
            </div>
          </div>

          {activeFrame.explanation && (
            <div
              style={{
                background: "var(--bg-surface-elevated)",
                border: "1.5px solid #0B0B0B",
                borderRadius: "12px",
                padding: "10px 14px",
                fontSize: "0.84rem",
                color: "var(--text-secondary)",
              }}
            >
              <strong style={{ color: "var(--text-primary)" }}>
                Turn Art-Direction Note:
              </strong>{" "}
              {activeFrame.explanation}
            </div>
          )}

          {/* Session Filmstrip Timeline */}
          <div className="field-block">
            <div className="field-label-row">
              <span className="field-block-title">
                Session Evolution Timeline ({timeline.length}{" "}
                {timeline.length === 1 ? "turn" : "turns"}):
              </span>
              <span className="field-hint">
                Click any frame to inspect or branch a new edit
              </span>
            </div>

            <div className="timeline-strip" role="list">
              {timeline.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  role="listitem"
                  className={`timeline-thumb-btn ${
                    idx === activeFrameIndex ? "active-thumb" : ""
                  }`}
                  onClick={() => {
                    setActiveFrameIndex(idx);
                    setComparePrevious(false);
                  }}
                >
                  <img
                    src={item.imageUrl}
                    alt={`Turn ${item.turn}`}
                    onError={(e) => {
                      const target = e.currentTarget;
                      const fallback = getShowcaseFallbackDataUrl(item.imageUrl);
                      if (target.src !== fallback) {
                        target.src = fallback;
                      }
                    }}
                  />
                  <span className="timeline-thumb-badge">#{item.turn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Conversational Multi-Turn Refinement Dock */}
          <div
            className="refinement-dock"
            aria-label="Conversational Multi-Turn Refinement Dock"
          >
            <div className="field-label-row">
              <span className="field-block-title">
                Conversational Multi-Turn Refinement (On Turn #
                {activeFrame.turn}):
              </span>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <input
                  id="keep-character-consistency-checkbox"
                  type="checkbox"
                  checked={keepConsistency}
                  onChange={(e) => setKeepConsistency(e.target.checked)}
                />
                <span>Send current image as visual reference (inlineData)</span>
              </label>
            </div>

            <div className="chips-wrap">
              {quickChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className="interactive-chip"
                  disabled={isGenerating}
                  onClick={() => handleRefineAndGenerate(chip.instruction)}
                >
                  <span>✦ {chip.label}</span>
                </button>
              ))}
            </div>

            <form
              className="refinement-input-row"
              onSubmit={(e) => {
                e.preventDefault();
                handleRefineAndGenerate(customInstruction);
              }}
            >
              <input
                id="multi-turn-refine-input"
                type="text"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="Type an edit instruction (e.g., 'Add acid-yellow glasses and neon rain')..."
                className="studio-text-input"
              />
              <button
                type="submit"
                id="multi-turn-refine-submit-btn"
                className="secondary-ink-cta"
                disabled={isGenerating || !customInstruction.trim()}
              >
                <span>Apply Multi-Turn Edit →</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
