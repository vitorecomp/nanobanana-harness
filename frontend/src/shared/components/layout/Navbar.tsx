"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LOCAL_DEV_USER, ProfileEditModal } from "@/features/auth";
import { useStudioSession } from "@/core/context/StudioSessionContext";
import {
  IconAtelierStar,
  IconClose,
  IconDoubleChevron,
  IconPlus,
} from "../icons/AtelierIcons";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    setUser,
    hasKeyInRam,
    rememberKeyInVault,
    triggerNewProject,
    isSettingsModalOpen,
    setSettingsModalOpen,
  } = useStudioSession();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [isNewProjectModalOpen, setNewProjectModalOpen] =
    useState<boolean>(false);
  const [newProjectNameInput, setNewProjectNameInput] = useState<string>("");
  const newProjectInputRef = useRef<HTMLInputElement | null>(null);

  const activeUser = user || LOCAL_DEV_USER;
  const isProjects =
    pathname === "/gallery" || pathname?.startsWith("/projects");
  const isModifiers = pathname?.startsWith("/modifiers");
  const isCreate = !isProjects && !isModifiers;

  useEffect(() => {
    if (!isNewProjectModalOpen) return;
    const focusTimer = window.setTimeout(() => {
      newProjectInputRef.current?.focus();
      newProjectInputRef.current?.select();
    }, 30);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNewProjectModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNewProjectModalOpen]);

  const handleOpenNewProjectModal = () => {
    setNewProjectNameInput("");
    setNewProjectModalOpen(true);
  };

  const handleConfirmCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenTitle = newProjectNameInput.trim() || "New Project";
    setNewProjectModalOpen(false);
    await triggerNewProject(chosenTitle);
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
              <IconAtelierStar size={16} />
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
            <IconDoubleChevron
              direction={collapsed ? "right" : "left"}
              size={13}
            />
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

          <button
            type="button"
            className="ref-sidebar-nav-item new-project-btn"
            onClick={handleOpenNewProjectModal}
            title="Start a new project"
          >
            <IconPlus size={16} strokeWidth={2.1} />
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
            onClick={() => setSettingsModalOpen(true)}
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
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
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
                  backgroundColor: hasKeyInRam ? "#fca311" : "#d62828",
                }}
              />
            )}
          </button>
        </div>
      </aside>

      <ProfileEditModal
        isOpen={isSettingsModalOpen}
        user={activeUser}
        onClose={() => setSettingsModalOpen(false)}
        onSave={(updatedUser) => setUser(updatedUser)}
      />

      {isNewProjectModalOpen && (
        <div
          className="ref-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-project-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setNewProjectModalOpen(false);
            }
          }}
        >
          <form
            className="ref-modal-card"
            style={{ maxWidth: "400px", padding: "20px 22px", gap: "14px" }}
            onSubmit={handleConfirmCreateNewProject}
          >
            <div className="ref-modal-header">
              <strong
                id="new-project-modal-title"
                className="ref-soft-card-title"
              >
                ✦ Create New Project
              </strong>
              <button
                type="button"
                aria-label="Close modal"
                className="ref-circle-icon-btn sm"
                onClick={() => setNewProjectModalOpen(false)}
              >
                <IconClose size={12} />
              </button>
            </div>

            <div>
              <label
                className="ref-field-label"
                htmlFor="new-project-name-input"
              >
                Project Name
              </label>
              <input
                ref={newProjectInputRef}
                id="new-project-name-input"
                type="text"
                value={newProjectNameInput}
                onChange={(e) => setNewProjectNameInput(e.target.value)}
                className="ref-input"
                placeholder="E.g.: Cyber Samurai Storyboard..."
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: "8px",
                paddingTop: "2px",
              }}
            >
              <button
                type="button"
                className="ref-mura-btn-outline lg"
                onClick={() => setNewProjectModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="ref-dark-pill-btn">
                <span>Create Project</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
