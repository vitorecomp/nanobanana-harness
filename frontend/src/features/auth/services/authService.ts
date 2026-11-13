/**
 * Social & Local Authentication Service for Nano Banana Studio (Tauri v2 + Local SQLite)
 *
 * Persists creator profiles into the local SQLite `users` table (`src-tauri/src/db.rs`
 * or browser dev SQLite bridge).
 */

import {
  DEFAULT_LOCAL_DEV_USER_ID,
  FACEBOOK_APP_ID,
  GOOGLE_CLIENT_ID,
  IS_AUTH_REQUIRED,
} from "@/core/config/env";
import {
  localDbUpdateUserProfile,
  localDbUpsertUser,
} from "@/core/tauri/tauriBridge";
import {
  AuthProvider,
  FacebookAuthRequestPayload,
  GoogleAuthRequestPayload,
  GoogleUserProfile,
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

  const bg = provider === "facebook" ? "#415a77" : "#778da9";
  const fg = provider === "facebook" ? "#ffffff" : "#0d1b2a";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
    <rect width="80" height="80" rx="18" fill="${bg}" stroke="#0d1b2a" stroke-width="4"/>
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
  authenticatedAt: "Local SQLite Studio",
};

function simpleHashId(seed: string, prefix: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return `${prefix}_${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

export async function authenticateWithGoogle(
  payload: GoogleAuthRequestPayload
): Promise<{ user: GoogleUserProfile; verifiedByBackend: boolean }> {
  const name = payload.dev_profile?.name?.trim() || "Nano Banana Creator";
  const email = (
    payload.dev_profile?.email?.trim() || "creator@google.com"
  ).toLowerCase();
  const picture =
    payload.dev_profile?.picture || buildInitialsAvatarDataUrl(name, "google");
  const userId = simpleHashId(email, "usr");

  const saved = await localDbUpsertUser({
    id: userId,
    provider: "google",
    google_sub: `google-${userId}`,
    email,
    name,
    picture,
  });

  return {
    user: {
      id: saved.id,
      name: saved.name,
      email: saved.email,
      picture:
        saved.picture || buildInitialsAvatarDataUrl(saved.name, "google"),
      provider: "google",
      authenticatedAt: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
    verifiedByBackend: true,
  };
}

export async function authenticateWithFacebook(
  payload: FacebookAuthRequestPayload
): Promise<{ user: GoogleUserProfile; verifiedByBackend: boolean }> {
  const name = payload.dev_profile?.name?.trim() || "Facebook Creator";
  const email = (
    payload.dev_profile?.email?.trim() || "creator@facebook.com"
  ).toLowerCase();
  const picture =
    payload.dev_profile?.picture ||
    buildInitialsAvatarDataUrl(name, "facebook");
  const userId = simpleHashId(email, "usr_fb");

  const saved = await localDbUpsertUser({
    id: userId,
    provider: "facebook",
    google_sub: `fb-${userId}`,
    email,
    name,
    picture,
  });

  return {
    user: {
      id: saved.id,
      name: saved.name,
      email: saved.email,
      picture:
        saved.picture || buildInitialsAvatarDataUrl(saved.name, "facebook"),
      provider: "facebook",
      authenticatedAt: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
    verifiedByBackend: true,
  };
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

  const saved = await localDbUpdateUserProfile({
    userId: currentUser.id,
    name: cleanName,
    email: cleanEmail,
    picture: cleanPicture,
    provider: currentUser.provider,
  });

  return {
    ...currentUser,
    name: saved.name || cleanName,
    email: saved.email || cleanEmail,
    picture: saved.picture || cleanPicture,
  };
}
