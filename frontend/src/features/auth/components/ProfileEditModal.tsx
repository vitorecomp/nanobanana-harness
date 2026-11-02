"use client";

import React, { useState, useEffect } from "react";
import {
  buildInitialsAvatarDataUrl,
  updateUserProfile,
} from "../services/authService";
import { GoogleUserProfile } from "../types/auth.types";
import { GoogleGLogo, FacebookFLogo } from "./SocialAuthModal";

export interface ProfileEditModalProps {
  isOpen: boolean;
  user: GoogleUserProfile;
  onClose: () => void;
  onSave: (updatedUser: GoogleUserProfile) => void;
  onLogout: () => void;
}

function buildCustomColorAvatarDataUrl(
  name: string,
  bg: string,
  fg: string
): string {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (name.slice(0, 2) || "NB").toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
    <rect width="80" height="80" rx="40" fill="${bg}" stroke="#0B0B0B" stroke-width="4"/>
    <text x="40" y="49" text-anchor="middle" fill="${fg}" font-family="sans-serif" font-weight="800" font-size="28">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function ProfileEditModal({
  isOpen,
  user,
  onClose,
  onSave,
  onLogout,
}: ProfileEditModalProps) {
  const [name, setName] = useState<string>(user.name);
  const [email, setEmail] = useState<string>(user.email);
  const [picture, setPicture] = useState<string>(user.picture);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setName(user.name);
      setEmail(user.email);
      setPicture(user.picture);
      setErrorMsg(null);
      setSavedSuccess(false);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const avatarPresets = [
    {
      label: "Acid Yellow",
      url: buildCustomColorAvatarDataUrl(name || user.name, "#F2FA3C", "#0B0B0B"),
    },
    {
      label: "Cobalt Blue",
      url: buildCustomColorAvatarDataUrl(name || user.name, "#1877F2", "#FFFFFF"),
    },
    {
      label: "Studio Ink",
      url: buildCustomColorAvatarDataUrl(name || user.name, "#0B0B0B", "#F2FA3C"),
    },
    {
      label: "Emerald Mint",
      url: buildCustomColorAvatarDataUrl(name || user.name, "#10B981", "#0B0B0B"),
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Display name cannot be empty.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const updated = await updateUserProfile(user, {
        name: name.trim(),
        email: email.trim(),
        picture:
          picture.trim() ||
          buildInitialsAvatarDataUrl(name.trim(), user.provider),
      });
      onSave(updated);
      setSavedSuccess(true);
      setTimeout(() => {
        onClose();
      }, 350);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to update profile."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="google-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="google-modal-card">
        {/* Top Ink Header Bar */}
        <div className="google-modal-top-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {user.provider === "facebook" ? (
              <FacebookFLogo size={20} />
            ) : (
              <GoogleGLogo size={20} />
            )}
            <span
              id="profile-edit-modal-title"
              style={{
                fontWeight: 800,
                fontSize: "0.95rem",
                letterSpacing: "-0.01em",
              }}
            >
              Edit Creator Profile
            </span>
          </div>
          <button
            type="button"
            id="close-profile-edit-modal-btn"
            className="google-modal-close-btn"
            onClick={onClose}
            aria-label="Close profile editor modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="google-modal-body">
          {/* Live Profile Header Preview */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "12px 14px",
              borderRadius: "14px",
              border: "var(--border-ink)",
              backgroundColor: "var(--bg-canvas)",
            }}
          >
            <img
              src={
                picture ||
                buildInitialsAvatarDataUrl(name || user.name, user.provider)
              }
              alt={name || user.name}
              style={{
                width: "54px",
                height: "54px",
                borderRadius: "50%",
                border: "2px solid var(--bg-ink)",
                objectFit: "cover",
                flexShrink: 0,
                backgroundColor: "var(--bg-surface)",
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "1rem",
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name || "Unnamed Creator"}
              </div>
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {email}
              </div>
              <div
                style={{
                  fontSize: "0.74rem",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-muted)",
                  marginTop: "2px",
                }}
              >
                ID: {user.id} • {user.provider.toUpperCase()}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <div>
              <label
                htmlFor="profile-edit-name-input"
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                Display Name
              </label>
              <input
                id="profile-edit-name-input"
                type="text"
                className="studio-text-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your creator name"
                required
              />
            </div>

            <div>
              <label
                htmlFor="profile-edit-email-input"
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                Email Address
              </label>
              <input
                id="profile-edit-email-input"
                type="email"
                className="studio-text-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label
                htmlFor="profile-edit-picture-input"
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                Profile Picture URL or Quick Avatar Preset
              </label>
              <input
                id="profile-edit-picture-input"
                type="text"
                className="studio-text-input"
                value={picture}
                onChange={(e) => setPicture(e.target.value)}
                placeholder="https://... or choose a preset below"
              />
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginTop: "8px",
                }}
              >
                {avatarPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="interactive-chip"
                    style={{
                      minHeight: "34px",
                      padding: "4px 10px",
                      fontSize: "0.76rem",
                    }}
                    onClick={() => setPicture(preset.url)}
                  >
                    <img
                      src={preset.url}
                      alt=""
                      aria-hidden="true"
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                      }}
                    />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <p
                role="alert"
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "var(--status-danger)",
                }}
              >
                {errorMsg}
              </p>
            )}

            {savedSuccess && (
              <p
                role="status"
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#15803D",
                }}
              >
                Profile updated in PostgreSQL!
              </p>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
                marginTop: "6px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                id="profile-modal-logout-btn"
                className="interactive-chip"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
              >
                Sign Out
              </button>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  id="profile-modal-cancel-btn"
                  className="interactive-chip"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="profile-modal-save-btn"
                  className="primary-yellow-cta"
                  disabled={isSaving}
                  style={{ minHeight: "42px", padding: "0 20px" }}
                >
                  {isSaving ? "Saving..." : "Save Profile ✦"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
