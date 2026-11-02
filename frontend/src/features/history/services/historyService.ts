/**
 * Local SQLite Conversation History & Native Filesystem Image Service
 *
 * SECURITY INVARIANT:
 * - Only persists prompts, conversation turns, metadata, and generated images locally in SQLite.
 * - Zero mocked gallery rows or hardcoded showcase fallback images.
 */

import {
  localDbCreateConversation,
  localDbDeleteConversation,
  localDbGetConversationDetail,
  localDbGetPublishedTurns,
  localDbGetUserGallery,
  localDbListConversations,
  localDbSaveConversationTurn,
  localDbToggleTurnPublish,
  localDbUpdateConversationTitle,
  localDbUpdateTurnSelection,
} from "@/core/tauri/tauriBridge";
import {
  BucketGalleryItem,
  SavedConversationDetail,
  SavedConversationSummary,
  SavedTurnRecord,
} from "../types/history.types";

export const FALLBACK_PUBLIC_GALLERY: BucketGalleryItem[] = [];

export function resolveBucketImageUrl(url?: string | null): string {
  if (!url) return "";
  return url;
}

export async function listUserConversations(
  userId: string
): Promise<SavedConversationSummary[]> {
  try {
    const list = await localDbListConversations(userId);
    return list.map((item) => ({
      ...item,
      id: String(item.id),
      turn_count: Number(item.turn_count ?? 0),
      preview_image_url: item.preview_image_url || null,
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
    const conv = await localDbCreateConversation(params);
    return {
      id: String(conv.id),
      user_id: String(conv.user_id || params.user_id),
      title: conv.title || params.title,
      style_id: conv.style_id || params.style_id,
      turn_count: Number(conv.turn_count ?? 0),
      latest_prompt: conv.latest_prompt || null,
      preview_image_url: conv.preview_image_url || null,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
    };
  } catch {
    return null;
  }
}

export async function deleteConversation(
  conversationId: string
): Promise<boolean> {
  try {
    return await localDbDeleteConversation(conversationId);
  } catch {
    return false;
  }
}

export async function getConversationDetail(
  conversationId: string,
  userId?: string
): Promise<SavedConversationDetail | null> {
  try {
    const conv = await localDbGetConversationDetail(conversationId);
    if (!conv) return null;
    const rawTurns = Array.isArray(conv.turns) ? conv.turns : [];

    return {
      id: String(conv.id || conversationId),
      user_id: String(conv.user_id || userId || ""),
      title: conv.title || "Untitled Project",
      style_id: conv.style_id,
      turn_count: rawTurns.length,
      latest_prompt: conv.latest_prompt || undefined,
      preview_image_url: conv.preview_image_url || null,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      turns: rawTurns.map((t, idx) => ({
        ...t,
        id: String(t.id || `turn-${idx + 1}`),
        conversation_id: String(t.conversation_id || conversationId),
        turn_number: Number(t.turn_number ?? idx + 1),
        image_url: t.image_url || undefined,
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
    title?: string;
    parent_turn_number?: number | null;
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
    variants?: Array<{
      label: string;
      prompt: string;
      image_data_url: string;
    }>;
    selected_variant_index?: number;
  }
): Promise<SavedTurnRecord | null> {
  try {
    const turn = await localDbSaveConversationTurn(conversationId, payload);
    return {
      ...turn,
      id: String(turn.id || `turn-${Date.now()}`),
      conversation_id: String(turn.conversation_id || conversationId),
      turn_number: Number(turn.turn_number ?? 1),
      image_url: turn.image_url || payload.image_data_url,
      image_bucket_key: turn.image_bucket_key || null,
      is_published: Boolean(turn.is_published),
      variants: turn.variants || [],
      selected_variant_index: turn.selected_variant_index ?? 0,
    };
  } catch {
    return null;
  }
}

export async function updateTurnSelection(params: {
  turnId: string;
  selectedVariantIndex: number;
  masterPrompt: string;
  imageDataUrl?: string;
}): Promise<boolean> {
  try {
    return await localDbUpdateTurnSelection(params);
  } catch {
    return false;
  }
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<boolean> {
  try {
    return await localDbUpdateConversationTitle({ conversationId, title });
  } catch {
    return false;
  }
}

export async function toggleTurnPublish(
  turnId: string,
  isPublished?: boolean
): Promise<SavedTurnRecord | null> {
  try {
    const res = await localDbToggleTurnPublish(turnId, isPublished);
    if (!res) return null;
    return {
      id: String(res.id || turnId),
      conversation_id: "",
      turn_number: 1,
      role: "assistant",
      raw_idea: "",
      master_prompt: "",
      style_id: "editorial-anime",
      modifiers: [],
      is_published: Boolean(res.is_published),
    };
  } catch {
    return null;
  }
}

export async function fetchUserBucketGallery(
  userId: string
): Promise<BucketGalleryItem[]> {
  try {
    const items = await localDbGetUserGallery(userId);
    return items.map((item, idx) => ({
      id: String(item.turn_id || item.id || `gallery-${idx}`),
      turn_id: String(item.turn_id || item.id || `gallery-${idx}`),
      conversation_id: String(item.conversation_id || ""),
      conversation_title: String(item.conversation_title || "Project"),
      turn_number: Number(item.turn_number ?? idx + 1),
      author_name: String(item.author_name || "Creator"),
      author_id: String(item.author_id || userId),
      raw_idea: String(item.raw_idea || ""),
      master_prompt: String(item.master_prompt || ""),
      edit_instruction: item.edit_instruction
        ? String(item.edit_instruction)
        : undefined,
      style_id: String(item.style_id || "editorial-anime"),
      modifiers: Array.isArray(item.modifiers) ? (item.modifiers as string[]) : [],
      aspect_ratio: String(item.aspect_ratio || "3:4"),
      image_bucket_key: String(item.image_bucket_key || ""),
      image_url: String(item.image_url || ""),
      model_used: String(item.model_used || "gemini-2.5-flash-image"),
      is_published: Boolean(item.is_published),
      is_curated: Boolean(item.is_curated),
      created_at: String(item.created_at || ""),
    }));
  } catch {
    return [];
  }
}

export async function fetchPublicGallery(): Promise<BucketGalleryItem[]> {
  try {
    const published = await localDbGetPublishedTurns();
    return published.map((item, idx) => ({
      id: String(item.turn_id || item.id || `public-${idx}`),
      turn_id: String(item.turn_id || item.id || `public-${idx}`),
      conversation_id: String(item.conversation_id || ""),
      conversation_title: String(item.conversation_title || "Project"),
      turn_number: Number(item.turn_number ?? idx + 1),
      author_name: String(item.author_name || "Creator"),
      author_id: String(item.author_id || ""),
      raw_idea: String(item.raw_idea || ""),
      master_prompt: String(item.master_prompt || ""),
      edit_instruction: item.edit_instruction
        ? String(item.edit_instruction)
        : undefined,
      style_id: String(item.style_id || "editorial-anime"),
      modifiers: Array.isArray(item.modifiers) ? (item.modifiers as string[]) : [],
      aspect_ratio: String(item.aspect_ratio || "3:4"),
      image_bucket_key: String(item.image_bucket_key || ""),
      image_url: String(item.image_url || ""),
      model_used: String(item.model_used || "gemini-2.5-flash-image"),
      is_published: true,
      is_curated: Boolean(item.is_curated),
      created_at: String(item.created_at || ""),
    }));
  } catch {
    return [];
  }
}
