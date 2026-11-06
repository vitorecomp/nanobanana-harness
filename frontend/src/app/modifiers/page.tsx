"use client";

import React, { useState, useMemo } from "react";
import { useStudioSession } from "@/core/context/StudioSessionContext";
import { IconAtelierStar, IconClose, IconPlus } from "@/shared";
import {
  ModifierCategory,
  ModifierOption,
  generateModifiersWithGemini,
} from "@/features/studio";

const AI_MODIFIER_SUGGESTIONS = [
  {
    label: "Cyberpunk & Techwear Wardrobe",
    prompt:
      "Cyberpunk & Urban Techwear Clothing category with tactical jackets, reflective fabrics, and futuristic haute couture",
  },
  {
    label: "Cinematic Camera Angles",
    prompt:
      "Cinematic Camera Angles & Framing category (Heroic low-angle, Extreme eye close-up, Over-the-shoulder, Long tracking shot)",
  },
  {
    label: "Analog Lenses & Optics",
    prompt:
      "Analog Cameras & Vintage Lenses category (Medium format Hasselblad 80mm, 16mm Fisheye, Miniature Tilt-Shift, Helios 44-2 swirly bokeh)",
  },
  {
    label: "Dramatic Lighting & Mood",
    prompt:
      "Cinematic Lighting category (Silhouette backlight, Volumetric window rays, Baroque chiaroscuro, Bioluminescent glow)",
  },
];

function slugifyId(text: string, prefix: string): string {
  const clean = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return clean || `${prefix}-${Date.now().toString(36)}`;
}

