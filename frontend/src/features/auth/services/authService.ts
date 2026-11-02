/**
 * Social Authentication Service (Google OAuth 2.0 & Facebook Login)
 *
 * Connects to Flask + SQLAlchemy endpoints:
 * - `POST /api/auth/google`
 * - `POST /api/auth/facebook`
 *
 * SECURITY INVARIANT:
 * - Authenticates user identity via Google or Facebook OAuth.
 * - Never touches, stores, or transmits the user's Gemini / Nano Banana API Key.
 */

import {
  DEFAULT_LOCAL_DEV_USER_ID,
  FACEBOOK_APP_ID,
  GOOGLE_CLIENT_ID,
  IS_AUTH_REQUIRED,
} from "@/core/config/env";
import { fetchBackendApi } from "@/core/http/backendClient";
import {
  AuthProvider,
  FacebookAuthRequestPayload,
  GoogleAuthRequestPayload,
  GoogleUserProfile,
  SocialAuthBackendResponse,
} from "../types/auth.types";

export { GOOGLE_CLIENT_ID, FACEBOOK_APP_ID, IS_AUTH_REQUIRED };

export function buildInitialsAvatarDataUrl(
  name: string,
  provider: AuthProvider = "google"
): string {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (name.slice(0, 2) || "NB").toUpperCase();

  const bg = provider === "facebook" ? "#1877F2" : "#F2FA3C";
  const fg = provider === "facebook" ? "#FFFFFF" : "#0B0B0B";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
    <rect width="80" height="80" rx="40" fill="${bg}" stroke="#0B0B0B" stroke-width="4"/>
    <text x="40" y="49" text-anchor="middle" fill="${fg}" font-family="sans-serif" font-weight="800" font-size="28">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const LOCAL_DEV_USER: GoogleUserProfile = {
  id: DEFAULT_LOCAL_DEV_USER_ID,
  name: "Local Studio Creator",
  email: "dev@localhost",
  picture: buildInitialsAvatarDataUrl("Local Studio", "google"),
  provider: "google",
  authenticatedAt: "Dev Mode (Auth Optional)",
};

export async function authenticateWithGoogle(
  payload: GoogleAuthRequestPayload
): Promise<{ user: GoogleUserProfile; verifiedByBackend: boolean }> {
  const fallbackName =
    payload.dev_profile?.name?.trim() || "Nano Banana Creator";
  const fallbackEmail =
    payload.dev_profile?.email?.trim() || "creator@google.com";
  const fallbackPicture =
    payload.dev_profile?.picture ||
    buildInitialsAvatarDataUrl(fallbackName, "google");

  try {
    const response = await fetchBackendApi("/api/auth/google", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(
        errBody.detail ||
          `Google authentication failed (HTTP ${response.status})`
      );
    }

    const data = (await response.json()) as SocialAuthBackendResponse;
    if (!data.authenticated || !data.user) {
      throw new Error("Invalid Google authentication response.");
    }

    return {
      user: {
        id: data.user.id || `google-${Date.now()}`,
        name: data.user.name || fallbackName,
        email: data.user.email || fallbackEmail,
        picture:
          data.user.picture ||
          buildInitialsAvatarDataUrl(data.user.name || fallbackName, "google"),
        provider: "google",
        authenticatedAt: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      verifiedByBackend: true,
    };
  } catch (err) {
    if (
      payload.credential &&
      !payload.dev_profile &&
      err instanceof Error &&
      err.message.includes("HTTP 4")
    ) {
      throw err;
    }

    return {
      user: {
        id: `google-local-${Date.now()}`,
        name: fallbackName,
        email: fallbackEmail,
        picture: fallbackPicture,
        provider: "google",
        authenticatedAt: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      verifiedByBackend: false,
    };
  }
}

export async function authenticateWithFacebook(
  payload: FacebookAuthRequestPayload
): Promise<{ user: GoogleUserProfile; verifiedByBackend: boolean }> {
  const fallbackName =
    payload.dev_profile?.name?.trim() || "Facebook Creator";
  const fallbackEmail =
    payload.dev_profile?.email?.trim() || "creator@facebook.com";
  const fallbackPicture =
    payload.dev_profile?.picture ||
    buildInitialsAvatarDataUrl(fallbackName, "facebook");

  try {
    const response = await fetchBackendApi("/api/auth/facebook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(
        errBody.detail ||
          `Facebook authentication failed (HTTP ${response.status})`
      );
    }

    const data = (await response.json()) as SocialAuthBackendResponse;
    if (!data.authenticated || !data.user) {
      throw new Error("Invalid Facebook authentication response.");
    }

    return {
      user: {
        id: data.user.id || `fb-${Date.now()}`,
        name: data.user.name || fallbackName,
        email: data.user.email || fallbackEmail,
        picture:
          data.user.picture ||
          buildInitialsAvatarDataUrl(
            data.user.name || fallbackName,
            "facebook"
          ),
        provider: "facebook",
        authenticatedAt: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      verifiedByBackend: true,
    };
  } catch (err) {
    if (
      payload.access_token &&
      !payload.dev_profile &&
      err instanceof Error &&
      err.message.includes("HTTP 4")
    ) {
      throw err;
    }

    return {
      user: {
        id: `facebook-local-${Date.now()}`,
        name: fallbackName,
        email: fallbackEmail,
        picture: fallbackPicture,
        provider: "facebook",
        authenticatedAt: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      verifiedByBackend: false,
    };
  }
}

export async function updateUserProfile(
  currentUser: GoogleUserProfile,
  updates: {
    name: string;
    email: string;
    picture: string;
  }
): Promise<GoogleUserProfile> {
  const cleanName = updates.name.trim() || currentUser.name;
  const cleanEmail = updates.email.trim() || currentUser.email;
  const cleanPicture =
    updates.picture.trim() ||
    buildInitialsAvatarDataUrl(cleanName, currentUser.provider);

  try {
    const response = await fetchBackendApi(
      `/api/users/${encodeURIComponent(currentUser.id)}/profile`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          picture: cleanPicture,
          provider: currentUser.provider,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data?.user) {
        return {
          ...currentUser,
          name: data.user.name || cleanName,
          email: data.user.email || cleanEmail,
          picture: data.user.picture || cleanPicture,
        };
      }
    }
  } catch {
    // Fallback to in-memory update if backend is temporarily unreachable
  }

  return {
    ...currentUser,
    name: cleanName,
    email: cleanEmail,
    picture: cleanPicture,
  };
}
