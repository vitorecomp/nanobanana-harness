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
  IconSettingsGear,
} from "../icons/AtelierIcons";
import { useDialogFocusTrap } from "../../hooks/useDialogFocusTrap";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    setUser,
    hasKeyInRam,
    rememberKeyInVault,
    triggerNewProject,
    triggerNewHarnessMission,
    activeHarnessMissionId,
    isSettingsModalOpen,
    setSettingsModalOpen,
  } = useStudioSession();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [isNewProjectModalOpen, setNewProjectModalOpen] =
    useState<boolean>(false);
  const [newProjectNameInput, setNewProjectNameInput] = useState<string>("");
  const [newProjectKind, setNewProjectKind] = useState<"studio" | "harness">(
    "studio"
  );
  const newProjectInputRef = useRef<HTMLInputElement | null>(null);
  const newProjectDialogRef = useRef<HTMLDivElement | null>(null);
  useDialogFocusTrap(
    newProjectDialogRef,
    isNewProjectModalOpen,
    () => setNewProjectModalOpen(false)
  );

  const activeUser = user || LOCAL_DEV_USER;
  const isProjects =
    pathname === "/gallery" || pathname?.startsWith("/projects");
  const isModifiers = pathname?.startsWith("/modifiers");
  const isHarness = pathname?.startsWith("/harness");
  const isCreate = !isProjects && !isModifiers && !isHarness;

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 960) {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (!isNewProjectModalOpen) return;
    const focusTimer = window.setTimeout(() => {
      newProjectInputRef.current?.focus();
      newProjectInputRef.current?.select();
    }, 30);
    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [isNewProjectModalOpen]);

  const handleOpenNewProjectModal = () => {
    setNewProjectNameInput("");
    setNewProjectKind(isHarness ? "harness" : "studio");
    setNewProjectModalOpen(true);
  };

  const handleConfirmCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenTitle =
      newProjectNameInput.trim() ||
      (newProjectKind === "harness" ? "Untitled Goal Mission" : "New Project");
    setNewProjectModalOpen(false);
    if (newProjectKind === "harness") {
      const createdMissionId = await triggerNewHarnessMission(chosenTitle);
      if (createdMissionId) {
        router.push(
          `/harness?missionId=${encodeURIComponent(createdMissionId)}`
        );
      } else {
        router.push(`/harness?new=1&title=${encodeURIComponent(chosenTitle)}`);
      }
      return;
    }
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
        {/* 1. TOP BRAND HEADER */}
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
            href={
              activeHarnessMissionId
                ? `/harness?missionId=${encodeURIComponent(
                    activeHarnessMissionId
                  )}`
                : "/harness"
            }
            id="nav-link-harness"
            className={`ref-sidebar-nav-item ${isHarness ? "active" : ""}`}
            title="Goal-Driven Agent Harness (Planner → Generator → Critic → TRACE Refiner)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="8.5"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle
                cx="12"
                cy="12"
                r="4.2"
                stroke="var(--atelier-steel)"
                strokeWidth="2"
              />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
            {!collapsed && <span>Goal Harness</span>}
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
                fill="var(--atelier-steel)"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle
                cx="15"
                cy="12"
                r="2.2"
                fill="var(--atelier-steel)"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle
                cx="10"
                cy="18"
                r="2.2"
                fill="var(--atelier-steel)"
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
                    backgroundColor: hasKeyInRam
                      ? "var(--atelier-steel)"
                      : "var(--ref-danger)",
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
            <IconSettingsGear size={16} strokeWidth={1.9} />
            {!collapsed && <span>Settings</span>}
            {collapsed && (
              <span
                className="ref-sidebar-status-dot"
                style={{
                  backgroundColor: hasKeyInRam
                    ? "var(--atelier-steel)"
                    : "var(--ref-danger)",
                }}
              />
            )}
          </button>

          <button
            type="button"
            id="nav-btn-collapse-sidebar"
            className="ref-sidebar-nav-item"
            onClick={() => setCollapsed((prev) => !prev)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <IconDoubleChevron
              direction={collapsed ? "right" : "left"}
              size={15}
            />
            {!collapsed && <span>Collapse</span>}
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
          ref={newProjectDialogRef}
          data-atelier-modal="true"
          className="ref-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-project-modal-title"
          tabIndex={-1}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setNewProjectModalOpen(false);
            }
          }}
        >
        <form
          className="ref-modal-card ref-new-project-modal-card"
          onSubmit={handleConfirmCreateNewProject}
        >
          <div className="ref-modal-header">
            <strong
              id="new-project-modal-title"
              className="ref-soft-card-title"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              <IconAtelierStar size={14} />
              <span>Create New Project</span>
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
            <span className="ref-field-label">Creation Process</span>
            <div
              className="ref-new-project-kind-grid"
              role="radiogroup"
              aria-label="Creation Process"
            >
              <button
                type="button"
                id="new-project-kind-studio"
                role="radio"
                aria-checked={newProjectKind === "studio"}
                className={`ref-new-project-kind-card ${
                  newProjectKind === "studio" ? "active" : ""
                }`}
                onClick={() => setNewProjectKind("studio")}
              >
                <strong className="ref-new-project-kind-title">
                  Studio Flow
                </strong>
                <span className="ref-new-project-kind-sub">
                  2×2 interactive batch generation &amp; DNA locks
                </span>
              </button>

              <button
                type="button"
                id="new-project-kind-harness"
                role="radio"
                aria-checked={newProjectKind === "harness"}
                className={`ref-new-project-kind-card ${
                  newProjectKind === "harness" ? "active" : ""
                }`}
                onClick={() => setNewProjectKind("harness")}
              >
                <strong className="ref-new-project-kind-title">
                  Goal Harness
                </strong>
                <span className="ref-new-project-kind-sub">
                  Planner → Generator → Critic → TRACE loop
                </span>
              </button>
            </div>
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
              placeholder={
                newProjectKind === "harness"
                  ? "E.g.: Isometric Space Asset Pack..."
                  : "E.g.: Cyber Samurai Storyboard..."
              }
            />
          </div>

          <div className="ref-new-project-modal-actions">
            <button
              type="button"
              className="ref-mura-btn-outline lg"
              onClick={() => setNewProjectModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              id="new-project-confirm-btn"
              className="ref-dark-pill-btn"
            >
              <span>
                {newProjectKind === "harness"
                  ? "Create Goal Harness"
                  : "Create Studio Project"}
              </span>
            </button>
          </div>
        </form>
        </div>
      )}
    </>
  );
}