export default function ModifiersManagerPage() {
  const {
    apiKey,
    bootstrapData,
    updateModifierCategories,
    resetModifierCategories,
    openSettingsModal,
  } = useStudioSession();

  const categories = bootstrapData.modifier_categories;

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(
    null
  );
  const [confirmRestoreDefaults, setConfirmRestoreDefaults] =
    useState<boolean>(false);
  const [rightSidebarTab, setRightSidebarTab] = useState<
    "ai" | "edit" | "new-cat"
  >("ai");

  // AI Creation State
  const [aiMode, setAiMode] = useState<"new-category" | "into-existing">(
    "new-category"
  );
  const [aiTargetCatId, setAiTargetCatId] = useState<string>(
    categories[0]?.id || "camera"
  );
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);

  // Manual Category & Modifier Creation State
  const [newCategoryTitle, setNewCategoryTitle] = useState<string>("");
  const [manualTargetCatId, setManualTargetCatId] = useState<string>(
    categories[0]?.id || "camera"
  );
  const [newModLabel, setNewModLabel] = useState<string>("");
  const [newModToken, setNewModToken] = useState<string>("");

  const showTransientNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((prev) => (prev === msg ? null : prev));
    }, 4200);
  };

  const totalModifiersCount = useMemo(
    () => categories.reduce((acc, c) => acc + c.options.length, 0),
    [categories]
  );

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categories
      .map((c) => {
        if (!q) return c;
        const catMatches = c.title.toLowerCase().includes(q);
        if (catMatches) return c;
        return {
          ...c,
          options: c.options.filter(
            (o) =>
              o.label.toLowerCase().includes(q) ||
              o.token.toLowerCase().includes(q)
          ),
        };
      })
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.options.length > 0);
  }, [categories, searchQuery]);

  const masonryColumns = useMemo(() => {
    const cols: [ModifierCategory[], ModifierCategory[]] = [[], []];
    const heights: [number, number] = [0, 0];
    for (const cat of filteredCategories) {
      const targetCol = heights[0] <= heights[1] ? 0 : 1;
      cols[targetCol].push(cat);
      const rows = Math.max(1, Math.ceil(cat.options.length / 2));
      heights[targetCol] += 110 + rows * 48;
    }
    return cols;
  }, [filteredCategories]);

  const activeManualCategory = useMemo(
    () =>
      categories.find((c) => c.id === manualTargetCatId) ||
      categories[0] ||
      null,
    [categories, manualTargetCatId]
  );

  // 1. Create a New Category Manually
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newCategoryTitle.trim();
    if (!title) return;
    const id = `${slugifyId(title, "cat")}-${Date.now().toString(36).slice(-4)}`;
    const nextCategory: ModifierCategory = {
      id,
      title,
      options: [],
    };
    const nextList = [...categories, nextCategory];
    await updateModifierCategories(nextList);
    setNewCategoryTitle("");
    setManualTargetCatId(id);
    setAiTargetCatId(id);
    setRightSidebarTab("edit");
    showTransientNotice(`✓ Category "${title}" created!`);
  };

  // 2. Delete a Category (with 2-step confirmation)
  const handleDeleteCategory = async (cat: ModifierCategory) => {
    if (confirmDeleteCatId !== cat.id) {
      setConfirmDeleteCatId(cat.id);
      window.setTimeout(() => {
        setConfirmDeleteCatId((prev) => (prev === cat.id ? null : prev));
      }, 4000);
      return;
    }
    setConfirmDeleteCatId(null);
    const nextList = categories.filter((c) => c.id !== cat.id);
    await updateModifierCategories(nextList);
    showTransientNotice(`✓ Category "${cat.title}" removed.`);
  };

  // 3. Add a Modifier Manually to Target Category
  const handleCreateModifier = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = newModLabel.trim();
    const token = newModToken.trim() || label;
    const targetId = activeManualCategory?.id || manualTargetCatId;
    if (!label || !targetId) return;

    const newOpt: ModifierOption = {
      id: `${slugifyId(label, "mod")}-${Date.now().toString(36).slice(-4)}`,
      label,
      token,
    };

    const nextList = categories.map((c) =>
      c.id === targetId ? { ...c, options: [...c.options, newOpt] } : c
    );
    await updateModifierCategories(nextList);
    setNewModLabel("");
    setNewModToken("");
    const targetTitle =
      categories.find((c) => c.id === targetId)?.title || "Category";
    showTransientNotice(
      `✓ Modifier "${label}" added to "${targetTitle}"!`
    );
  };

  // 4. Delete a Modifier from a Category
  const handleDeleteModifier = async (catId: string, mod: ModifierOption) => {
    const nextList = categories.map((c) =>
      c.id === catId
        ? { ...c, options: c.options.filter((o) => o.id !== mod.id) }
        : c
    );
    await updateModifierCategories(nextList);
    showTransientNotice(`✓ Modifier "${mod.label}" removed.`);
  };

  // 5. Generate Categories or Modifiers with Gemini AI
  const handleGenerateWithAi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = aiPrompt.trim();
    if (!clean || isGeneratingAi) return;

    setIsGeneratingAi(true);
    try {
      const targetCatObj =
        aiMode === "into-existing"
          ? categories.find((c) => c.id === aiTargetCatId)
          : undefined;

      const { categories: generated, usedAiApi } =
        await generateModifiersWithGemini({
          apiKey,
          instruction: clean,
          targetCategoryTitle: targetCatObj?.title,
        });

      if (aiMode === "into-existing" && targetCatObj) {
        const newOpts = generated.flatMap((g) => g.options);
        const nextList = categories.map((c) =>
          c.id === targetCatObj.id
            ? { ...c, options: [...c.options, ...newOpts] }
            : c
        );
        await updateModifierCategories(nextList);
        showTransientNotice(
          `✦ ${newOpts.length} modifiers generated ${
            usedAiApi ? "via Gemini 2.5 Flash" : "(smart synthesis)"
          } in "${targetCatObj.title}"!`
        );
      } else {
        const nextList = [...categories, ...generated];
        await updateModifierCategories(nextList);
        showTransientNotice(
          `✦ ${generated.length} category(ies) created ${
            usedAiApi ? "with Gemini 2.5 Flash" : "(smart synthesis)"
          }!`
        );
      }
      setAiPrompt("");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="ref-page-container">
      <div className="ref-modifiers-split-layout">
        {/* ==================== LEFT 62%: CATEGORIES FILTER BAR + MU_RA CATEGORY CARDS GRID ==================== */}
        <section
          className="ref-modifiers-left-panel"
          aria-label="Categories and Modifiers"
        >
          {/* Top Filter & Search Strip */}
          <div className="ref-modifiers-top-bar">
            <div className="ref-modifiers-search-row">
              <div className="ref-modifiers-title-group">
                <span className="ref-interactions-label">
                  Visual Direction Library
                </span>
                <strong className="ref-soft-card-title">
                  {categories.length} Categories • {totalModifiersCount}{" "}
                  Modifiers
                </strong>
              </div>

              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ref-input ref-modifiers-search-input"
                placeholder="Search category, camera, clothing, angle, light..."
              />

              <button
                type="button"
                className={`ref-pill-chip ${
                  confirmRestoreDefaults ? "active" : ""
                }`}
                onClick={async () => {
                  if (!confirmRestoreDefaults) {
                    setConfirmRestoreDefaults(true);
                    window.setTimeout(
                      () => setConfirmRestoreDefaults(false),
                      4000
                    );
                    return;
                  }
                  setConfirmRestoreDefaults(false);
                  await resetModifierCategories();
                  showTransientNotice(
                    "✓ Default categories and modifiers restored!"
                  );
                }}
                title="Restore default categories (Camera, Clothing, Angle, Lighting, Atmosphere)"
              >
                {confirmRestoreDefaults
                  ? "Confirm Restore Defaults?"
                  : "↺ Restore Defaults"}
              </button>
            </div>
          </div>

          {/* Grid of Chamfered Category Cards (2-Column Shortest-First Masonry) */}
          <div className="ref-modifiers-cards-grid">
            {masonryColumns.map((colCategories, colIdx) => (
              <div key={colIdx} className="ref-modifiers-masonry-col">
                {colCategories.map((cat) => {
                  const isSweepReady = cat.options.length >= 4;
                  return (
                    <article
                      key={cat.id}
                      className="ref-project-card modifier-cat-card"
                    >
                      {/* 1. Card Header */}
                      <div className="ref-mura-title-row">
                        <h2 className="ref-mura-card-title">{cat.title}</h2>
                        <span className="ref-mura-card-price-tag">
                          ({cat.options.length}{" "}
                          {cat.options.length === 1 ? "modifier" : "modifiers"})
                        </span>
                      </div>

                      <div className="ref-mura-kv-row">
                        <span className="ref-mura-kv-label">
                          2×2 Matrix Sweep:
                        </span>
                        <span className="ref-mura-kv-value">
                          {isSweepReady
                            ? "⚡ 4-Way Sweep Ready"
                            : `${cat.options.length}/4 options for full sweep`}
                        </span>
                      </div>

                      {/* 2. 2-Column Grid of Modifiers inside this Category */}
                      <div className="ref-modifier-items-list">
                        {cat.options.length > 0 ? (
                          cat.options.map((mod) => (
                            <div
                              key={mod.id}
                              className="ref-modifier-option-row"
                            >
                              <div className="ref-modifier-option-text">
                                <strong className="ref-modifier-option-label">
                                  {mod.label}
                                </strong>
                                <span
                                  className="ref-modifier-option-token"
                                  title={mod.token}
                                >
                                  {mod.token}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="ref-modifier-empty-box">
                            No modifiers in this category yet. Add manually or
                            generate with AI on the right.
                          </div>
                        )}
                      </div>

                      {/* 3. Bottom Action Pills (Right-aligned: Edit, Delete) */}
                      <div
                        className="ref-mura-actions-row"
                        style={{ justifyContent: "flex-end", gap: "8px" }}
                      >
                        <button
                          type="button"
                          className="ref-mura-btn-solid"
                          onClick={() => {
                            setManualTargetCatId(cat.id);
                            setAiTargetCatId(cat.id);
                            setRightSidebarTab("edit");
                            window.setTimeout(() => {
                              const el = document.getElementById(
                                "manual-modifier-label-input"
                              );
                              el?.focus();
                            }, 30);
                          }}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className={`ref-mura-btn-outline ${
                            confirmDeleteCatId === cat.id
                              ? "danger-confirm"
                              : "danger"
                          }`}
                          onClick={() => void handleDeleteCategory(cat)}
                          title={`Delete category ${cat.title}`}
                        >
                          {confirmDeleteCatId === cat.id ? (
                            "Confirm Delete?"
                          ) : (
                            <>
                              <span>Delete</span>
                              <IconClose size={10} strokeWidth={2.1} />
                            </>
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {/* ==================== RIGHT 38%: TABBED AI & MANUAL WORKSPACE ==================== */}
        <aside
          className="ref-studio-right-params-40"
          aria-label="Create Categories and Modifiers with AI or Manually"
        >
          <div className="ref-params-card ref-params-deck">
            <div className="ref-studio-param-deck-container">
              {/* 3-Tab Switcher (AI Generator | Edit Category | New Category) */}
              <div
                className="ref-studio-param-tabs"
                role="tablist"
                aria-label="Modifier Creation & Editing Tabs"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightSidebarTab === "ai"}
                  className={`ref-studio-param-tab ${
                    rightSidebarTab === "ai" ? "active" : ""
                  }`}
                  onClick={() => setRightSidebarTab("ai")}
                >
                  <span className="ref-studio-param-tab-title">
                    ✦ AI Generator
                  </span>
                  <span className="ref-studio-param-tab-value">
                    {aiMode === "new-category"
                      ? "New Category"
                      : categories.find((c) => c.id === aiTargetCatId)?.title ||
                        "Into Category"}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={rightSidebarTab === "edit"}
                  className={`ref-studio-param-tab ${
                    rightSidebarTab === "edit" ? "active" : ""
                  }`}
                  onClick={() => setRightSidebarTab("edit")}
                >
                  <span className="ref-studio-param-tab-title">
                    Edit Category
                  </span>
                  <span className="ref-studio-param-tab-value">
                    {activeManualCategory
                      ? `${activeManualCategory.title} (${activeManualCategory.options.length})`
                      : "Select"}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={rightSidebarTab === "new-cat"}
                  className={`ref-studio-param-tab ${
                    rightSidebarTab === "new-cat" ? "active" : ""
                  }`}
                  onClick={() => setRightSidebarTab("new-cat")}
                >
                  <span className="ref-studio-param-tab-title">
                    New Category
                  </span>
                  <span className="ref-studio-param-tab-value">
                    {categories.length} Categories
                  </span>
                </button>
              </div>

              {/* Active Tab Panel */}
              <div className="ref-studio-param-tab-panel" role="tabpanel">
                {/* TAB 1: AI GENERATOR */}
                {rightSidebarTab === "ai" && (
                  <form
                    className="ref-studio-tab-section"
                    style={{ height: "100%" }}
                    onSubmit={handleGenerateWithAi}
                  >
                    <div className="ref-params-card-header">
                      <strong className="ref-soft-card-title">
                        ✦ Create with AI (Gemini)
                      </strong>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {!apiKey.trim() && (
                          <button
                            type="button"
                            className="ref-studio-mod-manage-link"
                            onClick={openSettingsModal}
                            title="Configure Gemini API Key for live Gemini 2.5 Flash synthesis"
                          >
                            🔑 Set API Key
                          </button>
                        )}
                        <span className="ref-pill-chip active">
                          {aiMode === "new-category"
                            ? "New Category + Modifiers"
                            : "Add to Category"}
                        </span>
                      </div>
                    </div>

                    <div className="ref-params-pills-wrap">
                      <button
                        type="button"
                        className={`ref-pill-chip ${
                          aiMode === "new-category" ? "active" : ""
                        }`}
                        onClick={() => setAiMode("new-category")}
                      >
                        <IconAtelierStar size={12} />
                        <span>Create New Category(ies)</span>
                      </button>
                      <button
                        type="button"
                        className={`ref-pill-chip ${
                          aiMode === "into-existing" ? "active" : ""
                        }`}
                        onClick={() => setAiMode("into-existing")}
                      >
                        <IconAtelierStar size={12} />
                        <span>Generate for Existing Category</span>
                      </button>
                    </div>

                    {aiMode === "into-existing" && (
                      <div className="ref-params-field-group">
                        <span className="ref-field-label">
                          Select Target Category:
                        </span>
                        <div className="ref-params-pills-wrap">
                          {categories.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              className={`ref-pill-chip ${
                                aiTargetCatId === cat.id ? "active" : ""
                              }`}
                              onClick={() => setAiTargetCatId(cat.id)}
                            >
                              {cat.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="ref-params-field-group">
                      <span className="ref-field-label">Quick AI Ideas:</span>
                      <div className="ref-params-pills-wrap">
                        {AI_MODIFIER_SUGGESTIONS.map((s) => (
                          <button
                            key={s.label}
                            type="button"
                            className="ref-pill-chip"
                            onClick={() => setAiPrompt(s.prompt)}
                          >
                            <IconAtelierStar size={11} />
                            <span>{s.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="ref-params-field-group" style={{ flex: 1 }}>
                      <label
                        className="ref-field-label"
                        htmlFor="ai-modifier-prompt"
                      >
                        Describe the category or modifiers you want to create:
                      </label>
                      <textarea
                        id="ai-modifier-prompt"
                        className="ref-params-textarea"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="e.g. Create a Fantasy Medieval Armor category with 4 detailed options, or Anamorphic Cinema Lenses..."
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        marginTop: "auto",
                      }}
                    >
                      <div
                        className="ref-studio-feedback-slot"
                        aria-live="polite"
                      >
                        {notice ? (
                          <span className="ref-atelier-toast-pill">
                            {notice}
                          </span>
                        ) : (
                          <span className="ref-atelier-shortcut-hint">
                            Synced with Studio & SQLite
                          </span>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="ref-dark-pill-btn"
                        disabled={isGeneratingAi || !aiPrompt.trim()}
                      >
                        {!isGeneratingAi && <IconAtelierStar size={12} />}
                        <span>
                          {isGeneratingAi
                            ? "Gemini creating..."
                            : aiMode === "new-category"
                            ? "Create Category w/ AI"
                            : "Generate Modifiers w/ AI"}
                        </span>
                        <span className="ref-lime-badge">AI</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* TAB 2: EDIT CATEGORY (ADD & REMOVE MODIFIERS) */}
                {rightSidebarTab === "edit" && (
                  <div className="ref-studio-tab-section">
                    <div className="ref-params-card-header">
                      <strong className="ref-soft-card-title">
                        Edit Category:{" "}
                        {activeManualCategory?.title || "None Selected"}
                      </strong>
                      <span className="ref-pill-chip active">
                        {activeManualCategory?.options.length ?? 0} Modifiers
                      </span>
                    </div>

                    <form
                      onSubmit={handleCreateModifier}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <span className="ref-field-label">
                        Add Modifier to{" "}
                        {activeManualCategory?.title || "Category"}:
                      </span>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1.3fr",
                          gap: "8px",
                        }}
                      >
                        <input
                          id="manual-modifier-label-input"
                          type="text"
                          className="ref-input"
                          style={{ height: "36px" }}
                          value={newModLabel}
                          onChange={(e) => setNewModLabel(e.target.value)}
                          placeholder="Name (e.g. Leather Jacket)"
                        />
                        <input
                          type="text"
                          className="ref-input"
                          style={{ height: "36px" }}
                          value={newModToken}
                          onChange={(e) => setNewModToken(e.target.value)}
                          placeholder="Prompt token (e.g. vintage black leather jacket...)"
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <div
                          className="ref-studio-feedback-slot"
                          aria-live="polite"
                        >
                          {notice ? (
                            <span className="ref-atelier-toast-pill">
                              {notice}
                            </span>
                          ) : (
                            <span className="ref-atelier-shortcut-hint">
                              4+ options enable 2×2 Matrix Sweep
                            </span>
                          )}
                        </div>
                        <button
                          type="submit"
                          className="ref-dark-pill-btn"
                          style={{ height: "36px", flexShrink: 0 }}
                          disabled={!newModLabel.trim() || !activeManualCategory}
                        >
                          <IconPlus size={12} strokeWidth={2.2} />
                          <span>Add Modifier</span>
                        </button>
                      </div>
                    </form>

                    {activeManualCategory && (
                      <div
                        className="ref-params-field-group"
                        style={{ marginTop: "4px" }}
                      >
                        <span className="ref-field-label">
                          Current Modifiers in {activeManualCategory.title} (
                          {activeManualCategory.options.length}):
                        </span>
                        <div className="ref-modifier-items-list">
                          {activeManualCategory.options.length > 0 ? (
                            activeManualCategory.options.map((mod) => (
                              <div
                                key={mod.id}
                                className="ref-modifier-option-row"
                              >
                                <div className="ref-modifier-option-text">
                                  <strong className="ref-modifier-option-label">
                                    {mod.label}
                                  </strong>
                                  <span
                                    className="ref-modifier-option-token"
                                    title={mod.token}
                                  >
                                    {mod.token}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="ref-modifier-remove-btn"
                                  onClick={() =>
                                    void handleDeleteModifier(
                                      activeManualCategory.id,
                                      mod
                                    )
                                  }
                                  title={`Remove ${mod.label}`}
                                  aria-label={`Remove ${mod.label}`}
                                >
                                  <IconClose size={10} strokeWidth={2} />
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="ref-modifier-empty-box">
                              No modifiers in this category yet. Use the form
                              above to add one.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: NEW CATEGORY */}
                {rightSidebarTab === "new-cat" && (
                  <form
                    onSubmit={handleCreateCategory}
                    className="ref-studio-tab-section"
                  >
                    <div className="ref-params-card-header">
                      <strong className="ref-soft-card-title">
                        Create New Category
                      </strong>
                      <span className="ref-pill-chip">
                        Camera • Clothing • Angle • Light
                      </span>
                    </div>

                    <div className="ref-params-field-group">
                      <label
                        className="ref-field-label"
                        htmlFor="manual-category-title-input"
                      >
                        Category Name (e.g. Camera, Clothing, Angle, Lighting,
                        Pose):
                      </label>
                      <input
                        id="manual-category-title-input"
                        type="text"
                        className="ref-input"
                        style={{ height: "38px" }}
                        value={newCategoryTitle}
                        onChange={(e) => setNewCategoryTitle(e.target.value)}
                        placeholder="Enter new category name..."
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                      }}
                    >
                      <div
                        className="ref-studio-feedback-slot"
                        aria-live="polite"
                      >
                        {notice ? (
                          <span className="ref-atelier-toast-pill">
                            {notice}
                          </span>
                        ) : (
                          <span className="ref-atelier-shortcut-hint">
                            Creates category & opens Edit tab
                          </span>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="ref-dark-pill-btn"
                        style={{ height: "38px", flexShrink: 0 }}
                        disabled={!newCategoryTitle.trim()}
                      >
                        <IconPlus size={12} strokeWidth={2.2} />
                        <span>Create Category</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
