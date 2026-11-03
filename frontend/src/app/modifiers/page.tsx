"use client";

import React, { useState, useMemo } from "react";
import { useStudioSession } from "@/core/context/StudioSessionContext";
import {
  ModifierCategory,
  ModifierOption,
  generateModifiersWithGemini,
} from "@/features/studio";

const AI_MODIFIER_SUGGESTIONS = [
  {
    label: "✦ Cyberpunk & Techwear Wardrobe",
    prompt:
      "Cyberpunk & Urban Techwear Clothing category with tactical jackets, reflective fabrics, and futuristic haute couture",
  },
  {
    label: "✦ Cinematic Camera Angles",
    prompt:
      "Cinematic Camera Angles & Framing category (Heroic low-angle, Extreme eye close-up, Over-the-shoulder, Long tracking shot)",
  },
  {
    label: "✦ Analog Lenses & Optics",
    prompt:
      "Analog Cameras & Vintage Lenses category (Medium format Hasselblad 80mm, 16mm Fisheye, Miniature Tilt-Shift, Helios 44-2 swirly bokeh)",
  },
  {
    label: "✦ Dramatic Lighting & Mood",
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

  const [selectedFilterCatId, setSelectedFilterCatId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(
    null
  );
  const [confirmRestoreDefaults, setConfirmRestoreDefaults] =
    useState<boolean>(false);

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
      .filter((c) => selectedFilterCatId === "all" || c.id === selectedFilterCatId)
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
  }, [categories, selectedFilterCatId, searchQuery]);

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
    if (selectedFilterCatId === cat.id) {
      setSelectedFilterCatId("all");
    }
    showTransientNotice(`✓ Category "${cat.title}" removed.`);
  };

  // 3. Add a Modifier Manually to Target Category
  const handleCreateModifier = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = newModLabel.trim();
    const token = newModToken.trim() || label;
    if (!label || !manualTargetCatId) return;

    const newOpt: ModifierOption = {
      id: `${slugifyId(label, "mod")}-${Date.now().toString(36).slice(-4)}`,
      label,
      token,
    };

    const nextList = categories.map((c) =>
      c.id === manualTargetCatId
        ? { ...c, options: [...c.options, newOpt] }
        : c
    );
    await updateModifierCategories(nextList);
    setNewModLabel("");
    setNewModToken("");
    const targetTitle =
      categories.find((c) => c.id === manualTargetCatId)?.title || "Category";
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
                  setSelectedFilterCatId("all");
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

            {/* Category Filter Chips */}
            <div
              className="ref-modifiers-cat-tabs"
              role="group"
              aria-label="Filter by category"
            >
              <button
                type="button"
                className={`ref-pill-chip ${
                  selectedFilterCatId === "all" ? "active" : ""
                }`}
                onClick={() => setSelectedFilterCatId("all")}
              >
                All ({categories.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`ref-pill-chip ${
                    selectedFilterCatId === cat.id ? "active" : ""
                  }`}
                  onClick={() => setSelectedFilterCatId(cat.id)}
                >
                  {cat.title} ({cat.options.length})
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Chamfered Category Cards */}
          <div className="ref-modifiers-cards-grid">
            {filteredCategories.map((cat) => {
              const isSweepReady = cat.options.length >= 4;
              return (
                <article key={cat.id} className="ref-project-card modifier-cat-card">
                  {/* 1. Card Header */}
                  <div className="ref-mura-title-row">
                    <h2 className="ref-mura-card-title">{cat.title}</h2>
                    <span className="ref-mura-card-price-tag">
                      ({cat.options.length}{" "}
                      {cat.options.length === 1 ? "modifier" : "modifiers"})
                    </span>
                  </div>

                  <div className="ref-mura-kv-row">
                    <span className="ref-mura-kv-label">2×2 Matrix Sweep:</span>
                    <span className="ref-mura-kv-value">
                      {isSweepReady
                        ? "⚡ 4-Way Sweep Ready"
                        : `${cat.options.length}/4 options for full sweep`}
                    </span>
                  </div>

                  {/* 2. Scrollable List of Modifiers inside this Category */}
                  <div className="ref-modifier-items-list">
                    {cat.options.length > 0 ? (
                      cat.options.map((mod) => (
                        <div key={mod.id} className="ref-modifier-option-row">
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
                            onClick={() => void handleDeleteModifier(cat.id, mod)}
                            title={`Remove modifier "${mod.label}"`}
                            aria-label={`Remove modifier ${mod.label}`}
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="ref-modifier-empty-box">
                        No modifiers in this category yet. Add manually or
                        generate with AI on the right.
                      </div>
                    )}
                  </div>

                  {/* 3. Bottom Action Pills */}
                  <div className="ref-mura-actions-row">
                    <button
                      type="button"
                      className="ref-mura-btn-solid"
                      onClick={() => {
                        setAiMode("into-existing");
                        setAiTargetCatId(cat.id);
                        setAiPrompt(
                          `Generate 4 creative new modifiers for the "${cat.title}" category`
                        );
                      }}
                    >
                      ✦ Generate w/ AI
                    </button>

                    <button
                      type="button"
                      className="ref-mura-btn-outline"
                      onClick={() => {
                        setManualTargetCatId(cat.id);
                        const el = document.getElementById(
                          "manual-modifier-label-input"
                        );
                        el?.focus();
                      }}
                    >
                      + Add
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
                      {confirmDeleteCatId === cat.id
                        ? "Confirm Delete?"
                        : "Delete ✕"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ==================== RIGHT 38%: AI GENERATOR & MANUAL CATEGORY/MODIFIER CREATOR ==================== */}
        <aside
          className="ref-studio-right-params-40"
          aria-label="Create Categories and Modifiers with AI or Manually"
        >
          {/* PART 1: AI GENERATOR FOR CATEGORIES & MODIFIERS */}
          <form className="ref-params-card" onSubmit={handleGenerateWithAi}>
            <div className="ref-params-card-header">
              <strong className="ref-soft-card-title">
                ✦ Create with AI (Gemini)
              </strong>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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
                ✦ Create New Category(ies)
              </button>
              <button
                type="button"
                className={`ref-pill-chip ${
                  aiMode === "into-existing" ? "active" : ""
                }`}
                onClick={() => setAiMode("into-existing")}
              >
                ✦ Generate for Existing Category
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
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ref-params-field-group" style={{ flex: 1 }}>
              <label className="ref-field-label" htmlFor="ai-modifier-prompt">
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
              }}
            >
              <div className="ref-studio-feedback-slot" aria-live="polite">
                {notice ? (
                  <span className="ref-atelier-toast-pill">{notice}</span>
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
                <span>
                  {isGeneratingAi
                    ? "Gemini creating..."
                    : aiMode === "new-category"
                    ? "✦ Create Category w/ AI"
                    : "✦ Generate Modifiers w/ AI"}
                </span>
                <span className="ref-lime-badge">AI</span>
              </button>
            </div>
          </form>

          {/* PART 2: MANUAL CATEGORY & MODIFIER CREATION */}
          <div className="ref-params-card">
            <div className="ref-params-card-header">
              <strong className="ref-soft-card-title">
                Quick Manual Creation
              </strong>
              <span className="ref-pill-chip">Camera • Clothing • Angle • Light</span>
            </div>

            {/* Form A: New Category */}
            <form
              onSubmit={handleCreateCategory}
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label
                className="ref-field-label"
                htmlFor="manual-category-title-input"
              >
                1. New Category (e.g. Camera, Clothing, Angle, Lighting, Pose)
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  id="manual-category-title-input"
                  type="text"
                  className="ref-input"
                  style={{ height: "36px" }}
                  value={newCategoryTitle}
                  onChange={(e) => setNewCategoryTitle(e.target.value)}
                  placeholder="New category name..."
                />
                <button
                  type="submit"
                  className="ref-dark-pill-btn"
                  style={{ height: "36px", flexShrink: 0 }}
                  disabled={!newCategoryTitle.trim()}
                >
                  + Category
                </button>
              </div>
            </form>

            {/* Form B: New Modifier inside Selected Category */}
            <form
              onSubmit={handleCreateModifier}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginTop: "4px",
              }}
            >
              <span className="ref-field-label">
                2. New Modifier — Select Category:
              </span>
              <div className="ref-params-pills-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`ref-pill-chip ${
                      manualTargetCatId === cat.id ? "active" : ""
                    }`}
                    onClick={() => setManualTargetCatId(cat.id)}
                  >
                    {cat.title}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.3fr",
                  gap: "8px",
                  marginTop: "2px",
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

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  className="ref-dark-pill-btn"
                  style={{ height: "36px" }}
                  disabled={!newModLabel.trim()}
                >
                  <span>+ Add Modifier</span>
                </button>
              </div>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
