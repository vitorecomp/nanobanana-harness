"use client";

import React, { useState } from "react";
import {
  WorkflowStepInfo,
  getShowcaseFallbackDataUrl,
} from "@/features/studio";

interface InteractiveWalkthroughProps {
  steps: WorkflowStepInfo[];
  onLoadStepIntoStudio: (stepData: {
    turn: number;
    idea: string;
    prompt: string;
    imageUrl: string;
  }) => void;
  onExploreGallery: () => void;
}

interface ShowcaseTurn {
  turn: number;
  badge: string;
  title: string;
  subtitle: string;
  completeness: number;
  imageUrl: string;
  idea: string;
  userAction: string;
  masterPrompt: string;
  deltaHighlight: string;
}

const SHOWCASE_TURNS: ShowcaseTurn[] = [
  {
    turn: 1,
    badge: "TURN #1 • BASE CONCEPT",
    title: "Turn 1: Character & Framing",
    subtitle: "step-1-base.png",
    completeness: 64,
    imageUrl: "/showcase/step-1-base.png",
    idea: "Editorial anime explorer wearing an olive utility jacket and aviator goggles on forehead",
    userAction:
      "Initial idea diagnosed by the Python Co-Pilot + 'Editorial Anime (Crypko)' style preset",
    masterPrompt:
      "Portrait of a young anime explorer with copper hair, aviator goggles resting on forehead, olive-green utility jacket over white tee, high-craft editorial anime illustration, crisp cel-shaded ink linework, warm bone backdrop #E9E7DF.",
    deltaHighlight:
      "Base character sheet synthesized from a natural English sentence into optical, linework, and surface tokens.",
  },
  {
    turn: 2,
    badge: "TURN #2 • LIGHTING DIRECTION",
    title: "Turn 2: Golden Hour & Tokyo Street",
    subtitle: "step-2-lighting.png",
    completeness: 86,
    imageUrl: "/showcase/step-2-lighting.png",
    idea: "Editorial anime explorer on a sunlit Tokyo street during golden hour",
    userAction:
      "Guided Co-Pilot chip selected: 'Warm Golden Hour Sunlight' + 35mm Urban Street Perspective",
    masterPrompt:
      "Preserve the character design from Turn #1. Place her on a sunlit Tokyo street during warm golden hour, dramatic long shadows, glowing rim light on copper hair and goggles, power lines against a warm amber-teal sky, crisp cel-shaded anime art.",
    deltaHighlight:
      "Turn #1's image is sent via multimodal inlineData alongside the lighting directive to preserve character identity in a new environment.",
  },
  {
    turn: 3,
    badge: "TURN #3 • MULTI-TURN EDIT",
    title: "Turn 3: Acid-Yellow Visor & Neon Rain",
    subtitle: "step-3-cyber.png",
    completeness: 98,
    imageUrl: "/showcase/step-3-cyber.png",
    idea: "Editorial anime explorer with glowing acid-yellow tactical visor in nocturnal rain",
    userAction:
      "Multi-Turn Quick Refinement: 'Add glowing acid-yellow visor (#F2FA3C) and wet neon reflections'",
    masterPrompt:
      "Preserve the character identity and framing from Turn #2. Transform atmosphere to nocturnal cyberpunk rain, add a glowing translucent acid-yellow (#F2FA3C) tactical visor over eyes, wet jacket reflections, high-contrast ink shadows.",
    deltaHighlight:
      "Surgical multi-turn edit: Nano Banana updates the lighting to nocturnal rain and adds the #F2FA3C visor while retaining the exact character.",
  },
];

