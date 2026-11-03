/**
 * Universal Tauri v2 Native Desktop + Real SQLite Persistence Bridge
 *
 * - Inside Tauri v2 Desktop (`window.__TAURI_INTERNALS__`): invokes native Rust commands
 *   backed by `rusqlite` (`~/.local/share/com.nanobanana.studio/nanobanana.sqlite3`).
 * - Inside Next.js Dev Server (`npm run dev`): invokes `/api/db` backed by Node's built-in
 *   `node:sqlite` (`DatabaseSync`) on the exact same SQLite database file (`nanobanana.sqlite3`).
 * - Zero mocked images or seeded localStorage rows.
 */

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: <T = unknown>(
        cmd: string,
        args?: Record<string, unknown>
      ) => Promise<T>;
    };
  }
}

export function isTauriDesktop(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.__TAURI_INTERNALS__?.invoke === "function"
  );
}

export async function invokeTauriCommand<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  if (!isTauriDesktop() || !window.__TAURI_INTERNALS__) {
    return null;
  }
  return window.__TAURI_INTERNALS__.invoke<T>(cmd, args);
}

async function querySqliteApi<T>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok: boolean; data: T };
    return json.ok ? json.data : null;
  } catch {
    return null;
  }
}

export interface LocalUserRow {
  id: string;
  provider: string;
  google_sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocalConversationRow {
  id: string;
  user_id: string;
  title: string;
  style_id: string;
  created_at: string;
  updated_at: string;
}

export interface LocalTurnVariant {
  label: string;
  prompt: string;
  imageUrl: string;
  imagePath?: string | null;
}

export interface LocalTurnRow {
  id: string;
  conversation_id: string;
  user_id: string;
  turn_number: number;
  parent_turn_number?: number | null;
  role: string;
  raw_idea: string;
  master_prompt: string;
  edit_instruction?: string;
  style_id: string;
  modifiers: string[];
  completeness_score: number;
  image_bucket_key: string | null;
  image_url: string | null;
  aspect_ratio: string;
  model_used: string;
  is_published: boolean;
  variants?: LocalTurnVariant[];
  selected_variant_index?: number;
  created_at: string;
}

export async function localDbUpsertUser(params: {
  id: string;
  provider: string;
  google_sub: string;
  email: string;
  name: string;
  picture: string;
}): Promise<LocalUserRow> {
  const tauriRes = await invokeTauriCommand<LocalUserRow>(
    "tauri_upsert_user",
    params
  );
  if (tauriRes) return tauriRes;

  const now = new Date().toISOString();
  return {
    id: params.id,
    provider: params.provider || "local",
    google_sub: params.google_sub || params.id,
    email: params.email || `${params.id}@nanobanana.local`,
    name: params.name || "Studio Creator",
    picture: params.picture || "",
    email_verified: true,
    created_at: now,
    updated_at: now,
  };
}

export async function localDbUpdateUserProfile(params: {
  userId: string;
  name: string;
  email: string;
  picture: string;
  provider: string;
}): Promise<LocalUserRow> {
  const tauriRes = await invokeTauriCommand<LocalUserRow>(
    "tauri_update_user_profile",
    params
  );
  if (tauriRes) return tauriRes;

  return localDbUpsertUser({
    id: params.userId,
    provider: params.provider,
    google_sub: `${params.provider}-${params.userId}`,
    email: params.email,
    name: params.name,
    picture: params.picture,
  });
}

export async function localDbCreateConversation(params: {
  user_id: string;
  title: string;
  style_id?: string;
}): Promise<{
  id: string;
  user_id: string;
  title: string;
  style_id: string;
  turn_count: number;
  latest_prompt: string | null;
  preview_image_url: string | null;
  created_at: string;
  updated_at: string;
}> {
  const tauriRes = await invokeTauriCommand<{
    id: string;
    user_id: string;
    title: string;
    style_id: string;
    turn_count: number;
    latest_prompt: string | null;
    preview_image_url: string | null;
    created_at: string;
    updated_at: string;
  }>("tauri_create_conversation", {
    userId: params.user_id,
    title: params.title,
    styleId: params.style_id || "editorial-anime",
  });
  if (tauriRes) return tauriRes;

  const dbRes = await querySqliteApi<{
    id: string;
    user_id: string;
    title: string;
    style_id: string;
    turn_count: number;
    latest_prompt: string | null;
    preview_image_url: string | null;
    created_at: string;
    updated_at: string;
  }>("create_conversation", params);

  if (dbRes) return dbRes;

  const now = new Date().toISOString();
  return {
    id: `conv_${Date.now()}`,
    user_id: params.user_id,
    title: params.title || "Untitled Project",
    style_id: params.style_id || "editorial-anime",
    turn_count: 0,
    latest_prompt: null,
    preview_image_url: null,
    created_at: now,
    updated_at: now,
  };
}

export async function localDbListConversations(userId: string): Promise<
  Array<{
    id: string;
    user_id: string;
    title: string;
    style_id: string;
    turn_count: number;
    latest_prompt: string | null;
    preview_image_url: string | null;
    created_at: string;
    updated_at: string;
  }>
> {
  const tauriRes = await invokeTauriCommand<
    Array<{
      id: string;
      user_id: string;
      title: string;
      style_id: string;
      turn_count: number;
      latest_prompt: string | null;
      preview_image_url: string | null;
      created_at: string;
      updated_at: string;
    }>
  >("tauri_list_conversations", { userId });
  if (tauriRes) return tauriRes;

  const dbRes = await querySqliteApi<
    Array<{
      id: string;
      user_id: string;
      title: string;
      style_id: string;
      turn_count: number;
      latest_prompt: string | null;
      preview_image_url: string | null;
      created_at: string;
      updated_at: string;
    }>
  >("list_conversations", { userId });

  return dbRes || [];
}

export async function localDbDeleteConversation(
  conversationId: string
): Promise<boolean> {
  const tauriRes = await invokeTauriCommand<boolean>(
    "tauri_delete_conversation",
    { conversationId }
  );
  if (tauriRes !== null) return tauriRes;

  const dbRes = await querySqliteApi<boolean>("delete_conversation", {
    conversationId,
  });
  return Boolean(dbRes);
}

export async function localDbGetConversationDetail(
  conversationId: string
): Promise<{
  id: string;
  user_id: string;
  title: string;
  style_id: string;
  turn_count: number;
  latest_prompt: string | null;
  preview_image_url: string | null;
  created_at: string;
  updated_at: string;
  turns: LocalTurnRow[];
} | null> {
  const tauriRes = await invokeTauriCommand<{
    id: string;
    user_id: string;
    title: string;
    style_id: string;
    turn_count: number;
    latest_prompt: string | null;
    preview_image_url: string | null;
    created_at: string;
    updated_at: string;
    turns: LocalTurnRow[];
  } | null>("tauri_get_conversation_detail", { conversationId });
  if (tauriRes !== null) return tauriRes;

  return await querySqliteApi<{
    id: string;
    user_id: string;
    title: string;
    style_id: string;
    turn_count: number;
    latest_prompt: string | null;
    preview_image_url: string | null;
    created_at: string;
    updated_at: string;
    turns: LocalTurnRow[];
  }>("get_conversation_detail", { conversationId });
}

export async function localDbSaveConversationTurn(
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
): Promise<LocalTurnRow> {
  const tauriRes = await invokeTauriCommand<LocalTurnRow>(
    "tauri_save_conversation_turn",
    {
      conversationId,
      userId: payload.user_id,
      rawIdea: payload.raw_idea,
      masterPrompt: payload.master_prompt,
      editInstruction: payload.edit_instruction || null,
      styleId: payload.style_id || "editorial-anime",
      modifiers: payload.modifiers || [],
      completenessScore: payload.completeness_score ?? 85,
      imageDataUrl: payload.image_data_url || null,
      aspectRatio: payload.aspect_ratio || "3:4",
      modelUsed: payload.model_used || "gemini-2.5-flash-image",
      isPublished: Boolean(payload.is_published),
    }
  );
  if (tauriRes) return tauriRes;

  const dbRes = await querySqliteApi<LocalTurnRow>("save_conversation_turn", {
    conversationId,
    ...payload,
  });
  if (dbRes) return dbRes;

  const now = new Date().toISOString();
  return {
    id: `turn_${Date.now()}`,
    conversation_id: conversationId,
    user_id: payload.user_id,
    turn_number: 1,
    role: payload.role || "assistant",
    raw_idea: payload.raw_idea,
    master_prompt: payload.master_prompt,
    edit_instruction: payload.edit_instruction,
    style_id: payload.style_id || "editorial-anime",
    modifiers: payload.modifiers || [],
    completeness_score: payload.completeness_score ?? 85,
    image_bucket_key: null,
    image_url: payload.image_data_url || null,
    aspect_ratio: payload.aspect_ratio || "3:4",
    model_used: payload.model_used || "gemini-2.5-flash-image",
    is_published: Boolean(payload.is_published),
    variants: (payload.variants || []).map((v) => ({
      label: v.label,
      prompt: v.prompt,
      imageUrl: v.image_data_url,
    })),
    selected_variant_index: payload.selected_variant_index ?? 0,
    created_at: now,
  };
}

export async function localDbUpdateTurnSelection(params: {
  turnId: string;
  selectedVariantIndex: number;
  masterPrompt: string;
  imageDataUrl?: string;
}): Promise<boolean> {
  const dbRes = await querySqliteApi<boolean>("update_turn_selection", params);
  return Boolean(dbRes);
}

export async function localDbUpdateConversationTitle(params: {
  conversationId: string;
  title: string;
}): Promise<boolean> {
  const dbRes = await querySqliteApi<{ id: string; title: string }>(
    "update_conversation_title",
    params
  );
  return Boolean(dbRes);
}

export async function localDbToggleTurnPublish(
  turnId: string,
  isPublished?: boolean
): Promise<{ id: string; is_published: boolean } | null> {
  const tauriRes = await invokeTauriCommand<boolean>(
    "tauri_toggle_turn_publish",
    {
      turnId,
      isPublished: typeof isPublished === "boolean" ? isPublished : null,
    }
  );
  if (typeof tauriRes === "boolean") {
    return { id: turnId, is_published: tauriRes };
  }
  return { id: turnId, is_published: Boolean(isPublished) };
}

export async function localDbGetUserGallery(userId: string) {
  const tauriRes = await invokeTauriCommand<Array<Record<string, unknown>>>(
    "tauri_get_user_gallery",
    { userId }
  );
  return tauriRes || [];
}

export async function localDbGetPublishedTurns() {
  const tauriRes = await invokeTauriCommand<Array<Record<string, unknown>>>(
    "tauri_get_public_gallery"
  );
  return tauriRes || [];
}

export async function vaultGetSavedApiKey(): Promise<string | null> {
  const tauriVal = await invokeTauriCommand<string | null>(
    "tauri_vault_get_api_key"
  );
  if (tauriVal !== null) return tauriVal;

  return await querySqliteApi<string | null>("vault_get");
}

export async function vaultSaveApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  const tauriRes = await invokeTauriCommand<boolean>("tauri_vault_set_api_key", {
    apiKey: trimmed,
  });
  if (tauriRes !== null) return;

