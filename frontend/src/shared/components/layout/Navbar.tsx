"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LOCAL_DEV_USER, ProfileEditModal } from "@/features/auth";
import { useStudioSession } from "@/core/context/StudioSessionContext";
import { updateConversationTitle } from "@/features/history";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    setUser,
    hasKeyInRam,
    rememberKeyInVault,
    activeProjectId,
    activeProjectTitle,
    setActiveProjectTitle,
    triggerNewProject,
  } = useStudioSession();
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const activeUser = user || LOCAL_DEV_USER;
  const isProjects =
    pathname === "/gallery" || pathname?.startsWith("/projects");
  const isModifiers = pathname?.startsWith("/modifiers");
  const isCreate = !isProjects && !isModifiers;

  const handleSidebarTitleChange = (nextTitle: string) => {
    setActiveProjectTitle(nextTitle);
    if (activeProjectId) {
      void updateConversationTitle(activeProjectId, nextTitle);
    }
  };

  const handleSidebarNewProject = () => {
    triggerNewProject();
    if (!isCreate) {
      router.push("/create");
    }
  };

  return (
    <>
      <aside
        className={`ref-sidebar ${collapsed ? "collapsed" : ""}`}
        aria-label="Nano Banana Studio Sidebar"
      >
        {/* 1. TOP BRAND HEADER + COLLAPSE TOGGLE */}
        <div className="ref-sidebar-header">
          <div className="ref-sidebar-brand">
            <span className="ref-sidebar-logo-mark" aria-hidden="true">
              ✦
            </span>
            {!collapsed && (
              <div className="ref-sidebar-brand-text">
                <strong className="ref-sidebar-brand-title">Nano Banana</strong>
                <span className="ref-sidebar-brand-sub">Atelier Studio</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="ref-sidebar-collapse-btn"
            onClick={() => setCollapsed((prev) => !prev)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        <div className="ref-sidebar-divider" />

        {/* 2. PRIMARY VERTICAL NAVIGATION + PROJECT CONTROLS */}
        <nav
          className="ref-sidebar-nav"
          aria-label="Nano Banana Studio Primary Navigation"
        >
          {!collapsed && (
            <span className="ref-sidebar-section-label">Workspace</span>
          )}

          <Link
            href="/create"
            id="nav-link-create"
            className={`ref-sidebar-nav-item ${isCreate ? "active" : ""}`}
            title="Creation Studio (2×2 Generation)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="3"
                width="7.5"
                height="7.5"
                rx="1.8"
                stroke="currentColor"
                strokeWidth="2"
              />
              <rect
                x="13.5"
                y="3"
                width="7.5"
                height="7.5"
                rx="1.8"
                stroke="currentColor"
                strokeWidth="2"
              />
              <rect
                x="3"
                y="13.5"
                width="7.5"
                height="7.5"
                rx="1.8"
                stroke="currentColor"
                strokeWidth="2"
              />
              <rect
                x="13.5"
                y="13.5"
                width="7.5"
                height="7.5"
                rx="1.8"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            {!collapsed && <span>Studio</span>}
          </Link>

          <Link
            href="/gallery"
            id="nav-link-projects"
            className={`ref-sidebar-nav-item ${isProjects ? "active" : ""}`}
            title="Projects Gallery"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="4"
                width="18"
                height="16"
                rx="3"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M8 9H16M8 14H13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {!collapsed && <span>Gallery</span>}
          </Link>

          <Link
            href="/modifiers"
            id="nav-link-modifiers"
            className={`ref-sidebar-nav-item ${isModifiers ? "active" : ""}`}
            title="Manage Modifiers & Categories (Camera, Clothing, Angle, Light, AI)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 6H20M4 12H20M4 18H20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="9"
                cy="6"
                r="2.2"
                fill="#fca311"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle
                cx="15"
                cy="12"
                r="2.2"
                fill="#fca311"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle
                cx="10"
                cy="18"
                r="2.2"
                fill="#fca311"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
            {!collapsed && <span>Modifiers</span>}
          </Link>

          <div className="ref-sidebar-divider" style={{ margin: "8px 0" }} />

          {!collapsed && (
            <div className="ref-sidebar-project-box">
              <label
                className="ref-sidebar-section-label"
                htmlFor="sidebar-project-title-input"
                style={{ padding: 0 }}
              >
                Current Project
              </label>
              <input
                id="sidebar-project-title-input"
                type="text"
                value={activeProjectTitle}
                onChange={(e) => handleSidebarTitleChange(e.target.value)}
                className="ref-sidebar-project-input"
                placeholder="Project name..."
              />
            </div>
          )}

          <button
            type="button"
            className="ref-sidebar-nav-item new-project-btn"
            onClick={handleSidebarNewProject}
            title="Start a new empty project"
          >
            <span style={{ fontSize: "1.05rem", fontWeight: 800, lineHeight: 1 }}>
              +
            </span>
            {!collapsed && <span>New Project</span>}
          </button>
        </nav>

        {/* 3. BOTTOM SYSTEM & CONFIG FOOTER */}
        <div className="ref-sidebar-footer">
          <div className="ref-sidebar-divider" />

          {!collapsed && (
            <div className="ref-sidebar-status-box">
              <div className="ref-sidebar-status-row">
                <span
                  className="ref-sidebar-status-dot"
                  style={{
                    backgroundColor: hasKeyInRam ? "#fca311" : "#14213d",
                  }}
                />
                <span className="ref-sidebar-status-text">
                  {hasKeyInRam
                    ? rememberKeyInVault
                      ? "Gemini Key (Vault)"
                      : "Gemini Key (RAM)"
                    : "API Key Not Set"}
                </span>
              </div>
              <span className="ref-sidebar-storage-path">
                ~/Pictures/nanobanana
              </span>
            </div>
          )}

          <button
            type="button"
            id="nav-btn-vault"
            className="ref-sidebar-nav-item config-btn"
            onClick={() => setModalOpen(true)}
            title="Settings • Gemini API Key & Images Folder"
            aria-label="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="3.2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {!collapsed && <span>Settings</span>}
            {collapsed && (
              <span
                className="ref-sidebar-status-dot"
                style={{
                  backgroundColor: hasKeyInRam ? "#fca311" : "#14213d",
                }}
              />
            )}
          </button>
        </div>
      </aside>

      <ProfileEditModal
        isOpen={modalOpen}
        user={activeUser}
        onClose={() => setModalOpen(false)}
        onSave={(updatedUser) => setUser(updatedUser)}
      />
    </>
  );
}
