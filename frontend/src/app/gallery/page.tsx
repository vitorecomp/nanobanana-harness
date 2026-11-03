"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStudioSession } from "@/core/context/StudioSessionContext";
import { LOCAL_DEV_USER } from "@/features/auth";
import {
  SavedConversationSummary,
  deleteConversation,
  listUserConversations,
} from "@/features/history";

export default function ProjectsWorkspacePage() {
  const router = useRouter();
  const { user, bootstrapData, setPendingRemix } = useStudioSession();
  const activeUser = user || LOCAL_DEV_USER;

  const [projects, setProjects] = useState<SavedConversationSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [galleryNotice, setGalleryNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!galleryNotice) return;
    const timer = window.setTimeout(() => setGalleryNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [galleryNotice]);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timer = window.setTimeout(() => setConfirmDeleteId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmDeleteId]);

  const loadProjectsFromDb = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listUserConversations(activeUser.id);
      setProjects(
        list.map((p) => ({
          ...p,
          title:
            !p.title ||
            p.title.trim() === "Novo Projeto" ||
            p.title.trim() === "Sem título"
              ? "New Project"
              : p.title,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [activeUser.id]);

  useEffect(() => {
    loadProjectsFromDb();
  }, [loadProjectsFromDb]);

  const handleOpenProjectInStudio = (proj: SavedConversationSummary) => {
    setPendingRemix({
      idea: proj.title,
      prompt: proj.latest_prompt || undefined,
      imageUrl: proj.preview_image_url || undefined,
      styleId: proj.style_id || "editorial-anime",
      conversationId: proj.id,
      nonce: Date.now(),
    });
    router.push("/create");
  };

  const handleDeleteProject = async (
    e: React.MouseEvent,
    proj: SavedConversationSummary
  ) => {
    e.stopPropagation();
    if (confirmDeleteId !== proj.id) {
      setConfirmDeleteId(proj.id);
      return;
    }
    setConfirmDeleteId(null);
    const ok = await deleteConversation(proj.id);
    if (ok) {
      setProjects((prev) => prev.filter((p) => p.id !== proj.id));
      setGalleryNotice(
        `✓ "${proj.title}" removed from Gallery • PNG files preserved in ~/Pictures/nanobanana/`
      );
    }
  };

  // Latest worked-on project (ordered by updated_at DESC from SQLite)
  const latestWorkedProject = projects.length > 0 ? projects[0] : null;

  // Filtered projects by search query and category (style_id)
  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((proj) => {
      const matchesCategory =
        selectedCategory === "all" || proj.style_id === selectedCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      const inTitle = (proj.title || "").toLowerCase().includes(q);
      const inPrompt = (proj.latest_prompt || "").toLowerCase().includes(q);
      return inTitle || inPrompt;
    });
  }, [projects, searchQuery, selectedCategory]);

  return (
    <div className="ref-page-container">
      <div className="ref-studio-three-part-layout">
        {/* ==================== TOP 15%: LAST WORKED PROJECT + SEARCH BAR + CATEGORY FILTERS ==================== */}
        <section
          className="ref-studio-top-interactions"
          aria-label="Latest project, search, and category filters"
        >
          {/* Left: Last Worked Project */}
          <div className="ref-gallery-last-project-box">
            <span className="ref-interactions-label">Latest Project</span>
            {latestWorkedProject ? (
              <button
                type="button"
                className="ref-interaction-history-item active"
                onClick={() => handleOpenProjectInStudio(latestWorkedProject)}
                title="Continue working on this project"
              >
                {latestWorkedProject.preview_image_url ? (
                  <img
                    src={latestWorkedProject.preview_image_url}
                    alt={latestWorkedProject.title}
                    className="ref-interaction-thumb"
                  />
                ) : (
                  <div className="ref-interaction-thumb-empty" />
                )}
                <div className="ref-interaction-meta">
                  <span className="ref-interaction-turn">
                    {latestWorkedProject.title}
                  </span>
                  <span className="ref-interaction-prompt-snippet">
                    {latestWorkedProject.latest_prompt ||
                      "Click to open in Studio"}
                  </span>
                </div>
              </button>
            ) : (
              <div className="ref-gallery-last-project-empty">
                No recent project
              </div>
            )}
          </div>

          {/* Center: Search Bar + Live Status Toast */}
          <div className="ref-gallery-search-box">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ref-input ref-gallery-search-input"
              placeholder="Search projects by title or prompt..."
              aria-label="Search projects by title or prompt"
            />
            {galleryNotice && (
              <div className="ref-gallery-toast-slot" aria-live="polite">
                <span className="ref-atelier-toast-pill">{galleryNotice}</span>
              </div>
            )}
          </div>

          {/* Right: Category Filter Pills */}
          <div
            className="ref-gallery-categories-strip"
            role="group"
            aria-label="Filter by category"
          >
            <button
              type="button"
              className={`ref-pill-chip ${
                selectedCategory === "all" ? "active" : ""
              }`}
              onClick={() => setSelectedCategory("all")}
            >
              All
            </button>
            {bootstrapData.style_presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`ref-pill-chip ${
                  selectedCategory === preset.id ? "active" : ""
                }`}
                onClick={() => setSelectedCategory(preset.id)}
              >
                {preset.title.split(" (")[0]}
              </button>
            ))}
          </div>
        </section>

        {/* ==================== BOTTOM 85%: CARDS-ONLY PROJECTS GRID (SELECT FROM SQLITE) ==================== */}
        <div className="ref-projects-cards-grid">
          {!loading &&
            filteredProjects.map((proj, projIdx) => {
              const styleLabel =
                bootstrapData.style_presets
                  .find((s) => s.id === proj.style_id)
                  ?.title.split(" (")[0] || proj.style_id;
              const turnCount = Number(proj.turn_count || 0);
              const filledDots = Math.min(6, Math.max(1, turnCount));

              return (
                <article
                  key={proj.id}
                  className="ref-project-card"
                  onClick={() => handleOpenProjectInStudio(proj)}
                >
                  {/* 1. TOP ROUNDED ARTWORK FRAME */}
                  <div className="ref-project-card-image-frame">
                    {proj.preview_image_url ? (
                      <img
                        src={proj.preview_image_url}
                        alt={proj.title}
                        className="ref-project-card-img"
                      />
                    ) : (
                      <span className="ref-project-card-no-image">
                        No rendered preview • {styleLabel}
                      </span>
                    )}
                  </div>

                  {/* 2. MIDDLE METADATA BLOCK (Matches reference card layout) */}
                  <div className="ref-mura-card-body">
                    <div className="ref-mura-title-row">
                      <h2 className="ref-mura-card-title">
                        {proj.title} #{String(projIdx + 1).padStart(2, "0")}
                      </h2>
                      <span className="ref-mura-card-price-tag">
                        ({turnCount} {turnCount === 1 ? "round" : "rounds"})
                      </span>
                    </div>

                    <div className="ref-mura-kv-row">
                      <span className="ref-mura-kv-label">Visual Style:</span>
                      <span className="ref-mura-kv-value">{styleLabel}</span>
                    </div>

                    <div className="ref-mura-kv-row">
                      <span className="ref-mura-kv-label">Interactions:</span>
                      <span
                        className="ref-mura-dots"
                        aria-label={`${turnCount} interactions`}
                      >
                        {[0, 1, 2, 3, 4, 5].map((dotIdx) => (
                          <i
                            key={dotIdx}
                            className={`ref-mura-dot ${
                              dotIdx < filledDots ? "filled" : ""
                            } ${dotIdx === filledDots - 1 ? "current" : ""}`}
                          />
                        ))}
                      </span>
                    </div>

                    <p className="ref-project-card-prompt">
                      {proj.latest_prompt || "No prompt recorded."}
                    </p>

                    {/* 3. BOTTOM ACTION PILLS ROW ([Solid Pill] [Outlined Pill]) */}
                    <div className="ref-mura-actions-row">
                      <button
                        type="button"
                        className="ref-mura-btn-solid"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProjectInStudio(proj);
                        }}
                      >
                        Open Studio
                      </button>
                      <button
                        type="button"
                        className={`ref-mura-btn-outline ${
                          confirmDeleteId === proj.id
                            ? "danger-confirm"
                            : "danger"
                        }`}
                        onClick={(e) => handleDeleteProject(e, proj)}
                        title="Remove project from Gallery (keeps PNG files in ~/Pictures/nanobanana)"
                        aria-label={
                          confirmDeleteId === proj.id
                            ? `Confirm removing project ${proj.title}`
                            : `Remove project ${proj.title}`
                        }
                      >
                        {confirmDeleteId === proj.id
                          ? "Confirm Remove?"
                          : "Remove ✕"}
                      </button>
                      {confirmDeleteId === proj.id && (
                        <button
                          type="button"
                          className="ref-mura-btn-outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

          {!loading && filteredProjects.length === 0 && (
            <div className="ref-gallery-empty-state">
              <strong className="ref-quad-blueprint-title">
                {projects.length === 0
                  ? "No projects in your Atelier yet"
                  : "No projects match the current filter"}
              </strong>
              <span className="ref-quad-blueprint-desc">
                {projects.length === 0
                  ? "Create your first project in the Studio to explore 4 simultaneous variations with Gemini."
                  : "Try searching for another term or clearing the category filter."}
              </span>
              {projects.length === 0 ? (
                <button
                  type="button"
                  className="ref-dark-pill-btn"
                  onClick={() => router.push("/create")}
                >
                  <span>+ Open Studio & Create Project</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="ref-pill-chip active"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                  }}
                >
                  Clear Search & Categories
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