export default function InteractiveWalkthrough({
  steps,
  onLoadStepIntoStudio,
  onExploreGallery,
}: InteractiveWalkthroughProps) {
  const [activeTurnIndex, setActiveTurnIndex] = useState<number>(0);
  const currentTurn = SHOWCASE_TURNS[activeTurnIndex];

  return (
    <section
      id="how-it-works"
      className="editorial-section"
      aria-labelledby="walkthrough-heading"
    >
      <div className="section-header-row">
        <div>
          <h2 id="walkthrough-heading" className="section-display-title">
            HOW INTERACTIVE CREATION WORKS
          </h2>
        </div>
        <p className="section-lead-copy">
          Instead of demanding complex prompt engineering upfront, Nano Banana
          Studio pairs a <strong>Python Art-Direction Co-Pilot</strong> with
          direct browser-to-API multimodal calls to{" "}
          <strong>Google Nano Banana</strong>.
        </p>
      </div>

      <div className="evolution-showcase-layout">
        {/* LEFT: 4-Stage Interactive Loop Explanation */}
        <div className="workflow-steps-stack" role="list">
          {steps.map((s, idx) => {
            const isHighlighted =
              (activeTurnIndex === 0 && (s.step === 1 || s.step === 2)) ||
              (activeTurnIndex === 1 && s.step === 3) ||
              (activeTurnIndex === 2 && s.step === 4);
            return (
              <div
                key={s.step || idx}
                role="listitem"
                className={`workflow-step-row ${
                  isHighlighted ? "active-step" : ""
                }`}
              >
                <div className="workflow-step-top">
                  <h3 className="workflow-step-title">
                    0{s.step}. {s.title}
                  </h3>
                  <span className="workflow-step-badge">{s.subtitle}</span>
                </div>
                <p className="workflow-step-desc">{s.description}</p>
              </div>
            );
          })}
        </div>

        {/* RIGHT: Interactive 3-Turn Visual Evolution Simulator */}
        <div
          id="interactive-flow"
          className="evolution-interactive-stage"
          aria-label="Interactive 3-Turn Visual Evolution Simulator"
        >
          <div
            className="evolution-turn-tabs"
            role="tablist"
            aria-label="Select image evolution turn"
          >
            {SHOWCASE_TURNS.map((item, idx) => (
              <button
                key={item.turn}
                type="button"
                role="tab"
                id={`walkthrough-tab-${item.turn}`}
                aria-selected={activeTurnIndex === idx}
                className="evolution-turn-btn"
                onClick={() => setActiveTurnIndex(idx)}
              >
                <span>{item.title}</span>
                <span className="turn-sub">
                  Completeness: {item.completeness}%
                </span>
              </button>
            ))}
          </div>

          <div className="evolution-preview-media">
            <img
              src={currentTurn.imageUrl}
              alt={currentTurn.title}
              className="evolution-preview-img"
              onError={(e) => {
                const target = e.currentTarget;
                const fallback = getShowcaseFallbackDataUrl(
                  currentTurn.imageUrl
                );
                if (target.src !== fallback) {
                  target.src = fallback;
                }
              }}
            />
            <span className="evolution-overlay-pill">{currentTurn.badge}</span>
            <span className="evolution-score-pill">
              SCORE {currentTurn.completeness}/100
            </span>
          </div>

          <div className="evolution-prompt-box">
            <span className="evolution-prompt-label">
              CREATOR ACTION: {currentTurn.userAction}
            </span>
            <code className="evolution-prompt-code">
              {currentTurn.masterPrompt}
            </code>
          </div>

          <p
            style={{
              fontSize: "0.88rem",
              color: "var(--text-secondary)",
              marginBottom: "16px",
              maxWidth: "65ch",
            }}
          >
            <strong>What changed in this turn:</strong>{" "}
            {currentTurn.deltaHighlight}
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                id="walkthrough-next-turn-btn"
                className="secondary-ink-cta"
                onClick={() =>
                  setActiveTurnIndex(
                    (prev) => (prev + 1) % SHOWCASE_TURNS.length
                  )
                }
              >
                <span>
                  {activeTurnIndex < SHOWCASE_TURNS.length - 1
                    ? `Preview Next Turn (#${activeTurnIndex + 2}) →`
                    : "Back to Turn #1 ↺"}
                </span>
              </button>

              <button
                type="button"
                id="walkthrough-open-gallery-btn"
                className="secondary-ink-cta"
                onClick={onExploreGallery}
              >
                <span>Browse Published Gallery</span>
              </button>
            </div>

            <button
              type="button"
              id="walkthrough-load-into-studio-btn"
              className="explore-download-pill"
              onClick={() =>
                onLoadStepIntoStudio({
                  turn: currentTurn.turn,
                  idea: currentTurn.idea,
                  prompt: currentTurn.masterPrompt,
                  imageUrl: currentTurn.imageUrl,
                })
              }
            >
              <span>Remix This Frame in Studio</span>
              <span className="explore-pill-yellow-circle" aria-hidden="true">
                ★
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
