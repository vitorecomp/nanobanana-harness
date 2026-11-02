/**
 * Core Environment & Runtime Configuration
 *
 * SECURITY INVARIANT:
 * - No user Gemini API key is ever configured or stored here.
 */

export const CONFIGURED_BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || ""
).replace(/\/$/, "");

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export const FACEBOOK_APP_ID =
  process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";

/**
 * In local / dev mode (`NEXT_PUBLIC_REQUIRE_AUTH !== "true"`), login is NOT required:
 * the Studio is immediately unlocked using `LOCAL_DEV_USER` (`usr_local_dev`) so
 * developers can persist prompts in PostgreSQL and images in RustFS out-of-the-box.
 * In production (`NEXT_PUBLIC_REQUIRE_AUTH === "true"`), Google or Facebook OAuth is enforced.
 */
export const IS_AUTH_REQUIRED =
  process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export const DEFAULT_LOCAL_DEV_USER_ID = "usr_local_dev";
