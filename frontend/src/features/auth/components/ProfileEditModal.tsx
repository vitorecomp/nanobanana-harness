"use client";

import React, { useState, useEffect } from "react";
import { GoogleUserProfile } from "../types/auth.types";
import { useStudioSession } from "@/core/context/StudioSessionContext";
import { IconClose } from "@/shared/components/icons/AtelierIcons";

export interface ProfileEditModalProps {
  isOpen: boolean;
  initialSection?: "profile" | "vault";
  user: GoogleUserProfile;
  onClose: () => void;
  onSave: (updatedUser: GoogleUserProfile) => void;
}

export default function ProfileEditModal({
  isOpen,
  onClose,
}: ProfileEditModalProps) {
  const {
    apiKey,
    setApiKey,
    rememberKeyInVault,
    setRememberKeyInVault,
    imagesOutputDir,
    setImagesOutputDir,
  } = useStudioSession();

  const [showKey, setShowKey] = useState<boolean>(false);
  const [dirInput, setDirInput] = useState<string>(imagesOutputDir);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  useEffect(() => {
    setDirInput(imagesOutputDir);
  }, [imagesOutputDir]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveConfig = async () => {
    await setImagesOutputDir(dirInput);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1500);
    onClose();
  };

  return (
    <div
      className="ref-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="config-vault-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ref-modal-card">
        <div className="ref-modal-header">
          <span className="ref-pill-chip active">Studio Settings</span>
          <button
            type="button"
            className="ref-circle-icon-btn md"
            onClick={onClose}
            aria-label="Close modal"
          >
            <IconClose size={12} />
          </button>
        </div>

        <h2 id="config-vault-modal-title" className="sr-only">
          Studio Settings
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label
              htmlFor="modal-gemini-api-key-input"
              className="ref-field-label"
            >
              Gemini API Key (`gemini-2.5-flash-image`)
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                id="modal-gemini-api-key-input"
                type={showKey ? "text" : "password"}
                className="ref-input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your AIzaSy... key"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="ref-pill-chip"
                onClick={() => setShowKey((prev) => !prev)}
              >
                {showKey ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                className="ref-pill-chip"
                onClick={() => setApiKey("")}
              >
                Clear
              </button>
            </div>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 14px",
              borderRadius: "16px",
              backgroundColor: "var(--ref-card-surface)",
              border: "1px solid rgba(20, 33, 61, 0.22)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.86rem",
            }}
          >
            <input
              type="checkbox"
              checked={rememberKeyInVault}
              onChange={(e) => setRememberKeyInVault(e.target.checked)}
              style={{
                width: "18px",
                height: "18px",
                accentColor: "var(--ref-lime-accent)",
              }}
            />
            <span>Save API Key in local SQLite vault</span>
          </label>

          <div>
            <label
              htmlFor="modal-images-output-dir-input"
              className="ref-field-label"
            >
              Directory where all generated images will be saved
            </label>
            <input
              id="modal-images-output-dir-input"
              type="text"
              className="ref-input"
              value={dirInput}
              onChange={(e) => setDirInput(e.target.value)}
              placeholder="e.g. ~/Pictures/nanobanana"
            />
            <span
              style={{
                display: "block",
                fontSize: "0.74rem",
                color: "var(--ref-ink-secondary)",
                marginTop: "4px",
              }}
            >
              All 4 images generated in each interaction are automatically saved as PNG files in this folder.
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="ref-dark-pill-btn"
              onClick={handleSaveConfig}
            >
              <span>{savedNotice ? "Saved!" : "Save Settings"}</span>
              <span className="ref-lime-badge">
                {apiKey.trim() ? "ON" : "KEY"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
