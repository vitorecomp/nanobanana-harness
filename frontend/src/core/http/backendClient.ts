/**
 * Unified Backend HTTP Client (`fetchBackendApi`)
 *
 * Supports:
 * 1. Relative `/api/...` (routed via Nginx Reverse Proxy on :18080 or Next.js rewrites on :13000 / :3000)
 * 2. Configured `NEXT_PUBLIC_BACKEND_URL`
 * 3. Direct local fallbacks (`http://localhost:8000` and Dev Port Pad `http://localhost:18000`)
 *
 * SECURITY INVARIANT:
 * - Never sends or accepts any Gemini / Nano Banana API Key.
 */

import { CONFIGURED_BACKEND_URL } from "@/core/config/env";

export async function fetchBackendApi(
  apiPath: string,
  init?: RequestInit
): Promise<Response> {
  const candidates: string[] = [];
  if (CONFIGURED_BACKEND_URL) {
    candidates.push(`${CONFIGURED_BACKEND_URL}${apiPath}`);
  }
  candidates.push(apiPath);
  if (!candidates.includes(`http://localhost:8000${apiPath}`)) {
    candidates.push(`http://localhost:8000${apiPath}`);
  }
  if (!candidates.includes(`http://localhost:18000${apiPath}`)) {
    candidates.push(`http://localhost:18000${apiPath}`);
  }

  let lastError: unknown = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, init);
      if (res.status !== 404 && res.status !== 502 && res.status !== 503) {
        return res;
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`Backend unreachable for ${apiPath}`);
}
