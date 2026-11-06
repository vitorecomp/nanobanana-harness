"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FACEBOOK_APP_ID,
  GOOGLE_CLIENT_ID,
  authenticateWithFacebook,
  authenticateWithGoogle,
  buildInitialsAvatarDataUrl,
} from "../services/authService";
import { AuthProvider, GoogleUserProfile } from "../types/auth.types";
import { IconClose } from "@/shared/components/icons/AtelierIcons";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>
          ) => void;
        };
      };
    };
    FB?: {
      init: (config: {
        appId: string;
        cookie?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: { accessToken?: string; userID?: string };
        }) => void,
        options?: { scope: string }
      ) => void;
    };
  }
}

export interface SocialAuthModalProps {
  isOpen: boolean;
  initialProvider?: AuthProvider;
  onClose: () => void;
  onSuccess: (user: GoogleUserProfile, verifiedByBackend: boolean) => void;
}

const QUICK_GOOGLE_ACCOUNTS = [
  {
    name: "Elena Vance (Art Director)",
    email: "elena.vance@gmail.com",
    role: "Google Creative Account",
  },
  {
    name: "Vitor Vieira (Engineering)",
    email: "vieiravitor@google.com",
    role: "Google Workspace Account",
  },
];

const QUICK_FACEBOOK_ACCOUNTS = [
  {
    name: "Elena Vance (Visual Studio)",
    email: "elena.vance.art@facebook.com",
    role: "Facebook Creator Account",
  },
  {
    name: "Lucas Mendes (Anime Illustrator)",
    email: "lucas.mendes@facebook.com",
    role: "Facebook Social Account",
  },
];

