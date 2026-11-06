"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStudioSession } from "@/core/context/StudioSessionContext";
import { LOCAL_DEV_USER } from "@/features/auth";
import { IconClose, IconPlus, IconTrash } from "@/shared";
import {
  SavedConversationSummary,
  deleteConversation,
  listUserConversations,
} from "@/features/history";
import { HarnessMissionSummary } from "@/features/harness";
import {
  localDbDeleteHarnessMission,
  localDbListHarnessMissions,
} from "@/core/tauri/tauriBridge";

type GalleryItemKind = "studio" | "harness";

interface UnifiedGalleryItem {
  kind: GalleryItemKind;
  id: string;
  title: string;
  promptOrGoal: string;
  previewImageUrl: string | null;
  roundOrTurnCount: number;
  updatedAt: string;
  studioProject?: SavedConversationSummary;
  harnessMission?: HarnessMissionSummary;
}

export default function ProjectsWorkspacePage() {
  const router = useRouter();
  const {
    user,
    setPendingRemix,
    activeProjectId,
    setActiveProjectId,
    setActiveProjectTitle,
    activeHarnessMissionId,
    setActiveHarnessMissionId,
    imagesOutputDir,
    newProjectNonce,
  } = useStudioSession();
  const activeUser = user || LOCAL_DEV_USER;

  const [projects, setProjects] = useState<SavedConversationSummary[]>([]);
  const [harnessMissions, setHarnessMissions] = useState<
    HarnessMissionSummary[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterKind, setFilterKind] = useState<"all" | GalleryItemKind>("all");
  const [galleryNotice, setGalleryNotice] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<UnifiedGalleryItem | null>(
    null
  );
  const [isDeletingItem, setIsDeletingItem] = useState<boolean>(false);

  useEffect(() => {
    if (!galleryNotice) return;
    const timer = window.setTimeout(() => setGalleryNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [galleryNotice]);

  useEffect(() => {
    if (!itemToDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeletingItem) {
        setItemToDelete(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [itemToDelete, isDeletingItem]);

  const loadGalleryFromDb = useCallback(async () => {
    setLoading(true);
    try {
      const [studioList, harnessList] = await Promise.all([
        listUserConversations(activeUser.id),
        localDbListHarnessMissions(activeUser.id),
      ]);
      setProjects(
        studioList.map((p) => ({
          ...p,
          title:
            !p.title ||
            p.title.trim() === "Novo Projeto" ||
            p.title.trim() === "Sem título"
              ? "New Project"
              : p.title,
        }))
      );
      setHarnessMissions(harnessList || []);
    } finally {
      setLoading(false);
    }
  }, [activeUser.id]);

  useEffect(() => {
    void loadGalleryFromDb();
  }, [loadGalleryFromDb, newProjectNonce]);

  const unifiedItems = useMemo<UnifiedGalleryItem[]>(() => {
    const fromStudio: UnifiedGalleryItem[] = projects.map((p) => ({
      kind: "studio",
      id: p.id,
      title: p.title,
      promptOrGoal: p.latest_prompt || "",
      previewImageUrl: p.preview_image_url || null,
      roundOrTurnCount: Number(p.turn_count || 0),
      updatedAt: p.updated_at || p.created_at || "",
      studioProject: p,
    }));

    const fromHarness: UnifiedGalleryItem[] = harnessMissions.map((m) => ({
      kind: "harness",
      id: m.id,
      title: m.title || "Goal Harness Mission",
      promptOrGoal: m.goal || "",
      previewImageUrl: m.bestImageUrl || null,
      roundOrTurnCount: Number(m.roundCount || 0),
      updatedAt: m.updated_at || m.created_at || "",
      harnessMission: m,
    }));

    return [...fromStudio, ...fromHarness].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }, [projects, harnessMissions]);

  const handleOpenGalleryItem = (item: UnifiedGalleryItem) => {
    if (item.kind === "harness") {
      setActiveHarnessMissionId(item.id);
      router.push(`/harness?missionId=${encodeURIComponent(item.id)}`);
      return;
    }
    if (item.studioProject) {
      setPendingRemix({
        idea: item.studioProject.title,
        prompt: item.studioProject.latest_prompt || undefined,
        imageUrl: item.studioProject.preview_image_url || undefined,
        conversationId: item.studioProject.id,
        nonce: Date.now(),
      });
      router.push("/create");
    }
  };

  const handlePromptDeleteItem = (
    e: React.MouseEvent,
    item: UnifiedGalleryItem
  ) => {
    e.stopPropagation();
    setItemToDelete(item);
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete || isDeletingItem) return;
    const target = itemToDelete;
    setIsDeletingItem(true);
    try {
      if (target.kind === "harness") {
        const ok = await localDbDeleteHarnessMission(target.id);
        if (ok) {
          setHarnessMissions((prev) => prev.filter((m) => m.id !== target.id));
          if (activeHarnessMissionId === target.id) {
            setActiveHarnessMissionId(null);
          }
          setItemToDelete(null);
          setGalleryNotice(
            `✓ "${target.title}" removed from Gallery • PNG files preserved in ${imagesOutputDir}`
          );
        }
      } else {
        const ok = await deleteConversation(target.id);
        if (ok) {
          setProjects((prev) => prev.filter((p) => p.id !== target.id));
          if (activeProjectId === target.id) {
            setActiveProjectId(null);
            setActiveProjectTitle("New Project");
            setPendingRemix(null);
          }
          if (typeof window !== "undefined") {
            try {
              window.localStorage.removeItem(
                `nanobanana_flow_meta_v2:${target.id}`
              );
              window.localStorage.removeItem(
                `nanobanana_flow_meta_v1:${target.id}`
              );
            } catch {
              // Ignore storage access errors
            }
          }
          setItemToDelete(null);
          setGalleryNotice(
            `✓ "${target.title}" removed from Gallery • PNG files preserved in ${imagesOutputDir}`
          );
        }
      }
    } finally {
      setIsDeletingItem(false);
    }
  };

  // Latest worked-on item (Studio or Goal Harness, ordered by updated_at DESC)
  const latestWorkedItem = unifiedItems.length > 0 ? unifiedItems[0] : null;

  // Filtered items by kind + search query
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return unifiedItems.filter((item) => {
      if (filterKind !== "all" && item.kind !== filterKind) return false;
      if (!q) return true;
      const inTitle = (item.title || "").toLowerCase().includes(q);
      const inPrompt = (item.promptOrGoal || "").toLowerCase().includes(q);
      return inTitle || inPrompt;
    });
  }, [unifiedItems, filterKind, searchQuery]);

  return (
    <div className="ref-page-container">
      <div className="ref-studio-three-part-layout">
        {/* ==================== TOP 15%: LAST WORKED ITEM + SEARCH & FILTER BAR ==================== */}
        <section
          className="ref-studio-top-interactions"
          aria-label="Latest project and search"
        >
          {/* Left: Last Worked Project / Mission */}
          <div className="ref-gallery-last-project-box">
            <span className="ref-interactions-label">
              {latestWorkedItem?.kind === "harness"
                ? "Latest Goal Harness"
                : "Latest Project"}
            </span>
            {latestWorkedItem ? (
              <button
                type="button"
                className="ref-interaction-history-item active"
                onClick={() => handleOpenGalleryItem(latestWorkedItem)}
                title={
                  latestWorkedItem.kind === "harness"
                    ? "Continue working on this Goal Harness mission"
                    : "Continue working on this Studio project"
                }
              >
                {latestWorkedItem.previewImageUrl ? (
                  <img
                    src={latestWorkedItem.previewImageUrl}
                    alt={latestWorkedItem.title}
                    className="ref-interaction-thumb"
                  />
                ) : (
                  <div className="ref-interaction-thumb-empty" />
                )}
                <div className="ref-interaction-meta">
                  <span className="ref-interaction-turn">
                    {latestWorkedItem.title}
                  </span>
                  <span className="ref-interaction-prompt-snippet">
                    {latestWorkedItem.promptOrGoal ||
                      (latestWorkedItem.kind === "harness"
                        ? "Click to open in Goal Harness"
                        : "Click to open in Studio")}
                  </span>
                </div>
              </button>
            ) : (
              <div className="ref-gallery-last-project-empty">
                No recent project
              </div>
            )}
          </div>

          {/* Center: Search Bar + Type Filter Pills + Live Status Toast */}
          <div className="ref-gallery-search-box">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                flexWrap: "wrap",
              }}
            >
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ref-input ref-gallery-search-input"
                style={{ flex: "1 1 240px" }}
                placeholder="Search Studio projects & Goal Harness missions..."
                aria-label="Search Studio projects and Goal Harness missions"
              />
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
                role="group"
                aria-label="Filter gallery by workspace type"
              >
                <button
                  type="button"
                  id="gallery-filter-all"
                  className={`ref-pill-chip ${
                    filterKind === "all" ? "active" : ""
                  }`}
                  onClick={() => setFilterKind("all")}
                >
                  All ({unifiedItems.length})
                </button>
                <button
                  type="button"
                  id="gallery-filter-studio"
                  className={`ref-pill-chip ${
                    filterKind === "studio" ? "active" : ""
                  }`}
                  onClick={() => setFilterKind("studio")}
                >
                  Studio ({projects.length})
                </button>
                <button
                  type="button"
                  id="gallery-filter-harness"
                  className={`ref-pill-chip ${
                    filterKind === "harness" ? "active" : ""
                  }`}
                  onClick={() => setFilterKind("harness")}
                >
                  Goal Harness ({harnessMissions.length})
                </button>
              </div>
            </div>
            {galleryNotice && (
              <div className="ref-gallery-toast-slot" aria-live="polite">
                <span className="ref-atelier-toast-pill">{galleryNotice}</span>
              </div>
            )}
          </div>
        </section>

        {/* ==================== BOTTOM 85%: UNIFIED STUDIO & GOAL HARNESS CARDS GRID ==================== */}
        <div className="ref-projects-cards-grid">
          {!loading &&
            filteredItems.map((item, itemIdx) => {
              const isHarnessItem = item.kind === "harness";
              const count = item.roundOrTurnCount;
              const filledDots =
                count === 0 ? 0 : Math.min(6, Math.max(1, count));
              const hMission = item.harnessMission;

              return (
                <article
                  key={`${item.kind}_${item.id}`}
                  className="ref-project-card"
                  onClick={() => handleOpenGalleryItem(item)}
                >
                  {/* 1. TOP ROUNDED ARTWORK FRAME */}
                  <div
                    className="ref-project-card-image-frame"
                    style={{ position: "relative" }}
                  >
                    {item.previewImageUrl ? (
                      <img
                        src={item.previewImageUrl}
                        alt={item.title}
                        className="ref-project-card-img"
                      />
                    ) : (
                      <span className="ref-project-card-no-image">
                        {isHarnessItem
                          ? "Planned Goal Harness • Click to launch evolution"
                          : count === 0
                          ? "New project • Click to start generating"
                          : "No rendered preview"}
                      </span>
                    )}

                    <span
                      style={{
                        position: "absolute",
                        top: "10px",
                        left: "10px",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                        backgroundColor: isHarnessItem
                          ? "#14213d"
                          : "rgba(255, 255, 255, 0.92)",
                        color: isHarnessItem ? "#fca311" : "#14213d",
                        border: isHarnessItem
                          ? "1px solid rgba(252, 163, 17, 0.45)"
                          : "1px solid rgba(20, 33, 61, 0.14)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {isHarnessItem
                        ? `GOAL HARNESS • ${hMission?.solvedCount ?? 0}/${
                            hMission?.deliverableCount ?? 1
                          } SOLVED`
                        : "STUDIO"}
                    </span>

                    {isHarnessItem && (hMission?.bestScore ?? 0) > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          top: "10px",
                          right: "10px",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 800,
                          backgroundColor: "#fca311",
                          color: "#14213d",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {hMission?.bestScore}/100
                      </span>
                    )}
                  </div>

                  {/* 2. MIDDLE METADATA BLOCK */}
                  <div className="ref-mura-card-body">
                    <div className="ref-mura-title-row">
                      <h2 className="ref-mura-card-title">
                        {item.title} #{String(itemIdx + 1).padStart(2, "0")}
                      </h2>
                      <span className="ref-mura-card-price-tag">
                        ({count} {count === 1 ? "round" : "rounds"})
                      </span>
                    </div>

                    <div className="ref-mura-kv-row">
                      <span className="ref-mura-kv-label">
                        {isHarnessItem ? "Evolution:" : "Interactions:"}
                      </span>
                      <span
                        className="ref-mura-dots"
                        aria-label={`${count} rounds`}
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
                      {item.promptOrGoal || "No prompt recorded."}
                    </p>

                    {/* 3. BOTTOM ACTION PILLS ROW */}
                    <div className="ref-mura-actions-row">
                      <button
                        type="button"
                        className="ref-mura-btn-solid"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenGalleryItem(item);
                        }}
                      >
                        {isHarnessItem ? "Open Harness" : "Open Studio"}
                      </button>
                      <button
                        type="button"
                        className="ref-mura-btn-outline danger"
                        onClick={(e) => handlePromptDeleteItem(e, item)}
                        title="Remove from Gallery"
                        aria-label={`Remove ${item.title}`}
                      >
                        <span>Remove</span>
                        <IconClose size={10} strokeWidth={2.1} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

          {!loading && filteredItems.length === 0 && (
            <div className="ref-gallery-empty-state">
              <strong className="ref-quad-blueprint-title">
                {unifiedItems.length === 0
                  ? "No projects or Goal Harness missions in your Atelier yet"
                  : "No items match the current search or filter"}
              </strong>
              <span className="ref-quad-blueprint-desc">
                {unifiedItems.length === 0
                  ? "Create a project in the Studio or launch an autonomous Goal Harness mission."
                  : "Try searching for another term or clearing the filter."}
              </span>
              {unifiedItems.length === 0 ? (
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="ref-dark-pill-btn"
                    onClick={() => router.push("/create")}
                  >
                    <IconPlus size={12} strokeWidth={2.2} />
                    <span>Open Studio</span>
                  </button>
                  <button
                    type="button"
                    className="ref-mura-btn-outline lg"
                    onClick={() => router.push("/harness")}
                  >
                    <IconPlus size={12} strokeWidth={2.2} />
                    <span>Open Goal Harness</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="ref-pill-chip active"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterKind("all");
                  }}
                >
                  Clear Filter
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==================== MODAL FOR DELETION CONFIRMATION ==================== */}
      {itemToDelete && (
        <div
          className="ref-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-project-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingItem) {
              setItemToDelete(null);
            }
          }}
        >
          <div className="ref-modal-card ref-delete-modal-card">
            <div className="ref-modal-header">
              <strong
                id="delete-project-modal-title"
                className="ref-soft-card-title"
              >
                {itemToDelete.kind === "harness"
                  ? "Remove Goal Harness Mission"
                  : "Remove Project"}
              </strong>
              <button
                type="button"
                aria-label="Close modal"
                className="ref-circle-icon-btn sm"
                disabled={isDeletingItem}
                onClick={() => setItemToDelete(null)}
              >
                <IconClose size={12} />
              </button>
            </div>

            <div className="ref-delete-modal-project-row">
              {itemToDelete.previewImageUrl ? (
                <img
                  src={itemToDelete.previewImageUrl}
                  alt={itemToDelete.title}
                  className="ref-delete-modal-thumb"
                />
              ) : (
                <div className="ref-delete-modal-thumb-placeholder" />
              )}
              <div className="ref-delete-modal-meta">
                <strong className="ref-delete-modal-project-name">
                  {itemToDelete.title}
                </strong>
                <span className="ref-delete-modal-project-sub">
                  {itemToDelete.kind === "harness"
                    ? "Goal Harness Mission"
                    : "Studio Project"}{" "}
                  • {itemToDelete.roundOrTurnCount}{" "}
                  {itemToDelete.roundOrTurnCount === 1 ? "round" : "rounds"}
                </span>
              </div>
            </div>

            <p className="ref-delete-modal-copy">
              Are you sure you want to remove{" "}
              <strong>&ldquo;{itemToDelete.title}&rdquo;</strong> from your
              Gallery? Exported PNG images inside{" "}
              <code>{imagesOutputDir}</code> will remain preserved on disk.
            </p>

            <div className="ref-delete-modal-actions">
              <button
                type="button"
                className="ref-mura-btn-outline lg"
                disabled={isDeletingItem}
                onClick={() => setItemToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-project-btn"
                className="ref-dark-pill-btn danger"
                disabled={isDeletingItem}
                onClick={() => void handleConfirmDeleteItem()}
              >
                <IconTrash size={14} />
                <span>
                  {isDeletingItem ? "Removing..." : "Remove from Gallery"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
