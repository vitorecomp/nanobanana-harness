"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCAL_DEV_USER, ProfileEditModal } from "@/features/auth";
import { useStudioSession } from "@/core/context/StudioSessionContext";

export default function Navbar() {
  const pathname = usePathname();
  const { user, setUser, hasKeyInRam, rememberKeyInVault } = useStudioSession();
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const activeUser = user || LOCAL_DEV_USER;
  const isProjects =
    pathname === "/gallery" || pathname?.startsWith("/projects");
  const isCreate = !isProjects;

  const currentViewTitle = isProjects ? "Projects Graph" : "Creation Studio";

  return (
    <>
      <header className="ref-folder-topbar">
        {/* Compact Raised Left Folder Tab (#DFDFDA) with S-Curve Shoulder */}
        <div className="ref-raised-title-tab">
          <span className="ref-tab-heading">{currentViewTitle}</span>
          <svg
            className="ref-tab-scurve-svg"
            viewBox="0 0 92 70"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 0 C42 0 50 70 92 70 L0 70 Z"
              fill="var(--ref-canvas)"
            />
          </svg>
        </div>

        {/* Top-Right Recessed Olive Channel with Compact Pill Navigation Tabs */}
        <nav
          className="ref-top-pill-nav"
          aria-label="Nano Banana Studio Primary Navigation"
        >
          <Link
            href="/create"
            id="nav-link-create"
            className={`ref-top-nav-pill ${isCreate ? "active" : ""}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle
                cx="11"
                cy="11"
                r="7"
                stroke="currentColor"
                strokeWidth="2.2"
              />
              <path
                d="M16.5 16.5L21 21"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
            <span>Studio</span>
          </Link>

          <Link
            href="/gallery"
            id="nav-link-projects"
            className={`ref-top-nav-pill ${isProjects ? "active" : ""}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="4"
                width="18"
                height="16"
                rx="3"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path d="M8 9H16M8 14H13" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span>Projects</span>
          </Link>

          <button
            type="button"
            id="nav-btn-vault"
            className="ref-top-nav-pill"
            onClick={() => setModalOpen(true)}
            title={
              hasKeyInRam
                ? rememberKeyInVault
                  ? "Config (Vault Key Active)"
                  : "Config (RAM Key Active)"
                : "Config"
            }
            aria-label="Config"
            style={{ width: "32px", padding: 0, justifyContent: "center" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="3.2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </nav>
      </header>

      <ProfileEditModal
        isOpen={modalOpen}
        user={activeUser}
        onClose={() => setModalOpen(false)}
        onSave={(updatedUser) => setUser(updatedUser)}
      />
    </>
  );
}
