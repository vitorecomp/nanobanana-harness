/**
 * PostgreSQL Conversation History, Community Public Gallery & RustFS Bucket Image Gallery Service
 *
 * SECURITY INVARIANT:
 * - Only persists prompts, conversation turns, metadata, and generated images.
 * - The user's Gemini / Nano Banana API Key NEVER touches these requests.
 */

import { fetchBackendApi } from "@/core/http/backendClient";
import {
  BucketGalleryItem,
  SavedConversationDetail,
  SavedConversationSummary,
  SavedTurnRecord,
} from "../types/history.types";

export const FALLBACK_PUBLIC_GALLERY: BucketGalleryItem[] = [
  {
    id: "showcase_turn_portrait",
    turn_id: "showcase_turn_portrait",
    conversation_id: "showcase_conv_crypko",
    conversation_title: "Editorial Anime Portrait Series",
    turn_number: 1,
    author_name: "Nano Banana Studio",
    author_id: "studio_editorial",
    raw_idea:
      "Editorial anime explorer character wearing an olive utility jacket and aviator goggles on forehead",
    master_prompt:
      "Editorial anime character portrait of a young explorer with copper hair and aviator goggles resting on the forehead, wearing a structured olive-green utility jacket over a crisp white tee. High-craft cel-shaded ink linework, graphic flat shadow blocks, warm bone-cream paper backdrop (#E9E7DF), acid-yellow (#F2FA3C) graphic accents, 85mm f/1.4 prime lens.",
    edit_instruction: "Flagship Editorial Cover (Turn #1)",
    style_id: "editorial-anime",
    modifiers: ["golden-hour", "lens-85mm", "cream-ink-acid"],
    aspect_ratio: "3:4",
    image_bucket_key: "showcase/hero-portrait.png",
    image_url: "/showcase/hero-portrait.png",
    model_used: "gemini-2.5-flash-image",
    is_published: true,
    is_curated: true,
    created_at: "2026-11-02T12:00:00Z",
  },
  {
    id: "showcase_turn_scene",
    turn_id: "showcase_turn_scene",
    conversation_id: "showcase_conv_street",
    conversation_title: "Sunlit Urban Duo Exploration",
    turn_number: 1,
    author_name: "Nano Banana Studio",
    author_id: "studio_editorial",
    raw_idea:
      "Two urban explorers walking down a sunlit street beneath a pastel teal sky",
    master_prompt:
      "Wide cinematic street scene of two anime urban explorers walking side by side down a sunlit avenue under a pastel teal sky. High-craft editorial anime illustration, 35mm street photography perspective, warm golden hour rim lighting, overhead power lines, crisp carbon-black ink outlines.",
    edit_instruction: "Cinematic Street Narrative (Turn #1)",
    style_id: "editorial-anime",
    modifiers: ["golden-hour", "lens-35mm", "pastel-teal-warm"],
    aspect_ratio: "16:9",
    image_bucket_key: "showcase/hero-scene.png",
    image_url: "/showcase/hero-scene.png",
    model_used: "gemini-2.5-flash-image",
    is_published: true,
    is_curated: true,
    created_at: "2026-11-02T12:05:00Z",
  },
  {
    id: "showcase_turn_step1",
    turn_id: "showcase_turn_step1",
    conversation_id: "showcase_conv_evolution",
    conversation_title: "Multi-Turn Explorer Evolution",
    turn_number: 1,
    author_name: "Art Director Co-Pilot",
    author_id: "studio_editorial",
    raw_idea: "Futuristic explorer character with aviator goggles on a sunlit street",
    master_prompt:
      "Portrait of a young anime explorer with copper hair, aviator goggles resting on forehead, olive-green utility jacket over white tee, high-craft editorial anime illustration, crisp cel-shaded ink linework, warm bone backdrop #E9E7DF.",
    edit_instruction: "Base Concept Diagnosis (Turn #1)",
    style_id: "editorial-anime",
    modifiers: ["studio-softbox", "lens-85mm"],
    aspect_ratio: "3:4",
    image_bucket_key: "showcase/step-1-base.png",
    image_url: "/showcase/step-1-base.png",
    model_used: "gemini-2.5-flash-image",
    is_published: true,
    is_curated: true,
    created_at: "2026-11-02T12:10:00Z",
  },
  {
    id: "showcase_turn_step2",
    turn_id: "showcase_turn_step2",
    conversation_id: "showcase_conv_evolution",
    conversation_title: "Multi-Turn Explorer Evolution",
    turn_number: 2,
    author_name: "Art Director Co-Pilot",
    author_id: "studio_editorial",
    raw_idea: "Futuristic explorer character with golden hour chiaroscuro lighting",
    master_prompt:
      "Keep exact character identity from Turn #1 and bathe the scene in dramatic Golden Hour sunset lighting with warm amber rim light, long diagonal cast shadows, and a pastel teal sky backdrop.",
    edit_instruction: "Make lighting dramatic Golden Hour (Turn #2)",
    style_id: "editorial-anime",
    modifiers: ["golden-hour", "lens-85mm", "pastel-teal-warm"],
    aspect_ratio: "3:4",
    image_bucket_key: "showcase/step-2-lighting.png",
    image_url: "/showcase/step-2-lighting.png",
    model_used: "gemini-2.5-flash-image",
    is_published: true,
    is_curated: true,
    created_at: "2026-11-02T12:15:00Z",
  },
  {
    id: "showcase_turn_step3",
    turn_id: "showcase_turn_step3",
    conversation_id: "showcase_conv_evolution",
    conversation_title: "Multi-Turn Explorer Evolution",
    turn_number: 3,
    author_name: "Art Director Co-Pilot",
    author_id: "studio_editorial",
    raw_idea: "Cyberpunk nocturnal Tokyo refinement with glowing acid-yellow visor",
    master_prompt:
      "Preserve exact character identity from Turn #2 and transform the setting into a cyberpunk Tokyo night with wet asphalt neon reflections and a translucent glowing acid-yellow (#F2FA3C) visor.",
    edit_instruction: "Add acid-yellow cyber visor & Tokyo night (Turn #3)",
    style_id: "cyberpunk-3d",
    modifiers: ["neon-rain", "acid-rim", "lens-85mm"],
    aspect_ratio: "3:4",
    image_bucket_key: "showcase/step-3-cyber.png",
    image_url: "/showcase/step-3-cyber.png",
    model_used: "gemini-2.5-flash-image",
    is_published: true,
    is_curated: true,
    created_at: "2026-11-02T12:20:00Z",
  },
];