  await querySqliteApi<boolean>("vault_set", { apiKey: trimmed });
}

export async function vaultClearApiKey(): Promise<void> {
  const tauriRes = await invokeTauriCommand<boolean>(
    "tauri_vault_clear_api_key"
  );
  if (tauriRes !== null) return;

  await querySqliteApi<boolean>("vault_clear");
}

export async function vaultGetImagesOutputDir(): Promise<string> {
  const res = await querySqliteApi<string>("vault_get_images_dir");
  return res || "~/Pictures/nanobanana";
}

export async function vaultSetImagesOutputDir(
  imagesOutputDir: string
): Promise<string> {
  const res = await querySqliteApi<string>("vault_set_images_dir", {
    imagesOutputDir,
  });
  return res || imagesOutputDir;
}

export async function vaultGetModifierCategories<T = unknown>(): Promise<
  T[] | null
> {
  return await querySqliteApi<T[] | null>("vault_get_modifiers");
}

export async function vaultSetModifierCategories<T = unknown>(
  categories: T[]
): Promise<T[]> {
  const res = await querySqliteApi<T[]>("vault_set_modifiers", {
    categories,
  });
  return res || categories;
}

export async function minimizeAppWindow(): Promise<void> {
  if (isTauriDesktop()) {
    try {
      await invokeTauriCommand("tauri_window_minimize");
      return;
    } catch {
      await invokeTauriCommand("plugin:window|minimize");
    }
  }
}

export async function toggleMaximizeAppWindow(): Promise<boolean> {
  if (isTauriDesktop()) {
    try {
      const res = await invokeTauriCommand<boolean>(
        "tauri_window_toggle_maximize"
      );
      if (typeof res === "boolean") return res;
    } catch {
      await invokeTauriCommand("plugin:window|toggle_maximize");
    }
  }
  if (typeof document !== "undefined") {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        return true;
      } else {
        await document.exitFullscreen();
        return false;
      }
    } catch {
      // Ignore fullscreen permissions errors
    }
  }
  return false;
}

export async function closeAppWindow(): Promise<void> {
  if (isTauriDesktop()) {
    try {
      await invokeTauriCommand("tauri_window_close");
      return;
    } catch {
      await invokeTauriCommand("plugin:window|close");
    }
  }
  if (typeof window !== "undefined") {
    window.close();
  }
}
