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

  const loadProjectsFromDb = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listUserConversations(activeUser.id);
      setProjects(list);
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
    projectId: string
  ) => {
    e.stopPropagation();
    const ok = await deleteConversation(projectId);
    if (ok) {
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
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
          aria-label="Último projeto, busca e filtro por categorias"
        >
          {/* Left: Last Worked Project */}
          <div className="ref-gallery-last-project-box">
            <span className="ref-interactions-label">Último Projeto</span>
            {latestWorkedProject ? (
              <button
                type="button"
                className="ref-interaction-history-item active"
                onClick={() => handleOpenProjectInStudio(latestWorkedProject)}
                title="Continuar trabalhando neste projeto"
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
                      "Clique para abrir no Studio"}
                  </span>
                </div>
              </button>
            ) : (
              <div className="ref-gallery-last-project-empty">
                Nenhum projeto trabalhado
              </div>
            )}
          </div>

          {/* Center: Search Bar */}
          <div className="ref-gallery-search-box">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ref-input ref-gallery-search-input"
              placeholder="Buscar projeto por nome ou prompt..."
            />
          </div>

          {/* Right: Category Filter Pills */}
          <div
            className="ref-gallery-categories-strip"
            role="group"
            aria-label="Filtro por categorias"
          >
            <button
              type="button"
              className={`ref-pill-chip ${
                selectedCategory === "all" ? "active" : ""
              }`}
              onClick={() => setSelectedCategory("all")}
            >
              Todas
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
            filteredProjects.map((proj) => (
              <article
                key={proj.id}
                className="ref-project-card"
                onClick={() => handleOpenProjectInStudio(proj)}
              >
                <div className="ref-project-card-header-row">
                  <h2 className="ref-project-card-title">{proj.title}</h2>
                  <button
                    type="button"
                    className="ref-card-expand-circle"
                    onClick={(e) => handleDeleteProject(e, proj.id)}
                    title="Remover projeto da Galeria (mantém arquivos PNG em ~/Pictures/nanobanana)"
                    aria-label={`Remover projeto ${proj.title}`}
                  >
                    ✕
                  </button>
                </div>

                <div className="ref-project-card-image-frame">
                  {proj.preview_image_url ? (
                    <img
                      src={proj.preview_image_url}
                      alt={proj.title}
                      className="ref-project-card-img"
                    />
                  ) : null}
                </div>

                <p className="ref-project-card-prompt">
                  {proj.latest_prompt || "Sem prompt registrado."}
                </p>
              </article>
            ))}
        </div>
      </div>

      {/* ==================== EMPTY FOOTER BAR ==================== */}
      <div className="ref-bottom-scrubber-bar" />
    </div>
  );
}