export function GoogleGLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function FacebookFLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="11" fill="#1877F2" />
      <path
        d="M15.12 12.68l.42-2.74h-2.63V8.16c0-.75.37-1.48 1.54-1.48h1.19V4.35s-1.08-.18-2.11-.18c-2.16 0-3.57 1.31-3.57 3.68v2.09H7.56v2.74h2.4v6.63c.48.08.97.12 1.47.12s.99-.04 1.47-.12v-6.63h2.22z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export default function SocialAuthModal({
  isOpen,
  initialProvider = "google",
  onClose,
  onSuccess,
}: SocialAuthModalProps) {
  const [selectedProvider, setSelectedProvider] =
    useState<AuthProvider>(initialProvider);
  const [customName, setCustomName] = useState<string>("Elena Vance");
  const [customEmail, setCustomEmail] = useState<string>(
    "elena.vance@gmail.com"
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const gisButtonContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedProvider(initialProvider);
    if (initialProvider === "facebook") {
      setCustomEmail("elena.vance.art@facebook.com");
    } else {
      setCustomEmail("elena.vance@gmail.com");
    }
  }, [initialProvider, isOpen]);

  useEffect(() => {
    if (!isOpen || selectedProvider !== "google" || !GOOGLE_CLIENT_ID) return;

    const initializeGis = () => {
      if (
        window.google?.accounts?.id &&
        gisButtonContainerRef.current &&
        GOOGLE_CLIENT_ID
      ) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            if (!response.credential) return;
            setIsLoading(true);
            setErrorMsg(null);
            try {
              const result = await authenticateWithGoogle({
                credential: response.credential,
                client_id: GOOGLE_CLIENT_ID,
              });
              onSuccess(result.user, result.verifiedByBackend);
            } catch (err) {
              setErrorMsg(
                err instanceof Error
                  ? err.message
                  : "Failed to verify Google credential."
              );
            } finally {
              setIsLoading(false);
            }
          },
        });
        window.google.accounts.id.renderButton(gisButtonContainerRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
          width: 320,
        });
      }
    };

    const existingScript = document.getElementById("google-gsi-client-script");
    if (existingScript) {
      initializeGis();
      return;
    }

    const script = document.createElement("script");
    script.id = "google-gsi-client-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeGis;
    document.head.appendChild(script);
  }, [isOpen, selectedProvider, onSuccess]);

  if (!isOpen) return null;

  const handleProfileSignIn = async (
    provider: AuthProvider,
    name: string,
    email: string
  ) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const picture = buildInitialsAvatarDataUrl(name, provider);
      if (provider === "facebook") {
        const result = await authenticateWithFacebook({
          dev_profile: {
            name,
            email,
            picture,
          },
        });
        onSuccess(result.user, result.verifiedByBackend);
      } else {
        const result = await authenticateWithGoogle({
          dev_profile: {
            name,
            email,
            picture,
          },
        });
        onSuccess(result.user, result.verifiedByBackend);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Failed to authenticate with backend."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const activeAccounts =
    selectedProvider === "facebook"
      ? QUICK_FACEBOOK_ACCOUNTS
      : QUICK_GOOGLE_ACCOUNTS;

  return (
    <div
      className="google-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="social-auth-modal-title"
    >
      <div className="google-modal-card">
        <div className="google-modal-top-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {selectedProvider === "facebook" ? (
              <FacebookFLogo size={20} />
            ) : (
              <GoogleGLogo size={20} />
            )}
            <span
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "0.03em",
              }}
            >
              {selectedProvider === "facebook"
                ? "FACEBOOK OAUTH • SOCIAL HANDSHAKE"
                : "GOOGLE IDENTITY • OAUTH 2.0 HANDSHAKE"}
            </span>
          </div>
          <button
            type="button"
            id="close-google-modal-btn"
            className="google-modal-close-btn"
            onClick={onClose}
            aria-label="Close sign-in modal"
          >
            <IconClose size={12} />
          </button>
        </div>

        <div className="google-modal-body">
          <div
            className="chips-wrap"
            role="tablist"
            aria-label="Social Login Provider"
          >
            <button
              type="button"
              role="tab"
              id="auth-tab-google-btn"
              aria-selected={selectedProvider === "google"}
              className={`interactive-chip ${
                selectedProvider === "google" ? "selected" : ""
              }`}
              onClick={() => {
                setSelectedProvider("google");
                setCustomEmail("elena.vance@gmail.com");
                setErrorMsg(null);
              }}
            >
              <GoogleGLogo size={18} />
              <span>Sign in with Google</span>
            </button>

            <button
              type="button"
              role="tab"
              id="auth-tab-facebook-btn"
              aria-selected={selectedProvider === "facebook"}
              className={`interactive-chip ${
                selectedProvider === "facebook" ? "selected" : ""
              }`}
              onClick={() => {
                setSelectedProvider("facebook");
                setCustomEmail("elena.vance.art@facebook.com");
                setErrorMsg(null);
              }}
            >
              <FacebookFLogo size={18} />
              <span>Sign in with Facebook</span>
            </button>
          </div>

          <h2 id="social-auth-modal-title" className="google-modal-title">
            {selectedProvider === "facebook"
              ? "SIGN IN WITH FACEBOOK"
              : "SIGN IN WITH GOOGLE"}
          </h2>
          <p className="google-modal-subtitle">
            Authenticate your{" "}
            <strong>
              {selectedProvider === "facebook" ? "Facebook" : "Google"}
            </strong>{" "}
            account to save multi-turn conversations in{" "}
            <strong>PostgreSQL</strong> and store generated images in the{" "}
            <strong>RustFS Bucket</strong>.
          </p>

          <div className="field-block">
            <span className="field-block-title">
              1-Click {selectedProvider === "facebook" ? "Facebook" : "Google"}{" "}
              Accounts:
            </span>
            <div className="google-accounts-list">
              {activeAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className="google-account-option-btn"
                  disabled={isLoading}
                  onClick={() =>
                    handleProfileSignIn(selectedProvider, acc.name, acc.email)
                  }
                >
                  {selectedProvider === "facebook" ? (
                    <FacebookFLogo size={24} />
                  ) : (
                    <GoogleGLogo size={24} />
                  )}
                  <div style={{ textAlign: "left", flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: "0.92rem",
                        color: "var(--text-primary)",
                      }}
                    >
                      {acc.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: "0.76rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {acc.email} • {acc.role}
                    </div>
                  </div>
                  <span className="explore-pill-yellow-circle">→</span>
                </button>
              ))}
            </div>
          </div>

          <form
            className="google-custom-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!customEmail.trim()) return;
              handleProfileSignIn(
                selectedProvider,
                customName.trim() || "Studio Creator",
                customEmail.trim()
              );
            }}
          >
            <div className="google-form-row">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Your full name"
                className="studio-text-input"
                required
              />
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="you@example.com"
                className="studio-text-input"
                required
              />
            </div>

            {errorMsg && (
              <div className="editorial-alert" role="alert">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="primary-yellow-cta"
              disabled={isLoading}
            >
              <span>
                {isLoading ? "Authenticating..." : "Continue ★"}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
