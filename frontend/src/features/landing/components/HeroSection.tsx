"use client";

import React from "react";

interface HeroSectionProps {
  onExploreGallery: () => void;
  onOpenStudio: (presetIdea?: string) => void;
}

export default function HeroSection({
  onExploreGallery,
  onOpenStudio,
}: HeroSectionProps) {
  // Exact chamfered path for Bottom-Left Scene Card (560 x 356):
  // Top-left rounded (r=22), Top-right 45deg chamfer (64px), Bottom-right rounded (r=22), Bottom-left 45deg chamfer (64px)
  const sceneCardPath =
    "M 24 2 H 494 L 558 66 V 332 Q 558 354 536 354 H 66 L 2 290 V 24 Q 2 2 24 2 Z";

  // Exact chamfered path for Top-Right Portrait Card (320 x 396):
  // Top-left 45deg chamfer (62px), other 3 corners rounded (r=20)
  const portraitCardPath =
    "M 64 2 H 298 Q 318 2 318 22 V 374 Q 318 394 298 394 H 22 Q 2 394 2 374 V 64 Z";

  return (
    <section
      className="hero-stage"
      aria-label="Nano Banana Studio Hero Showcase"
    >
      {/* LEFT COLUMN: Massive Condensed Uppercase Title + Chamfered Scene Card */}
      <div className="hero-left-column">
        <h1 className="hero-display-headline">
          <span>INTERACTIVE CREATION</span>
          <span>WITH NANO BANANA</span>
        </h1>

        <div className="hero-scene-card-wrapper">
          <svg
            viewBox="0 0 560 356"
            className="hero-scene-svg-frame"
            role="img"
            aria-label="Editorial anime street scene created interactively with Nano Banana"
          >
            <defs>
              <clipPath id="scene-chamfer-clip">
                <path d={sceneCardPath} />
              </clipPath>
            </defs>

            <g clipPath="url(#scene-chamfer-clip)">
              {/* Rich Editorial SVG Fallback Layer underneath /showcase/hero-scene.png */}
              <rect width="560" height="356" fill="#A8CFCB" />
              <rect x="0" y="180" width="560" height="176" fill="#E6DEC8" />
              <path
                d="M0 155 Q 140 135 280 152 T 560 145 L 560 220 L 0 220 Z"
                fill="#D8E5DF"
              />
              <polygon
                points="0,70 135,140 135,356 0,356"
                fill="#8E6C68"
                stroke="#0B0B0B"
                strokeWidth="2.5"
              />
              <polygon
                points="420,45 560,0 560,356 420,356"
                fill="#D9B89C"
                stroke="#0B0B0B"
                strokeWidth="2.5"
              />
              <line
                x1="72"
                y1="10"
                x2="72"
                y2="356"
                stroke="#C5D4CE"
                strokeWidth="5"
              />
              <line
                x1="0"
                y1="45"
                x2="430"
                y2="135"
                stroke="#5A716E"
                strokeWidth="1.5"
              />
              <g transform="translate(115, 58)">
                <path
                  d="M25 298 L45 145 L145 145 L165 298 Z"
                  fill="#40565E"
                  stroke="#0B0B0B"
                  strokeWidth="3"
                />
                <path
                  d="M65 145 L95 298 L125 145 Z"
                  fill="#F3F1EA"
                  stroke="#0B0B0B"
                  strokeWidth="2.5"
                />
                <circle
                  cx="95"
                  cy="88"
                  r="34"
                  fill="#F7DEC8"
                  stroke="#0B0B0B"
                  strokeWidth="3"
                />
              </g>
              <g transform="translate(275, 92)">
                <path
                  d="M20 264 L36 125 L130 125 L148 264 Z"
                  fill="#D6B57C"
                  stroke="#0B0B0B"
                  strokeWidth="3"
                />
                <circle
                  cx="84"
                  cy="74"
                  r="30"
                  fill="#F7DEC8"
                  stroke="#0B0B0B"
                  strokeWidth="3"
                />
              </g>

              {/* Live Showcase Asset from /showcase/hero-scene.png */}
              <image
                href="/showcase/hero-scene.png"
                x="0"
                y="0"
                width="560"
                height="356"
                preserveAspectRatio="xMidYMid slice"
              />
            </g>

            {/* Continuous Carbon-Black Chamfered Frame Stroke */}
            <path
              d={sceneCardPath}
              fill="none"
              stroke="#0B0B0B"
              strokeWidth="3"
            />
          </svg>

          {/* Overlapping Right-Edge Acid-Yellow Vertical Pill ("CREATE ANIME") */}
          <button
            type="button"
            id="hero-create-now-btn"
            className="create-vertical-pill"
            onClick={() =>
              onOpenStudio(
                "Two urban explorers walking down a sunlit avenue beneath a pastel teal sky, high-craft cel-shaded editorial anime aesthetic"
              )
            }
            title="Open the Creation Studio with this scene concept"
          >
            <svg
              width="30"
              height="26"
              viewBox="0 0 30 26"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="2"
                y="7"
                width="14"
                height="14"
                rx="3"
                transform="rotate(-12 2 7)"
                fill="#0B0B0B"
              />
              <circle cx="7" cy="11" r="1.4" fill="#F2FA3C" />
              <circle cx="11" cy="15" r="1.4" fill="#F2FA3C" />
              <rect
                x="14"
                y="4"
                width="14"
                height="14"
                rx="3"
                transform="rotate(14 14 4)"
                fill="#0B0B0B"
                stroke="#F2FA3C"
                strokeWidth="1.2"
              />
              <circle cx="19" cy="10" r="1.3" fill="#F2FA3C" />
              <circle cx="23" cy="12" r="1.3" fill="#F2FA3C" />
              <circle cx="18" cy="15" r="1.3" fill="#F2FA3C" />
            </svg>
            <span className="create-vertical-pill-label">
              CREATE
              <br />
              ANIME
            </span>
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: Chamfered Portrait Card with Acid-Yellow Strip + Folder-Tabbed Info Card */}
      <div className="hero-right-column">
        <div className="portrait-card-outer">
          <svg
            viewBox="0 0 320 396"
            className="portrait-svg-frame"
            role="img"
            aria-label="Editorial anime character portrait with acid-yellow graphic strip"
          >
            <defs>
              <clipPath id="portrait-chamfer-clip">
                <path d={portraitCardPath} />
              </clipPath>
              <clipPath id="portrait-art-area-clip">
                <rect x="0" y="0" width="274" height="396" />
              </clipPath>
            </defs>

            <g clipPath="url(#portrait-chamfer-clip)">
              <g clipPath="url(#portrait-art-area-clip)">
                <rect x="0" y="0" width="274" height="396" fill="#E3DFD3" />
                <path
                  d="M45 396 L68 235 Q137 210 206 235 L229 396 Z"
                  fill="#5E7A6E"
                  stroke="#0B0B0B"
                  strokeWidth="3"
                />
                <path
                  d="M92 230 L137 396 L182 230 Z"
                  fill="#FFFFFF"
                  stroke="#0B0B0B"
                  strokeWidth="2.5"
                />
                <circle
                  cx="137"
                  cy="148"
                  r="48"
                  fill="#FADEC8"
                  stroke="#0B0B0B"
                  strokeWidth="3"
                />
                <image
                  href="/showcase/hero-portrait.png"
                  x="0"
                  y="0"
                  width="274"
                  height="396"
                  preserveAspectRatio="xMidYMid slice"
                />
              </g>

              {/* Right Acid-Yellow Vertical Strip (#F2FA3C, width: 46px) from ref.jpg */}
              <rect x="274" y="0" width="46" height="396" fill="#F2FA3C" />
              <line
                x1="274"
                y1="0"
                x2="274"
                y2="396"
                stroke="#0B0B0B"
                strokeWidth="2"
              />

              {/* Top Two Stacked Black Stars (★ ★) */}
              <text
                x="297"
                y="42"
                textAnchor="middle"
                fill="#0B0B0B"
                fontSize="16"
                fontWeight="900"
              >
                ★
              </text>
              <text
                x="297"
                y="66"
                textAnchor="middle"
                fill="#0B0B0B"
                fontSize="16"
                fontWeight="900"
              >
                ★
              </text>

              {/* Bottom Upward Arrow (↑) */}
              <line
                x1="297"
                y1="370"
                x2="297"
                y2="338"
                stroke="#0B0B0B"
                strokeWidth="2"
              />
              <polyline
                points="291,346 297,337 303,346"
                fill="none"
                stroke="#0B0B0B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* Continuous Carbon-Black Outer Stroke */}
            <path
              d={portraitCardPath}
              fill="none"
              stroke="#0B0B0B"
              strokeWidth="3"
            />
          </svg>
        </div>

        {/* BOTTOM-RIGHT FOLDER-TABBED WHITE INFO CARD WITH BLACK ••• TAB */}
        <div className="folder-card-container">
          <div className="folder-raised-left-tab" aria-hidden="true">
            <svg
              className="folder-tab-diagonal-shoulder"
              viewBox="0 0 28 28"
              fill="none"
            >
              <path d="M 0 0 L 26 27 L 0 27 Z" fill="#FFFFFF" />
              <path
                d="M 0 0.75 L 25.5 26.5"
                stroke="#0B0B0B"
                strokeWidth="1.6"
              />
            </svg>
          </div>

          <div className="folder-black-dots-tab" aria-hidden="true">
            <span className="folder-dot-circle" />
            <span className="folder-dot-circle" />
            <span className="folder-dot-circle" />
          </div>

          <div className="folder-card-surface">
            <h2 className="folder-card-title">
              INTERACTIVE ART DIRECTION &amp; ZERO-STORAGE KEY
            </h2>
            <p className="folder-card-copy">
              Our Python Co-Pilot structures your visual art direction step by
              step while your browser calls Google Nano Banana (
              <code>gemini-2.5-flash-image</code>) directly from volatile RAM —
              explore published community generations or craft your own.
            </p>

            <div className="folder-card-footer">
              <div
                className="overlapping-tech-badges"
                aria-label="Core Stack: Python Co-Pilot and Google Nano Banana"
              >
                <span
                  className="tech-circle-badge"
                  title="Python Interactive Co-Pilot (Flask + SQLAlchemy)"
                >
                  PY
                </span>
                <span
                  className="tech-circle-badge"
                  title="Direct Browser Call to Google Gemini Nano Banana"
                >
                  NB✦
                </span>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  id="hero-published-gallery-btn"
                  className="explore-download-pill"
                  onClick={onExploreGallery}
                >
                  <span>Published Gallery</span>
                  <span
                    className="explore-pill-yellow-circle"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </button>

                <button
                  type="button"
                  id="hero-explore-studio-btn"
                  className="explore-download-pill"
                  onClick={() => onOpenStudio()}
                >
                  <span>Creation Studio</span>
                  <span
                    className="explore-pill-yellow-circle"
                    aria-hidden="true"
                  >
                    ★
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
