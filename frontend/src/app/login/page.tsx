"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStudioSession } from "@/core/context/StudioSessionContext";
import {
  AuthProvider,
  FACEBOOK_APP_ID,
  GOOGLE_CLIENT_ID,
  GoogleGLogo,
  FacebookFLogo,
  LOCAL_DEV_USER,
  authenticateWithFacebook,
  authenticateWithGoogle,
  buildInitialsAvatarDataUrl,
} from "@/features/auth";

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

export default function LoginPage() {
  const router = useRouter();
  const { user, setUser, setBackendOnline } = useStudioSession();

  const [selectedProvider, setSelectedProvider] =
    useState<AuthProvider>("google");
  const [customName, setCustomName] = useState<string>("Elena Vance");
  const [customEmail, setCustomEmail] = useState<string>(
    "elena.vance@gmail.com"
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const gisButtonContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedProvider !== "google" || !GOOGLE_CLIENT_ID) return;

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
              setUser(result.user);
              if (result.verifiedByBackend) setBackendOnline(true);
              router.push("/gallery?tab=personal");
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
  }, [selectedProvider, router, setBackendOnline, setUser]);

  const handleProfileSignIn = async (
    provider: AuthProvider,
    name: string,
    email: string
  ) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const picture = buildInitialsAvatarDataUrl(name, provider);
      const result =
        provider === "facebook"
          ? await authenticateWithFacebook({
              dev_profile: { name, email, picture },
            })
          : await authenticateWithGoogle({
              dev_profile: { name, email, picture },
            });

      setUser(result.user);
      if (result.verifiedByBackend) {
        setBackendOnline(true);
      }
      router.push("/gallery?tab=personal");
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Authentication with backend failed."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueAsLocalDev = () => {
    setUser(LOCAL_DEV_USER);
    router.push("/gallery?tab=personal");
  };

  const activeAccounts =
    selectedProvider === "facebook"
      ? QUICK_FACEBOOK_ACCOUNTS
      : QUICK_GOOGLE_ACCOUNTS;

  return (
    <section
      className="editorial-section"
      aria-labelledby="login-page-heading"
    >
      <div className="section-header-row">
        <div>
          <h1 id="login-page-heading" className="section-display-title">
            CREATOR SIGN IN &amp; PERSONAL GALLERY ACCESS
          </h1>
        </div>
        <p className="section-lead-copy">
          Sign in with <strong>Google OAuth 2.0</strong> or{" "}
          <strong>Facebook Login</strong> to enter your{" "}
          <strong>Personal Gallery</strong>, persist multi-turn prompt sessions
          in <strong>PostgreSQL</strong>, and store generated images in the{" "}
          <strong>RustFS S3 Bucket</strong>.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "28px",
          alignItems: "start",
        }}
      >
        {/* LEFT CARD: OAuth Sign-In Card */}
        <div
          className="google-modal-card"
          style={{ width: "100%", maxWidth: "none" }}
        >
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
            <span
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.74rem",
                color: "var(--accent-yellow)",
              }}
            >
              REDIRECTS TO → /gallery?tab=personal
            </span>
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
                id="login-tab-google-btn"
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
                id="login-tab-facebook-btn"
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

            <h2 className="google-modal-title">
              {selectedProvider === "facebook"
                ? "SIGN IN WITH FACEBOOK"
                : "SIGN IN WITH GOOGLE"}
            </h2>
            <p className="google-modal-subtitle">
              Upon authentication, you will be redirected straight to your{" "}
              <strong>Personal Gallery</strong> where all your{" "}
              <strong>PostgreSQL</strong> conversations and{" "}
              <strong>RustFS Bucket</strong> images are organized.
            </p>

            {selectedProvider === "google" && GOOGLE_CLIENT_ID && (
              <div
                ref={gisButtonContainerRef}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  margin: "8px 0",
                }}
              />
            )}

            <div className="field-block">
              <span className="field-block-title">
                1-Click {selectedProvider === "facebook" ? "Facebook" : "Google"}{" "}
                Creator Profiles:
              </span>
              <div className="google-accounts-list">
                {activeAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    id={`login-quick-account-${acc.email.split("@")[0]}`}
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
                  customName.trim() ||
                    (selectedProvider === "facebook"
                      ? "Facebook Creator"
                      : "Google Creator"),
                  customEmail.trim()
                );
              }}
            >
              <span className="field-block-title">
                Or enter your custom{" "}
                {selectedProvider === "facebook" ? "Facebook" : "Google"}{" "}
                creator profile:
              </span>
              <div className="google-form-row">
                <input
                  id="login-name-input"
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Your full name"
                  className="studio-text-input"
                  required
                />
                <input
                  id="login-email-input"
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder={
                    selectedProvider === "facebook"
                      ? "you@facebook.com"
                      : "you@gmail.com"
                  }
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
                id="login-submit-btn"
                className="primary-yellow-cta"
                disabled={isLoading}
              >
                {selectedProvider === "facebook" ? (
                  <FacebookFLogo size={22} />
                ) : (
                  <GoogleGLogo size={22} />
                )}
                <span>
                  {isLoading
                    ? `Signing in with ${
                        selectedProvider === "facebook" ? "Facebook" : "Google"
                      }...`
                    : `Sign In & Open My Personal Gallery ★`}
                </span>
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT CARD: Local Dev Instant Entry & Zero-Storage Guarantee */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="copilot-panel-card">
            <h2
              style={{
                fontFamily: "var(--font-display), sans-serif",
                fontSize: "1.6rem",
                letterSpacing: "0.01em",
                marginBottom: "8px",
              }}
            >
              ACTIVE SESSION STATUS
            </h2>
            {user ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <img
                  src={user.picture}
                  alt={user.name}
                  className="user-avatar-img"
                />
                <div>
                  <strong style={{ display: "block", fontSize: "1rem" }}>
                    {user.name}
                  </strong>
                  <span
                    style={{
                      fontSize: "0.84rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {user.email} • ID: <code>{user.id}</code>
                  </span>
                </div>
              </div>
            ) : (
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "var(--text-secondary)",
                  marginBottom: "16px",
                }}
              >
                No social account currently signed in.
              </p>
            )}

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                id="login-open-personal-gallery-btn"
                className="explore-download-pill"
                onClick={() => router.push("/gallery?tab=personal")}
              >
                <span>Go to My Personal Gallery</span>
                <span className="explore-pill-yellow-circle">→</span>
              </button>

              <button
                type="button"
                id="login-local-dev-btn"
                className="secondary-ink-cta"
                onClick={handleContinueAsLocalDev}
              >
                <span>Continue as Local Dev Profile (usr_local_dev)</span>
              </button>
            </div>
          </div>

          <div className="storage-auditor-box">
            <h3
              style={{
                fontSize: "1.05rem",
                fontWeight: 800,
                marginBottom: "8px",
                color: "var(--accent-yellow)",
              }}
            >
              ZERO-STORAGE API KEY GUARANTEE
            </h3>
            <p
              style={{
                fontSize: "0.88rem",
                color: "var(--text-on-ink-muted)",
                lineHeight: 1.55,
              }}
            >
              Signing in with Google or Facebook only links your{" "}
              <strong>PostgreSQL</strong> prompt history and{" "}
              <strong>RustFS Bucket</strong> gallery to your user ID via{" "}
              <code>POST /api/auth/google</code> or{" "}
              <code>POST /api/auth/facebook</code>. Your{" "}
              <strong>Google Gemini API Key (Nano Banana)</strong> is never
              linked to your account or transmitted to our backend — it lives
              100% in volatile React RAM (<code>useState</code>) inside the
              browser.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
