"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudioSession } from "@/core/context/StudioSessionContext";
import { GoogleGLogo, FacebookFLogo } from "@/features/auth";
import {
  BucketGalleryItem,
  SavedConversationSummary,
  fetchPublicGallery,
  fetchUserBucketGallery,
  listUserConversations,
  toggleTurnPublish,
} from "@/features/history";
import { getShowcaseFallbackDataUrl } from "@/features/studio";

function GalleryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, setPendingRemix } = useStudioSession();

  const tabParam = searchParams?.get("tab");
  const [activeTab, setActiveTab] = useState<"public" | "personal">(
    tabParam === "personal" ? "personal" : "public"
  );

  useEffect(() => {
    setActiveTab(tabParam === "personal" ? "personal" : "public");
  }, [tabParam]);

  const [publicItems, setPublicItems] = useState<BucketGalleryItem[]>([]);
  const [personalItems, setPersonalItems] = useState<BucketGalleryItem[]>([]);
  const [conversations, setConversations] = useState<
    SavedConversationSummary[]
  >([]);
  const [selectedStyleFilter, setSelectedStyleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const loadGalleries = useCallback(async () => {
    setIsLoading(true);
    const pubPromise = fetchPublicGallery();
    const persPromise = user?.id
      ? fetchUserBucketGallery(user.id)
      : Promise.resolve([]);
    const convPromise = user?.id
      ? listUserConversations(user.id)
      : Promise.resolve([]);

    const [pubData, persData, convData] = await Promise.all([
      pubPromise,
      persPromise,
      convPromise,
    ]);
    setPublicItems(pubData);
    setPersonalItems(persData);
    setConversations(convData);
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadGalleries();
  }, [loadGalleries]);

  const handleSwitchTab = (tab: "public" | "personal") => {
    setActiveTab(tab);
    router.push(tab === "personal" ? "/gallery?tab=personal" : "/gallery");
  };

  const handleRemixInStudio = (item: BucketGalleryItem) => {
    setPendingRemix({
      idea: item.raw_idea || item.master_prompt.slice(0, 100),
      prompt: item.master_prompt,
      imageUrl: item.image_url,
      styleId: item.style_id || "editorial-anime",
      conversationId: item.is_curated ? undefined : item.conversation_id,
      turn: item.turn_number,
      nonce: Date.now(),
    });
    router.push("/create");
  };

  const handleOpenConversationInStudio = (conv: SavedConversationSummary) => {
    setPendingRemix({
      idea: conv.title,
      prompt: conv.latest_prompt || undefined,
      imageUrl: conv.preview_image_url || undefined,
      styleId: conv.style_id || "editorial-anime",
      conversationId: conv.id,
      turn: conv.turn_count,
      nonce: Date.now(),
    });
    router.push("/create");
  };

  const handleTogglePublish = async (item: BucketGalleryItem) => {
    const turnId = item.turn_id || item.id;
    if (!turnId || item.is_curated) return;
    setPublishingId(turnId);
    const nextState = !item.is_published;
    const updated = await toggleTurnPublish(turnId, nextState);
    setPublishingId(null);

    if (updated) {
      setStatusBanner(
        updated.is_published
          ? "Generation published to the Public Community Gallery!"
          : "Generation removed from the Public Community Gallery."
      );
      await loadGalleries();
    }
  };

  const sourceList = activeTab === "public" ? publicItems : personalItems;
  const filteredItems = sourceList.filter((item) => {
    const matchesStyle =
      selectedStyleFilter === "all" || item.style_id === selectedStyleFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (item.master_prompt || "").toLowerCase().includes(q) ||
      (item.raw_idea || "").toLowerCase().includes(q) ||
      (item.conversation_title || "").toLowerCase().includes(q) ||
      (item.author_name || "").toLowerCase().includes(q);
    return matchesStyle && matchesSearch;
  });

  return (
    <section
      className="editorial-section"
      aria-labelledby="gallery-page-heading"
    >
      <div className="section-header-row">
        <div>
          <h1 id="gallery-page-heading" className="section-display-title">
            {activeTab === "personal"
              ? "MY PERSONAL GALLERY & HISTORY"
              : "PUBLISHED COMMUNITY GALLERY"}
          </h1>
        </div>
        <p className="section-lead-copy">
          {activeTab === "personal" ? (
            <>
              Consult your personal images stored in the{" "}
              <strong>RustFS S3 Bucket</strong> and multi-turn prompt history in{" "}
              <strong>PostgreSQL</strong>. Publish your favorite creations to
              the Community Feed or remix any frame in the{" "}
              <strong>Creation Studio</strong>.
            </>
          ) : (
            <>
              Explore published multi-turn generations crafted with{" "}
              <strong>Google Nano Banana</strong> and our{" "}
              <strong>Python Art-Direction Co-Pilot</strong>. Inspect the full
              Master Prompt or load any frame directly into the{" "}
              <strong>Creation Studio</strong> to evolve it further.
            </>
          )}
        </p>
      </div>

      {/* GALLERY MODE SWITCHER + QUICK ACTIONS */}
      <div
        className="studio-auth-banner"
        style={{ marginBottom: "24px" }}
        role="region"
        aria-label="Gallery View Switcher and Creator Actions"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
          role="tablist"
          aria-label="Gallery Mode Tabs"
        >
          <button
            type="button"
            role="tab"
            id="gallery-tab-public-btn"
            aria-selected={activeTab === "public"}
            className={`interactive-chip ${
              activeTab === "public" ? "selected" : ""
            }`}
            onClick={() => handleSwitchTab("public")}
          >
            <span>Published Community Feed ({publicItems.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            id="gallery-tab-personal-btn"
            aria-selected={activeTab === "personal"}
            className={`interactive-chip ${
              activeTab === "personal" ? "selected" : ""
            }`}
            onClick={() => handleSwitchTab("personal")}
          >
            <span>
              My Personal Gallery ({personalItems.length} Images •{" "}
              {conversations.length} Sessions)
            </span>
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          {user && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                paddingRight: "8px",
              }}
            >
              <img
                src={user.picture}
                alt={user.name}
                className="user-avatar-img"
              />
              {user.provider === "facebook" ? (
                <FacebookFLogo size={16} />
              ) : (
                <GoogleGLogo size={16} />
              )}
              <span style={{ fontSize: "0.86rem", fontWeight: 800 }}>
                {user.name}
              </span>
            </div>
          )}

          <button
            type="button"
            id="gallery-go-to-login-btn"
            className="interactive-chip"
            onClick={() => router.push("/login")}
          >
            <span>Switch Account / Sign In</span>
          </button>

          <button
            type="button"
            id="gallery-create-new-btn"
            className="join-pill-btn"
            style={{ backgroundColor: "var(--accent-yellow)" }}
            onClick={() => router.push("/create")}
          >
            <span>Create with Nano Banana ★</span>
          </button>
        </div>
      </div>

      {statusBanner && (
        <div
          className="persistence-status-toast"
          style={{ marginBottom: "20px" }}
          role="status"
        >
          <span>{statusBanner}</span>
          <button
            type="button"
            className="interactive-chip"
            style={{ minHeight: "30px", padding: "2px 10px" }}
            onClick={() => setStatusBanner(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div
        className="copilot-panel-card"
        style={{
          marginBottom: "28px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div
          className="chips-wrap"
          role="group"
          aria-label="Filter gallery by art direction style"
        >
          {[
            { id: "all", label: "All Styles" },
            { id: "editorial-anime", label: "Editorial Anime" },
            { id: "cyberpunk-3d", label: "Cyberpunk 3D" },
            { id: "analog-35mm", label: "35mm Analog" },
            { id: "neo-brutalist", label: "Neo-Brutalist" },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              className={`interactive-chip ${
                selectedStyleFilter === st.id ? "selected" : ""
              }`}
              onClick={() => setSelectedStyleFilter(st.id)}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div style={{ flex: "1 1 260px", maxWidth: "420px" }}>
          <input
            id="gallery-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts, ideas, or creators..."
            className="studio-text-input"
            aria-label="Search gallery items"
          />
        </div>
      </div>

      {/* PERSONAL CONVERSATION HISTORY STRIP (When on Personal Tab) */}
      {activeTab === "personal" && (
        <div
          className="persistence-hub-box"
          style={{ marginBottom: "28px" }}
          aria-label="Saved PostgreSQL Multi-Turn Conversations"
        >
          <div className="persistence-hub-header">
            <div>
              <h2
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  marginBottom: "4px",
                }}
              >
                SAVED POSTGRESQL CONVERSATIONS ({conversations.length})
              </h2>
              <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                Resume any multi-turn art-direction session in the Creation
                Studio with its full prompt history intact.
              </p>
            </div>
            <button
              type="button"
              className="interactive-chip selected"
              onClick={() => router.push("/create")}
            >
              + New Session in Studio
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="empty-persistence-box">
              No saved PostgreSQL conversations for{" "}
              <strong>{user?.name || "this profile"}</strong> yet. Click{" "}
              <strong>Create with Nano Banana ★</strong> to generate your first
              multi-turn artwork!
            </div>
          ) : (
            <div className="conversations-grid">
              {conversations.map((conv) => (
                <div key={conv.id} className="conversation-history-card">
                  <div className="conv-card-top">
                    <span className="conv-card-title">{conv.title}</span>
                    <span className="turn-pill-badge">
                      {conv.turn_count} turns
                    </span>
                  </div>
                  <p className="conv-card-prompt">
                    {conv.latest_prompt || "Session ready in PostgreSQL"}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "8px",
                    }}
                  >
                    <span className="conv-card-meta">
                      Style: {conv.style_id || "editorial-anime"}
                    </span>
                    <button
                      type="button"
                      className="interactive-chip selected"
                      style={{ minHeight: "34px", padding: "4px 12px" }}
                      onClick={() => handleOpenConversationInStudio(conv)}
                    >
                      Resume in Studio →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MAIN GALLERY GRID (Public Published Feed or Personal RustFS Bucket Images) */}
      {isLoading ? (
        <div className="empty-persistence-box" style={{ padding: "48px 24px" }}>
          Loading gallery generations from PostgreSQL &amp; RustFS Bucket...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-persistence-box" style={{ padding: "48px 24px" }}>
          <p style={{ marginBottom: "16px", fontSize: "1rem" }}>
            {activeTab === "personal"
              ? "You haven't generated any images in your Personal RustFS Bucket yet."
              : "No published generations match your current filter."}
          </p>
          <button
            type="button"
            className="primary-yellow-cta"
            style={{ maxWidth: "320px", margin: "0 auto" }}
            onClick={() => router.push("/create")}
          >
            <span>Open Creation Studio ★</span>
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "24px",
          }}
        >
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className="copilot-panel-card"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "14px",
                padding: "18px",
              }}
            >
              <div>
                {/* Image Frame */}
                <div
                  style={{
                    position: "relative",
                    borderRadius: "16px",
                    overflow: "hidden",
                    border: "2.5px solid #0B0B0B",
                    backgroundColor: "#141413",
                    aspectRatio: "4 / 3",
                    marginBottom: "14px",
                  }}
                >
                  <img
                    src={item.image_url}
                    alt={item.raw_idea || item.master_prompt}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={(e) => {
                      const target = e.currentTarget;
                      const fallback = getShowcaseFallbackDataUrl(
                        item.image_url
                      );
                      if (target.src !== fallback) {
                        target.src = fallback;
                      }
                    }}
                  />
                  <span
                    className="evolution-overlay-pill"
                    style={{ top: "10px", left: "10px" }}
                  >
                    TURN #{item.turn_number} •{" "}
                    {item.style_id || "editorial-anime"}
                  </span>
                  {item.is_published && (
                    <span
                      className="evolution-score-pill"
                      style={{ top: "10px", right: "10px" }}
                    >
                      PUBLISHED ★
                    </span>
                  )}
                </div>

                {/* Metadata Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <strong style={{ fontSize: "1rem" }}>
                    {item.conversation_title ||
                      item.raw_idea ||
                      "Nano Banana Creation"}
                  </strong>
                  <span
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    by {item.author_name || "Studio Creator"}
                  </span>
                </div>

                {item.edit_instruction && (
                  <div
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                      marginBottom: "8px",
                    }}
                  >
                    Directive: {item.edit_instruction}
                  </div>
                )}

                {/* Master Prompt Box */}
                <div
                  className="evolution-prompt-box"
                  style={{ marginBottom: "8px" }}
                >
                  <span className="evolution-prompt-label">MASTER PROMPT</span>
                  <code
                    className="evolution-prompt-code"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.master_prompt}
                  </code>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  flexWrap: "wrap",
                  paddingTop: "8px",
                  borderTop: "1.5px solid rgba(11,11,11,0.12)",
                }}
              >
                {!item.is_curated && (
                  <button
                    type="button"
                    className={`interactive-chip ${
                      item.is_published ? "selected" : ""
                    }`}
                    disabled={publishingId === (item.turn_id || item.id)}
                    onClick={() => handleTogglePublish(item)}
                  >
                    {item.is_published
                      ? "✓ Published (Unpublish)"
                      : "Publish to Community"}
                  </button>
                )}

                <button
                  type="button"
                  className="explore-download-pill"
                  style={{ marginLeft: "auto" }}
                  onClick={() => handleRemixInStudio(item)}
                >
                  <span>Remix in Studio</span>
                  <span
                    className="explore-pill-yellow-circle"
                    aria-hidden="true"
                  >
                    ★
                  </span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function GalleryPage() {
  return (
    <Suspense
      fallback={
        <div className="editorial-section">Loading Nano Banana Gallery...</div>
      }
    >
      <GalleryPageContent />
    </Suspense>
  );
}