export function resolveBucketImageUrl(url?: string | null): string {
  if (!url) return "/showcase/step-1-base.png";
  if (url.startsWith("data:") || url.startsWith("/showcase/")) {
    return url;
  }
  const bucketMatch = url.match(/\/api\/bucket\/.+$/);
  if (bucketMatch) {
    return bucketMatch[0];
  }
  return url;
}

export async function listUserConversations(
  userId: string
): Promise<SavedConversationSummary[]> {
  try {
    const res = await fetchBackendApi(
      `/api/conversations?user_id=${encodeURIComponent(userId)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list: SavedConversationSummary[] = Array.isArray(data)
      ? data
      : Array.isArray(data.conversations)
      ? data.conversations
      : [];

    return list.map((item) => ({
      ...item,
      id: String(item.id),
      turn_count: Number(item.turn_count ?? 0),
      preview_image_url: item.preview_image_url
        ? resolveBucketImageUrl(item.preview_image_url)
        : null,
    }));
  } catch {
    return [];
  }
}

export async function createConversation(params: {
  user_id: string;
  title: string;
  style_id?: string;
}): Promise<SavedConversationSummary | null> {
  try {
    const res = await fetchBackendApi("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const conv = data.conversation || data;
    return {
      id: String(conv.id),
      user_id: String(conv.user_id || params.user_id),
      title: conv.title || params.title,
      style_id: conv.style_id || params.style_id,
      turn_count: Number(conv.turn_count ?? 0),
      latest_prompt: conv.latest_prompt || null,
      preview_image_url: conv.preview_image_url
        ? resolveBucketImageUrl(conv.preview_image_url)
        : null,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
    };
  } catch {
    return null;
  }
}

export async function getConversationDetail(
  conversationId: string,
  userId?: string
): Promise<SavedConversationDetail | null> {
  try {
    const query = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
    const res = await fetchBackendApi(
      `/api/conversations/${encodeURIComponent(conversationId)}${query}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const conv = data.conversation || data;
    const rawTurns: SavedTurnRecord[] = Array.isArray(conv.turns)
      ? conv.turns
      : Array.isArray(data.turns)
      ? data.turns
      : [];

    return {
      id: String(conv.id || conversationId),
      user_id: String(conv.user_id || userId || ""),
      title: conv.title || "Creative Conversation",
      style_id: conv.style_id,
      turn_count: rawTurns.length,
      latest_prompt: conv.latest_prompt,
      preview_image_url: conv.preview_image_url
        ? resolveBucketImageUrl(conv.preview_image_url)
        : null,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      turns: rawTurns.map((t, idx) => ({
        ...t,
        id: String(t.id || `turn-${idx + 1}`),
        conversation_id: String(t.conversation_id || conversationId),
        turn_number: Number(t.turn_number ?? idx + 1),
        image_url: resolveBucketImageUrl(t.image_url),
        is_published: Boolean(t.is_published),
      })),
    };
  } catch {
    return null;
  }
}

export async function saveConversationTurn(
  conversationId: string,
  payload: {
    user_id: string;
    role?: string;
    raw_idea: string;
    master_prompt: string;
    edit_instruction?: string;
    style_id?: string;
    modifiers?: string[];
    completeness_score?: number;
    analysis?: Record<string, unknown>;
    image_data_url?: string;
    aspect_ratio?: string;
    model_used?: string;
    is_published?: boolean;
  }
): Promise<SavedTurnRecord | null> {
  try {
    const res = await fetchBackendApi(
      `/api/conversations/${encodeURIComponent(conversationId)}/turns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          role: payload.role || "assistant",
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const turn = data.turn || data;
    return {
      ...turn,
      id: String(turn.id || `turn-${Date.now()}`),
      conversation_id: String(turn.conversation_id || conversationId),
      turn_number: Number(turn.turn_number ?? 1),
      image_url: resolveBucketImageUrl(turn.image_url || payload.image_data_url),
      image_bucket_key: turn.image_bucket_key || null,
      is_published: Boolean(turn.is_published),
    };
  } catch {
    return null;
  }
}

export async function toggleTurnPublish(
  turnId: string,
  isPublished?: boolean
): Promise<SavedTurnRecord | null> {
  try {
    const res = await fetchBackendApi(
      `/api/turns/${encodeURIComponent(turnId)}/publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          typeof isPublished === "boolean" ? { is_published: isPublished } : {}
        ),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ...data,
      id: String(data.id || turnId),
      is_published: Boolean(data.is_published),
    };
  } catch {
    return null;
  }
}

