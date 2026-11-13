"use client";

import React, { useState, useEffect, useRef } from "react";
import { GoogleUserProfile } from "../types/auth.types";
import { useStudioSession } from "@/core/context/StudioSessionContext";
import {
  DEFAULT_ENHANCE_SYSTEM_PROMPT,
  DEFAULT_VARIATION_SYSTEM_PROMPT,
} from "@/features/studio";
import {
  DEFAULT_HARNESS_CRITIC_PROMPT,
  DEFAULT_HARNESS_PLANNER_PROMPT,
  DEFAULT_HARNESS_REFINER_PROMPT,
} from "@/features/harness";
import {
  IconClose,
  IconRefresh,
} from "@/shared/components/icons/AtelierIcons";
import { useDialogFocusTrap } from "@/shared/hooks/useDialogFocusTrap";

export interface ProfileEditModalProps {
  isOpen: boolean;
  initialSection?: "profile" | "vault";
  user: GoogleUserProfile;
  onClose: () => void;
  onSave: (updatedUser: GoogleUserProfile) => void;
}

export default function ProfileEditModal({
  isOpen,
  onClose,
}: ProfileEditModalProps) {
  const {
    apiKey,
    setApiKey,
    rememberKeyInVault,
    setRememberKeyInVault,
    themeMode,
    setThemeMode,
    imagesOutputDir,
    setImagesOutputDir,
    enhanceSystemPrompt,
    variationSystemPrompt,
    harnessPlannerPrompt,
    harnessCriticPrompt,
    harnessRefinerPrompt,
    harnessDefaultSteps,
    saveAiSystemPrompts,
  } = useStudioSession();

  const [showKey, setShowKey] = useState<boolean>(false);
  const [dirInput, setDirInput] = useState<string>(imagesOutputDir);
  const [harnessStepsInput, setHarnessStepsInput] = useState<number>(
    harnessDefaultSteps || 4
  );
  const [enhancePromptInput, setEnhancePromptInput] =
    useState<string>(enhanceSystemPrompt);
  const [variationPromptInput, setVariationPromptInput] = useState<string>(
    variationSystemPrompt
  );
  const [plannerPromptInput, setPlannerPromptInput] =
    useState<string>(harnessPlannerPrompt);
  const [criticPromptInput, setCriticPromptInput] =
    useState<string>(harnessCriticPrompt);
  const [refinerPromptInput, setRefinerPromptInput] =
    useState<string>(harnessRefinerPrompt);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const settingsDialogRef = useRef<HTMLDivElement | null>(null);
  useDialogFocusTrap(
    settingsDialogRef,
    isOpen,
    () => {
      if (!isSaving) onClose();
    },
    !isSaving
  );

  useEffect(() => {
    if (!isOpen) return;
    setDirInput(imagesOutputDir);
    setHarnessStepsInput(harnessDefaultSteps || 4);
    setEnhancePromptInput(enhanceSystemPrompt);
    setVariationPromptInput(variationSystemPrompt);
    setPlannerPromptInput(harnessPlannerPrompt);
    setCriticPromptInput(harnessCriticPrompt);
    setRefinerPromptInput(harnessRefinerPrompt);
  }, [
    isOpen,
    imagesOutputDir,
    harnessDefaultSteps,
    enhanceSystemPrompt,
    variationSystemPrompt,
    harnessPlannerPrompt,
    harnessCriticPrompt,
    harnessRefinerPrompt,
  ]);

  if (!isOpen) return null;

  const isEnhanceCustom =
    enhancePromptInput.trim() !== DEFAULT_ENHANCE_SYSTEM_PROMPT.trim();
  const isVariationCustom =
    variationPromptInput.trim() !== DEFAULT_VARIATION_SYSTEM_PROMPT.trim();
  const isPlannerCustom =
    plannerPromptInput.trim() !== DEFAULT_HARNESS_PLANNER_PROMPT.trim();
  const isCriticCustom =
    criticPromptInput.trim() !== DEFAULT_HARNESS_CRITIC_PROMPT.trim();
  const isRefinerCustom =
    refinerPromptInput.trim() !== DEFAULT_HARNESS_REFINER_PROMPT.trim();
  const isHarnessStepsCustom = harnessStepsInput !== 4;

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      await Promise.all([
        setImagesOutputDir(dirInput),
        saveAiSystemPrompts({
          enhanceSystemPrompt: enhancePromptInput,
          variationSystemPrompt: variationPromptInput,
          harnessPlannerPrompt: plannerPromptInput,
          harnessCriticPrompt: criticPromptInput,
          harnessRefinerPrompt: refinerPromptInput,
          harnessDefaultSteps: harnessStepsInput,
        }),
      ]);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      ref={settingsDialogRef}
      data-atelier-modal="true"
      className="ref-modal-backdrop ref-settings-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="config-vault-modal-title"
      tabIndex={-1}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <form
        className="ref-modal-card ref-settings-modal-card"
        onSubmit={handleSaveConfig}
      >
        <div className="ref-modal-header">
          <div className="ref-settings-title-group">
            <h2 id="config-vault-modal-title" className="ref-soft-card-title">
              Studio Settings
            </h2>
            <span className="ref-settings-subtitle">
              Appearance, API credentials, local storage & AI prompt
              instructions
            </span>
          </div>

          <button
            type="button"
            className="ref-circle-icon-btn md"
            onClick={onClose}
            aria-label="Close settings modal"
          >
            <IconClose size={12} />
          </button>
        </div>

        <div className="ref-settings-body">
          {/* SECTION 1: API KEY & OUTPUT DIRECTORY */}
          <section
            className="ref-settings-section"
            aria-label="API and Storage"
          >
            <div className="ref-settings-two-col">
              <div className="ref-settings-field-col">
                <label
                  htmlFor="modal-gemini-api-key-input"
                  className="ref-field-label"
                >
                  Gemini API Key (gemini-2.5-flash-image)
                </label>
                <div className="ref-settings-key-row">
                  <input
                    id="modal-gemini-api-key-input"
                    type={showKey ? "text" : "password"}
                    className="ref-input ref-settings-key-input"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your AIzaSy... key"
                  />
                  <button
                    type="button"
                    className="ref-pill-chip"
                    onClick={() => setShowKey((prev) => !prev)}
                  >
                    {showKey ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    className="ref-pill-chip"
                    onClick={() => setApiKey("")}
                  >
                    Clear
                  </button>
                </div>

                <div className="ref-toggle-switch-row ref-settings-vault-toggle">
                  <div className="ref-toggle-switch-copy">
                    <label
                      htmlFor="toggle-remember-api-key"
                      className="ref-toggle-switch-title"
                    >
                      Save API Key in local SQLite vault
                    </label>
                    <span className="ref-toggle-switch-sub">
                      Keep key persisted locally across Studio restarts
                    </span>
                  </div>
                  <button
                    id="toggle-remember-api-key"
                    type="button"
                    role="switch"
                    aria-checked={rememberKeyInVault}
                    className={`ref-atelier-switch ${
                      rememberKeyInVault ? "is-on" : ""
                    }`}
                    onClick={() => setRememberKeyInVault(!rememberKeyInVault)}
                  >
                    <span className="ref-atelier-switch-thumb" />
                  </button>
                </div>

                <div className="ref-toggle-switch-row ref-settings-vault-toggle">
                  <div className="ref-toggle-switch-copy">
                    <label
                      htmlFor="toggle-dark-theme"
                      className="ref-toggle-switch-title"
                    >
                      Dark Theme
                    </label>
                    <span className="ref-toggle-switch-sub">
                      Switch workspace surfaces to the Cool-Slate dark palette
                    </span>
                  </div>
                  <button
                    id="toggle-dark-theme"
                    type="button"
                    role="switch"
                    aria-checked={themeMode === "dark"}
                    className={`ref-atelier-switch ${
                      themeMode === "dark" ? "is-on" : ""
                    }`}
                    onClick={() =>
                      setThemeMode(themeMode === "dark" ? "light" : "dark")
                    }
                  >
                    <span className="ref-atelier-switch-thumb" />
                  </button>
                </div>
              </div>

              <div className="ref-settings-field-col">
                <label
                  htmlFor="modal-images-output-dir-input"
                  className="ref-field-label"
                >
                  Generated Images Directory
                </label>
                <input
                  id="modal-images-output-dir-input"
                  type="text"
                  className="ref-input"
                  value={dirInput}
                  onChange={(e) => setDirInput(e.target.value)}
                  placeholder="e.g. ~/Pictures/nanobanana"
                />
                <span className="ref-settings-helper-note">
                  All generated frames are automatically saved as PNG files in
                  this local folder, organized per project.
                </span>

                <div className="ref-settings-prompt-label-bar">
                  <div className="ref-settings-prompt-label-left">
                    <label
                      htmlFor="modal-harness-default-steps-select"
                      className="ref-field-label ref-no-margin"
                    >
                      Goal Harness Default Steps (3–10)
                    </label>
                    <span
                      className={`ref-settings-status-badge ${
                        isHarnessStepsCustom ? "is-custom" : ""
                      }`}
                    >
                      {isHarnessStepsCustom
                        ? `Custom (${harnessStepsInput})`
                        : "Default (4)"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ref-settings-reset-link"
                    disabled={!isHarnessStepsCustom}
                    onClick={() => setHarnessStepsInput(4)}
                  >
                    Reset
                  </button>
                </div>

                <select
                  id="modal-harness-default-steps-select"
                  className="ref-harness-select full"
                  value={harnessStepsInput}
                  onChange={(e) =>
                    setHarnessStepsInput(
                      Math.min(10, Math.max(3, Number(e.target.value) || 4))
                    )
                  }
                >
                  {[3, 4, 5, 6, 7, 8, 9, 10].map((stepCount) => (
                    <option key={stepCount} value={stepCount}>
                      {stepCount} Steps / Rounds
                      {stepCount === 4 ? " (System Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* SECTION 2: AI PROMPT PARAMETERS (ENHANCEMENT & VARIATION) */}
          <section
            className="ref-settings-section ref-settings-prompts-section"
            aria-labelledby="settings-ai-prompts-heading"
          >
            <div className="ref-settings-section-header">
              <div className="ref-settings-section-heading-group">
                <h3
                  id="settings-ai-prompts-heading"
                  className="ref-settings-section-title"
                >
                  AI Prompt Parameters
                </h3>
                <span className="ref-settings-helper-note">
                  System instructions sent to Gemini for Step 02 (Enhancement)
                  and Step 03 (Variations).
                </span>
              </div>

              {(isEnhanceCustom ||
                isVariationCustom ||
                isPlannerCustom ||
                isCriticCustom ||
                isRefinerCustom ||
                isHarnessStepsCustom) && (
                <button
                  type="button"
                  id="settings-restore-all-prompts-btn"
                  className="ref-studio-ghost-action"
                  onClick={() => {
                    setEnhancePromptInput(DEFAULT_ENHANCE_SYSTEM_PROMPT);
                    setVariationPromptInput(DEFAULT_VARIATION_SYSTEM_PROMPT);
                    setPlannerPromptInput(DEFAULT_HARNESS_PLANNER_PROMPT);
                    setCriticPromptInput(DEFAULT_HARNESS_CRITIC_PROMPT);
                    setRefinerPromptInput(DEFAULT_HARNESS_REFINER_PROMPT);
                    setHarnessStepsInput(4);
                  }}
                >
                  <IconRefresh size={12} />
                  <span>Restore Defaults</span>
                </button>
              )}
            </div>

            <div className="ref-settings-two-col">
              {/* PARAMETER 1: ENHANCEMENT PROMPT (STEP 02) */}
              <div className="ref-settings-field-col">
                <div className="ref-settings-prompt-label-bar">
                  <div className="ref-settings-prompt-label-left">
                    <label
                      htmlFor="settings-enhance-prompt-textarea"
                      className="ref-field-label ref-no-margin"
                    >
                      Enhancement Prompt
                    </label>
                    <span
                      className={`ref-settings-status-badge ${
                        isEnhanceCustom ? "is-custom" : ""
                      }`}
                    >
                      {isEnhanceCustom ? "Custom" : "Default"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="ref-settings-reset-link"
                    disabled={!isEnhanceCustom}
                    onClick={() =>
                      setEnhancePromptInput(DEFAULT_ENHANCE_SYSTEM_PROMPT)
                    }
                  >
                    Reset
                  </button>
                </div>

                <textarea
                  id="settings-enhance-prompt-textarea"
                  className="ref-params-textarea ref-settings-prompt-textarea"
                  rows={6}
                  value={enhancePromptInput}
                  onChange={(e) => setEnhancePromptInput(e.target.value)}
                  placeholder="Enter the system prompt used to enhance user prompts..."
                />

                <span className="ref-settings-helper-note">
                  Used in Step 02 when &ldquo;Enhance prompt with AI&rdquo; is
                  enabled. Supports optional{" "}
                  <code>{"{{prompt}}"}</code>, <code>{"{{modifiers}}"}</code>,{" "}
                  <code>{"{{aspect_ratio}}"}</code>.
                </span>
              </div>

              {/* PARAMETER 2: VARIATION PROMPT (STEP 03) */}
              <div className="ref-settings-field-col">
                <div className="ref-settings-prompt-label-bar">
                  <div className="ref-settings-prompt-label-left">
                    <label
                      htmlFor="settings-variation-prompt-textarea"
                      className="ref-field-label ref-no-margin"
                    >
                      Variation Prompt
                    </label>
                    <span
                      className={`ref-settings-status-badge ${
                        isVariationCustom ? "is-custom" : ""
                      }`}
                    >
                      {isVariationCustom ? "Custom" : "Default"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="ref-settings-reset-link"
                    disabled={!isVariationCustom}
                    onClick={() =>
                      setVariationPromptInput(DEFAULT_VARIATION_SYSTEM_PROMPT)
                    }
                  >
                    Reset
                  </button>
                </div>

                <textarea
                  id="settings-variation-prompt-textarea"
                  className="ref-params-textarea ref-settings-prompt-textarea"
                  rows={6}
                  value={variationPromptInput}
                  onChange={(e) => setVariationPromptInput(e.target.value)}
                  placeholder="Enter the system prompt used to generate prompt variations..."
                />

                <span className="ref-settings-helper-note">
                  Used in Step 03 when &ldquo;Vary prompt using AI&rdquo; is
                  enabled for 2–8 images. Supports optional{" "}
                  <code>{"{{count}}"}</code>, <code>{"{{prompt}}"}</code>.
                </span>
              </div>
            </div>

            {/* HARNESS AGENT PROMPTS (PLANNER, CRITIC, TRACE REFINER) */}
            <div className="ref-settings-three-col">
              {/* PARAMETER 3: HARNESS PLANNER PROMPT */}
              <div className="ref-settings-field-col">
                <div className="ref-settings-prompt-label-bar">
                  <div className="ref-settings-prompt-label-left">
                    <label
                      htmlFor="settings-harness-planner-textarea"
                      className="ref-field-label ref-no-margin"
                    >
                      Harness Planner Prompt
                    </label>
                    <span
                      className={`ref-settings-status-badge ${
                        isPlannerCustom ? "is-custom" : ""
                      }`}
                    >
                      {isPlannerCustom ? "Custom" : "Default"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="ref-settings-reset-link"
                    disabled={!isPlannerCustom}
                    onClick={() =>
                      setPlannerPromptInput(DEFAULT_HARNESS_PLANNER_PROMPT)
                    }
                  >
                    Reset
                  </button>
                </div>

                <textarea
                  id="settings-harness-planner-textarea"
                  className="ref-params-textarea ref-settings-prompt-textarea"
                  rows={5}
                  value={plannerPromptInput}
                  onChange={(e) => setPlannerPromptInput(e.target.value)}
                  placeholder="System prompt for Goal Harness Planner agent..."
                />

                <span className="ref-settings-helper-note">
                  Decomposes goals into deliverables, pack invariants & weighted
                  rubric.
                </span>
              </div>

              {/* PARAMETER 4: HARNESS CRITIC PROMPT */}
              <div className="ref-settings-field-col">
                <div className="ref-settings-prompt-label-bar">
                  <div className="ref-settings-prompt-label-left">
                    <label
                      htmlFor="settings-harness-critic-textarea"
                      className="ref-field-label ref-no-margin"
                    >
                      Harness Critic Prompt
                    </label>
                    <span
                      className={`ref-settings-status-badge ${
                        isCriticCustom ? "is-custom" : ""
                      }`}
                    >
                      {isCriticCustom ? "Custom" : "Default"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="ref-settings-reset-link"
                    disabled={!isCriticCustom}
                    onClick={() =>
                      setCriticPromptInput(DEFAULT_HARNESS_CRITIC_PROMPT)
                    }
                  >
                    Reset
                  </button>
                </div>

                <textarea
                  id="settings-harness-critic-textarea"
                  className="ref-params-textarea ref-settings-prompt-textarea"
                  rows={5}
                  value={criticPromptInput}
                  onChange={(e) => setCriticPromptInput(e.target.value)}
                  placeholder="System prompt for Goal Harness Multimodal Critic..."
                />

                <span className="ref-settings-helper-note">
                  Executes Hard-Failure Gate, rubric scoring (0–100) &
                  complaints.
                </span>
              </div>

              {/* PARAMETER 5: HARNESS REFINER PROMPT */}
              <div className="ref-settings-field-col">
                <div className="ref-settings-prompt-label-bar">
                  <div className="ref-settings-prompt-label-left">
                    <label
                      htmlFor="settings-harness-refiner-textarea"
                      className="ref-field-label ref-no-margin"
                    >
                      Harness Refiner Prompt
                    </label>
                    <span
                      className={`ref-settings-status-badge ${
                        isRefinerCustom ? "is-custom" : ""
                      }`}
                    >
                      {isRefinerCustom ? "Custom" : "Default"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="ref-settings-reset-link"
                    disabled={!isRefinerCustom}
                    onClick={() =>
                      setRefinerPromptInput(DEFAULT_HARNESS_REFINER_PROMPT)
                    }
                  >
                    Reset
                  </button>
                </div>

                <textarea
                  id="settings-harness-refiner-textarea"
                  className="ref-params-textarea ref-settings-prompt-textarea"
                  rows={5}
                  value={refinerPromptInput}
                  onChange={(e) => setRefinerPromptInput(e.target.value)}
                  placeholder="System prompt for TRACE attribution & prompt refiner..."
                />

                <span className="ref-settings-helper-note">
                  Diagnoses TRACE root causes & evolves next-round prompts.
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="ref-settings-footer">
          <button
            type="button"
            className="ref-mura-btn-outline lg"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>

          <button
            type="submit"
            id="save-studio-settings-btn"
            className="ref-dark-pill-btn"
            disabled={isSaving}
          >
            <span>{isSaving ? "Saving..." : "Save Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
