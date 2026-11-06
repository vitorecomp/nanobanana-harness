"use client";

import React, { ReactNode, Suspense, useState } from "react";
import Navbar from "./Navbar";
import {
  closeAppWindow,
  minimizeAppWindow,
  toggleMaximizeAppWindow,
} from "@/core/tauri/tauriBridge";

export default function AppShell({ children }: { children: ReactNode }) {
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  return (
    <div className="ref-desktop-shell">
      {/* TOP OXFORD BLUE WINDOW FRAME BAR WITH CUSTOM WINDOW CONTROLS */}
      <header
        className="ref-window-titlebar"
        data-tauri-drag-region
        onDoubleClick={async () => {
          const next = await toggleMaximizeAppWindow();
          setIsMaximized(next);
        }}
      >
        <div className="ref-window-titlebar-left" data-tauri-drag-region>
          <span className="ref-window-brand-dot" aria-hidden="true" />
          <span className="ref-window-title-text" data-tauri-drag-region>
            NANO BANANA // ATELIER STUDIO
          </span>
        </div>

        <div
          className="ref-window-controls"
          role="group"
          aria-label="Window Controls"
        >
          <button
            type="button"
            className="ref-win-control-btn minimize"
            onClick={() => void minimizeAppWindow()}
            title="Minimize window"
            aria-label="Minimize window"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6H10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className="ref-win-control-btn maximize"
            onClick={async () => {
              const next = await toggleMaximizeAppWindow();
              setIsMaximized(next);
            }}
            title={isMaximized ? "Restore window" : "Maximize window"}
            aria-label={isMaximized ? "Restore window" : "Maximize window"}
          >
            {isMaximized ? (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <rect
                  x="1.75"
                  y="3.75"
                  width="6.5"
                  height="6.5"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M3.75 3.75V2.55C3.75 2.10817 4.10817 1.75 4.55 1.75H9.45C9.8918 1.75 10.25 2.10817 10.25 2.55V7.45C10.25 7.89183 9.8918 8.25 9.45 8.25H8.25"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <rect
                  x="2.2"
                  y="2.2"
                  width="7.6"
                  height="7.6"
                  rx="1.2"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
              </svg>
            )}
          </button>

          <button
            type="button"
            className="ref-win-control-btn close"
            onClick={() => void closeAppWindow()}
            title="Close window"
            aria-label="Close window"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* MAIN ROUNDED PLATINUM CANVAS FRAMED BY THE FULL-WINDOW BLUE BORDER */}
      <main id="top" className="ref-canvas-surface">
        <Suspense fallback={<aside className="ref-sidebar" />}>
          <Navbar />
        </Suspense>

        <div className="ref-workspace-main">{children}</div>
      </main>
    </div>
  );
}