export async function fetchUserBucketGallery(
  userId: string
): Promise<BucketGalleryItem[]> {
  try {
    const res = await fetchBackendApi(
      `/api/users/${encodeURIComponent(userId)}/gallery`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: BucketGalleryItem[] = Array.isArray(data)
      ? data
      : Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.gallery)
      ? data.gallery
      : [];

    return items.map((item, idx) => ({
      ...item,
      id: String(item.turn_id || item.id || `gallery-${idx}`),
      turn_id: String(item.turn_id || item.id || `gallery-${idx}`),
      conversation_id: String(item.conversation_id || ""),
      turn_number: Number(item.turn_number ?? idx + 1),
      image_url: resolveBucketImageUrl(item.image_url),
      is_published: Boolean(item.is_published),
    }));
  } catch {
    return [];
  }
}

export async function fetchPublicGallery(): Promise<BucketGalleryItem[]> {
  try {
    const res = await fetchBackendApi("/api/gallery/public", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return FALLBACK_PUBLIC_GALLERY;
    const data = await res.json();
    const items: BucketGalleryItem[] = Array.isArray(data)
      ? data
      : Array.isArray(data.items)
      ? data.items
      : [];

    if (items.length === 0) return FALLBACK_PUBLIC_GALLERY;

    return items.map((item, idx) => ({
      ...item,
      id: String(item.turn_id || item.id || `public-${idx}`),
      turn_id: String(item.turn_id || item.id || `public-${idx}`),
      conversation_id: String(item.conversation_id || ""),
      turn_number: Number(item.turn_number ?? idx + 1),
      image_url: resolveBucketImageUrl(item.image_url),
      is_published: true,
    }));
  } catch {
    return FALLBACK_PUBLIC_GALLERY;
  }
}
