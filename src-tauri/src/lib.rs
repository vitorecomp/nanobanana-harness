pub mod copilot;
pub mod db;
pub mod storage;

use chrono::Utc;
use copilot::{analyze_idea, refine_prompt, AnalyzePromptResponse, RefinePromptResponse};
use db::{
    init_database, AppDatabase, ConversationDetail, ConversationSummary, GalleryItem,
    HarnessMissionSummary, TurnRecord, TurnVariantOutput, UserRecord,
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Mutex;
use storage::{
    disk_path_to_data_url, persist_image_to_native_fs, sanitize_project_folder_name,
    save_base64_png_to_dir,
};
use tauri::{Manager, State};
use uuid::Uuid;

fn resolve_configured_images_dir(conn: &Connection, default_dir: &PathBuf) -> PathBuf {
    let custom: Option<String> = conn
        .query_row(
            "SELECT value FROM app_vault WHERE key = 'images_output_dir'",
            [],
            |r| r.get(0),
        )
        .ok();
    if let Some(raw) = custom {
        let trimmed = raw.trim();
        if !trimmed.is_empty() && trimmed != "~/Pictures/nanobanana" {
            let resolved = if let Some(rest) = trimmed.strip_prefix("~/") {
                if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
                    PathBuf::from(home).join(rest)
                } else {
                    PathBuf::from(trimmed)
                }
            } else {
                PathBuf::from(trimmed)
            };
            if std::fs::create_dir_all(&resolved).is_ok() {
                return resolved;
            }
        }
    }
    let _ = std::fs::create_dir_all(default_dir);
    default_dir.clone()
}

#[tauri::command]
fn tauri_analyze_prompt(
    idea: String,
    style_id: String,
    modifiers: Vec<String>,
) -> AnalyzePromptResponse {
    analyze_idea(&idea, &style_id, &modifiers)
}

#[tauri::command]
fn tauri_refine_prompt(current_prompt: String, instruction: String) -> RefinePromptResponse {
    refine_prompt(&current_prompt, &instruction)
}

#[tauri::command]
fn tauri_upsert_user(
    state: State<'_, AppDatabase>,
    id: String,
    provider: String,
    google_sub: String,
    email: String,
    name: String,
    picture: String,
) -> Result<UserRecord, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO users (id, provider, google_sub, email, name, picture, email_verified, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            email = excluded.email,
            picture = CASE WHEN excluded.picture != '' THEN excluded.picture ELSE users.picture END,
            provider = excluded.provider,
            updated_at = excluded.updated_at",
        params![id, provider, google_sub, email, name, picture, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(UserRecord {
        id,
        provider,
        google_sub,
        email,
        name,
        picture,
        email_verified: true,
        created_at: now,
    })
}

#[tauri::command]
fn tauri_update_user_profile(
    state: State<'_, AppDatabase>,
    user_id: String,
    name: String,
    email: String,
    picture: String,
    provider: String,
) -> Result<UserRecord, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let sub = format!("{}-{}", provider, user_id);
    conn.execute(
        "INSERT INTO users (id, provider, google_sub, email, name, picture, email_verified, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            email = excluded.email,
            picture = excluded.picture,
            updated_at = excluded.updated_at",
        params![user_id, provider, sub, email, name, picture, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(UserRecord {
        id: user_id,
        provider,
        google_sub: sub,
        email,
        name,
        picture,
        email_verified: true,
        created_at: now,
    })
}

#[tauri::command]
fn tauri_create_conversation(
    state: State<'_, AppDatabase>,
    user_id: String,
    title: String,
    style_id: Option<String>,
) -> Result<ConversationSummary, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let conv_id = format!("conv_{}", &Uuid::new_v4().simple().to_string()[..12]);
    let resolved_style = style_id.unwrap_or_default();

    conn.execute(
        "INSERT OR IGNORE INTO users (id, provider, google_sub, email, name, picture, email_verified, created_at, updated_at)
         VALUES (?1, 'local', ?1, ?2, 'Studio Creator', '', 1, ?3, ?3)",
        params![user_id, format!("{}@nanobanana.local", user_id), now],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO conversations (id, user_id, title, style_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![conv_id, user_id, title, resolved_style, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(ConversationSummary {
        id: conv_id,
        user_id,
        title,
        style_id: resolved_style,
        turn_count: 0,
        latest_prompt: None,
        preview_image_url: None,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
fn tauri_list_conversations(
    state: State<'_, AppDatabase>,
    user_id: String,
) -> Result<Vec<ConversationSummary>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.user_id, c.title, c.style_id, c.created_at, c.updated_at,
                    (SELECT COUNT(*) FROM conversation_turns t WHERE t.conversation_id = c.id) AS turn_count,
                    (SELECT t.master_prompt FROM conversation_turns t WHERE t.conversation_id = c.id ORDER BY t.turn_number DESC LIMIT 1) AS latest_prompt,
                    (SELECT COALESCE(t.image_path, t.image_data_url) FROM conversation_turns t WHERE t.conversation_id = c.id ORDER BY t.turn_number DESC LIMIT 1) AS latest_img
             FROM conversations c
             WHERE (?1 = '' OR c.user_id = ?1)
             ORDER BY c.updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![user_id], |row| {
            let raw_img: Option<String> = row.get(8)?;
            let preview_image_url = raw_img.and_then(|p| disk_path_to_data_url(&p));
            Ok(ConversationSummary {
                id: row.get(0)?,
                user_id: row.get(1)?,
                title: row.get(2)?,
                style_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                turn_count: row.get(6)?,
                latest_prompt: row.get(7)?,
                preview_image_url,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for item in rows.flatten() {
        out.push(item);
    }
    Ok(out)
}

#[tauri::command]
fn tauri_get_conversation_detail(
    state: State<'_, AppDatabase>,
    conversation_id: String,
) -> Result<Option<ConversationDetail>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, user_id, title, style_id, canonical_dna_json, created_at, updated_at FROM conversations WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let mut conv_iter = stmt
        .query_map(params![conversation_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let Some(Ok((id, user_id, title, style_id, dna_raw, created_at, updated_at))) =
        conv_iter.next()
    else {
        return Ok(None);
    };

    let canonical_dna = dna_raw
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .map(|mut val| {
            if let Some(obj) = val.as_object_mut() {
                let disk_or_url = obj
                    .get("imagePath")
                    .and_then(|v| v.as_str())
                    .or_else(|| obj.get("imageUrl").and_then(|v| v.as_str()))
                    .unwrap_or("");
                if let Some(resolved) = disk_path_to_data_url(disk_or_url) {
                    obj.insert("imageUrl".to_string(), Value::String(resolved));
                }
            }
            val
        });

    let mut t_stmt = conn
        .prepare(
            "SELECT id, conversation_id, user_id, turn_number, parent_turn_number, role, raw_idea, master_prompt,
                    edit_instruction, style_id, modifiers_json, completeness_score, image_path,
                    image_data_url, aspect_ratio, model_used, is_published, variants_json, selected_variant_index, created_at
             FROM conversation_turns
             WHERE conversation_id = ?1
             ORDER BY turn_number ASC",
        )
        .map_err(|e| e.to_string())?;

    let turn_rows = t_stmt
        .query_map(params![id], |row| {
            let mod_str: String = row.get(10)?;
            let modifiers: Vec<String> = serde_json::from_str(&mod_str).unwrap_or_default();
            let image_path: Option<String> = row.get(12)?;
            let image_data_url: Option<String> = row.get(13)?;
            let resolved_main = image_path
                .as_deref()
                .and_then(disk_path_to_data_url)
                .or_else(|| image_data_url.as_deref().and_then(disk_path_to_data_url));

            let pub_int: i64 = row.get(16)?;
            let variants_raw: String = row.get(17)?;
            let parsed_vars: Vec<Value> = serde_json::from_str(&variants_raw).unwrap_or_default();
            let variants: Vec<TurnVariantOutput> = parsed_vars
                .into_iter()
                .enumerate()
                .map(|(idx, v)| {
                    let label = v
                        .get("label")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string();
                    let prompt = v
                        .get("prompt")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string();
                    let v_path = v
                        .get("imagePath")
                        .and_then(|x| x.as_str())
                        .or_else(|| v.get("imageUrl").and_then(|x| x.as_str()))
                        .unwrap_or("");
                    let v_url = disk_path_to_data_url(v_path).unwrap_or_default();
                    TurnVariantOutput {
                        label: if label.is_empty() {
                            format!("Variation #{}", idx + 1)
                        } else {
                            label
                        },
                        prompt,
                        image_url: v_url,
                    }
                })
                .collect();

            Ok(TurnRecord {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                user_id: row.get(2)?,
                turn_number: row.get(3)?,
                parent_turn_number: row.get(4)?,
                role: row.get(5)?,
                raw_idea: row.get(6)?,
                master_prompt: row.get(7)?,
                edit_instruction: row.get(8)?,
                style_id: row.get(9)?,
                modifiers,
                completeness_score: row.get(11)?,
                image_bucket_key: image_path,
                image_url: resolved_main,
                aspect_ratio: row.get(14)?,
                model_used: row.get(15)?,
                is_published: pub_int != 0,
                variants,
                selected_variant_index: row.get(18)?,
                created_at: row.get(19)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut turns = Vec::new();
    for tr in turn_rows.flatten() {
        turns.push(tr);
    }

    let latest_prompt = turns.last().map(|t| t.master_prompt.clone());
    let preview_image_url = turns.last().and_then(|t| t.image_url.clone());

    Ok(Some(ConversationDetail {
        id,
        user_id,
        title,
        style_id,
        canonical_dna,
        turn_count: turns.len(),
        latest_prompt,
        preview_image_url,
        created_at,
        updated_at,
        turns,
    }))
}

#[derive(Debug, Deserialize)]
struct IncomingVariantInput {
    label: String,
    prompt: String,
    image_data_url: Option<String>,
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn tauri_save_conversation_turn(
    state: State<'_, AppDatabase>,
    conversation_id: String,
    user_id: String,
    title: Option<String>,
    parent_turn_number: Option<i64>,
    raw_idea: String,
    master_prompt: String,
    edit_instruction: Option<String>,
    style_id: Option<String>,
    modifiers: Option<Vec<String>>,
    completeness_score: Option<i64>,
    image_data_url: Option<String>,
    aspect_ratio: Option<String>,
    model_used: Option<String>,
    is_published: Option<bool>,
    variants: Option<Vec<IncomingVariantInput>>,
    selected_variant_index: Option<i64>,
) -> Result<TurnRecord, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let turn_id = format!("turn_{}", &Uuid::new_v4().simple().to_string()[..12]);
    let base_images_dir = resolve_configured_images_dir(&conn, &state.images_dir);

    let conv_title: String = conn
        .query_row(
            "SELECT title FROM conversations WHERE id = ?1",
            params![conversation_id],
            |r| r.get(0),
        )
        .unwrap_or_else(|_| title.unwrap_or_else(|| "Studio Project".to_string()));

    let proj_dir = base_images_dir.join(sanitize_project_folder_name(&conv_title, &conversation_id));

    let next_turn: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(turn_number), 0) + 1 FROM conversation_turns WHERE conversation_id = ?1",
            params![conversation_id],
            |r| r.get(0),
        )
        .unwrap_or(1);

    let resolved_style = style_id.unwrap_or_default();
    let resolved_mods = modifiers.unwrap_or_default();
    let mods_json = serde_json::to_string(&resolved_mods).unwrap_or_else(|_| "[]".to_string());
    let resolved_score = completeness_score.unwrap_or(85);
    let resolved_aspect = aspect_ratio.unwrap_or_else(|| "3:4".to_string());
    let resolved_model = model_used.unwrap_or_else(|| "gemini-2.5-flash-image".to_string());
    let resolved_pub = is_published.unwrap_or(false);
    let resolved_sel_idx = selected_variant_index.unwrap_or(0);

    let main_disk_path = image_data_url.as_deref().and_then(|d| {
        save_base64_png_to_dir(&proj_dir, &format!("turn_{}_{}.png", next_turn, turn_id), d)
    });

    let mut stored_variants_json = Vec::new();
    let mut returned_variants = Vec::new();
    for (idx, v) in variants.unwrap_or_default().into_iter().enumerate() {
        let var_disk = v.image_data_url.as_deref().and_then(|d| {
            save_base64_png_to_dir(
                &proj_dir,
                &format!("turn_{}_var_{}_{}.png", next_turn, idx + 1, turn_id),
                d,
            )
        });
        let display_url = var_disk
            .as_deref()
            .and_then(disk_path_to_data_url)
            .or_else(|| v.image_data_url.clone())
            .unwrap_or_default();
        stored_variants_json.push(json!({
            "label": v.label,
            "prompt": v.prompt,
            "imagePath": var_disk,
        }));
        returned_variants.push(TurnVariantOutput {
            label: v.label,
            prompt: v.prompt,
            image_url: display_url,
        });
    }

    let variants_json_str =
        serde_json::to_string(&stored_variants_json).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO conversation_turns (
            id, conversation_id, user_id, turn_number, parent_turn_number, role, raw_idea, master_prompt,
            edit_instruction, style_id, modifiers_json, completeness_score, image_path,
            image_data_url, aspect_ratio, model_used, is_published, variants_json, selected_variant_index, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, 'assistant', ?6, ?7, ?8, ?9, ?10, ?11, ?12, NULL, ?13, ?14, ?15, ?16, ?17, ?18)",
        params![
            turn_id,
            conversation_id,
            user_id,
            next_turn,
            parent_turn_number,
            raw_idea,
            master_prompt,
            edit_instruction,
            resolved_style,
            mods_json,
            resolved_score,
            main_disk_path,
            resolved_aspect,
            resolved_model,
            if resolved_pub { 1 } else { 0 },
            variants_json_str,
            resolved_sel_idx,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    let _ = conn.execute(
        "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
        params![now, conversation_id],
    );

    let resolved_main_url = main_disk_path
        .as_deref()
        .and_then(disk_path_to_data_url)
        .or(image_data_url);

    Ok(TurnRecord {
        id: turn_id,
        conversation_id,
        user_id,
        turn_number: next_turn,
        parent_turn_number,
        role: "assistant".to_string(),
        raw_idea,
        master_prompt,
        edit_instruction,
        style_id: resolved_style,
        modifiers: resolved_mods,
        completeness_score: resolved_score,
        image_bucket_key: main_disk_path,
        image_url: resolved_main_url,
        aspect_ratio: resolved_aspect,
        model_used: resolved_model,
        is_published: resolved_pub,
        variants: returned_variants,
        selected_variant_index: resolved_sel_idx,
        created_at: now,
    })
}

#[tauri::command]
fn tauri_toggle_turn_publish(
    state: State<'_, AppDatabase>,
    turn_id: String,
    is_published: Option<bool>,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let current: i64 = conn
        .query_row(
            "SELECT is_published FROM conversation_turns WHERE id = ?1",
            params![turn_id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let next = is_published.unwrap_or(current == 0);
    conn.execute(
        "UPDATE conversation_turns SET is_published = ?1 WHERE id = ?2",
        params![if next { 1 } else { 0 }, turn_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(next)
}

#[tauri::command]
fn tauri_get_user_gallery(
    state: State<'_, AppDatabase>,
    user_id: String,
) -> Result<Vec<GalleryItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.conversation_id, COALESCE(c.title, 'Studio Session'), t.turn_number,
                    COALESCE(u.name, 'Studio Creator'), t.user_id, t.raw_idea, t.master_prompt,
                    t.edit_instruction, t.style_id, t.modifiers_json, t.aspect_ratio,
                    COALESCE(t.image_path, ''), COALESCE(t.image_data_url, ''), t.model_used,
                    t.is_published, t.created_at
             FROM conversation_turns t
             LEFT JOIN conversations c ON c.id = t.conversation_id
             LEFT JOIN users u ON u.id = t.user_id
             WHERE (?1 = '' OR t.user_id = ?1) AND (t.image_path IS NOT NULL OR t.image_data_url IS NOT NULL)
             ORDER BY t.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![user_id], |row| {
            let tid: String = row.get(0)?;
            let mod_str: String = row.get(10)?;
            let modifiers: Vec<String> = serde_json::from_str(&mod_str).unwrap_or_default();
            let img_path: String = row.get(12)?;
            let img_data: String = row.get(13)?;
            let resolved_url = disk_path_to_data_url(&img_path)
                .or_else(|| disk_path_to_data_url(&img_data))
                .unwrap_or_default();
            let pub_int: i64 = row.get(15)?;
            Ok(GalleryItem {
                id: tid.clone(),
                turn_id: tid,
                conversation_id: row.get(1)?,
                conversation_title: row.get(2)?,
                turn_number: row.get(3)?,
                author_name: row.get(4)?,
                author_id: row.get(5)?,
                raw_idea: row.get(6)?,
                master_prompt: row.get(7)?,
                edit_instruction: row.get(8)?,
                style_id: row.get(9)?,
                modifiers,
                aspect_ratio: row.get(11)?,
                image_bucket_key: img_path,
                image_url: resolved_url,
                model_used: row.get(14)?,
                is_published: pub_int != 0,
                is_curated: false,
                created_at: row.get(16)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for item in rows.flatten() {
        if !item.image_url.is_empty() {
            out.push(item);
        }
    }
    Ok(out)
}

#[tauri::command]
fn tauri_get_public_gallery(state: State<'_, AppDatabase>) -> Result<Vec<GalleryItem>, String> {
    tauri_get_user_gallery(state, String::new())
}

#[tauri::command]
fn tauri_vault_get_api_key(state: State<'_, AppDatabase>) -> Result<Option<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let val: Option<String> = conn
        .query_row(
            "SELECT value FROM app_vault WHERE key = 'gemini_api_key'",
            [],
            |r| r.get(0),
        )
        .ok();
    Ok(val)
}

#[tauri::command]
fn tauri_vault_set_api_key(
    state: State<'_, AppDatabase>,
    api_key: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO app_vault (key, value, updated_at) VALUES ('gemini_api_key', ?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![api_key.trim(), now],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn tauri_vault_clear_api_key(state: State<'_, AppDatabase>) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM app_vault WHERE key = 'gemini_api_key'", [])
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn tauri_delete_conversation(
    state: State<'_, AppDatabase>,
    conversation_id: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM conversation_turns WHERE conversation_id = ?1",
        params![conversation_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM conversations WHERE id = ?1",
        params![conversation_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn tauri_update_conversation_title(
    state: State<'_, AppDatabase>,
    conversation_id: String,
    title: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title.trim(), now, conversation_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn tauri_update_conversation_dna(
    state: State<'_, AppDatabase>,
    conversation_id: String,
    canonical_dna: Option<Value>,
) -> Result<Option<Value>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let Some(mut dna_obj) = canonical_dna else {
        conn.execute(
            "UPDATE conversations SET canonical_dna_json = NULL, updated_at = ?1 WHERE id = ?2",
            params![now, conversation_id],
        )
        .map_err(|e| e.to_string())?;
        return Ok(None);
    };

    let base_dir = resolve_configured_images_dir(&conn, &state.images_dir);
    if let Some(map) = dna_obj.as_object_mut() {
        if let Some(img_url) = map.get("imageUrl").and_then(|v| v.as_str()).map(String::from) {
            if let Some(saved_path) =
                persist_image_to_native_fs(&base_dir, &conversation_id, "canonical_dna", &img_url)
            {
                map.insert("imagePath".to_string(), Value::String(saved_path));
            }
        }
    }

    let raw_json = serde_json::to_string(&dna_obj).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE conversations SET canonical_dna_json = ?1, updated_at = ?2 WHERE id = ?3",
        params![raw_json, now, conversation_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(Some(dna_obj))
}

#[tauri::command]
fn tauri_update_turn_selection(
    state: State<'_, AppDatabase>,
    turn_id: String,
    selected_variant_index: Option<i64>,
    master_prompt: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let idx = selected_variant_index.unwrap_or(0);
    conn.execute(
        "UPDATE conversation_turns SET selected_variant_index = ?1, master_prompt = ?2 WHERE id = ?3",
        params![idx, master_prompt, turn_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn tauri_vault_get_images_dir(state: State<'_, AppDatabase>) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let val: Option<String> = conn
        .query_row(
            "SELECT value FROM app_vault WHERE key = 'images_output_dir'",
            [],
            |r| r.get(0),
        )
        .ok();
    Ok(val.unwrap_or_else(|| state.images_dir.to_string_lossy().to_string()))
}

#[tauri::command]
fn tauri_vault_set_images_dir(
    state: State<'_, AppDatabase>,
    images_output_dir: String,
) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let trimmed = images_output_dir.trim().to_string();
    conn.execute(
        "INSERT INTO app_vault (key, value, updated_at) VALUES ('images_output_dir', ?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![trimmed, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(trimmed)
}

#[tauri::command]
fn tauri_vault_get_modifiers(state: State<'_, AppDatabase>) -> Result<Option<Value>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM app_vault WHERE key = 'modifier_categories_json'",
            [],
            |r| r.get(0),
        )
        .ok();
    Ok(raw.and_then(|s| serde_json::from_str(&s).ok()))
}

#[tauri::command]
fn tauri_vault_set_modifiers(
    state: State<'_, AppDatabase>,
    categories: Value,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let raw = serde_json::to_string(&categories).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO app_vault (key, value, updated_at) VALUES ('modifier_categories_json', ?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![raw, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiPromptsPayload {
    #[serde(rename = "enhanceSystemPrompt")]
    pub enhance_system_prompt: Option<String>,
    #[serde(rename = "variationSystemPrompt")]
    pub variation_system_prompt: Option<String>,
    #[serde(rename = "harnessPlannerPrompt")]
    pub harness_planner_prompt: Option<String>,
    #[serde(rename = "harnessCriticPrompt")]
    pub harness_critic_prompt: Option<String>,
    #[serde(rename = "harnessRefinerPrompt")]
    pub harness_refiner_prompt: Option<String>,
    #[serde(rename = "harnessDefaultSteps")]
    pub harness_default_steps: Option<i64>,
}

#[tauri::command]
fn tauri_vault_get_ai_prompts(
    state: State<'_, AppDatabase>,
) -> Result<Option<AiPromptsPayload>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM app_vault WHERE key = 'ai_system_prompts_json'",
            [],
            |r| r.get(0),
        )
        .ok();
    Ok(raw.and_then(|s| serde_json::from_str(&s).ok()))
}

#[tauri::command]
fn tauri_vault_set_ai_prompts(
    state: State<'_, AppDatabase>,
    prompts: AiPromptsPayload,
) -> Result<AiPromptsPayload, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let clamped_steps = prompts.harness_default_steps.unwrap_or(4).clamp(3, 10);
    let normalized = AiPromptsPayload {
        harness_default_steps: Some(clamped_steps),
        ..prompts
    };
    let raw = serde_json::to_string(&normalized).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO app_vault (key, value, updated_at) VALUES ('ai_system_prompts_json', ?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![raw, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(normalized)
}

#[tauri::command]
fn tauri_vault_get_theme(state: State<'_, AppDatabase>) -> Result<Option<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let val: Option<String> = conn
        .query_row(
            "SELECT value FROM app_vault WHERE key = 'studio_theme_mode'",
            [],
            |r| r.get(0),
        )
        .ok();
    Ok(val.filter(|v| v == "dark" || v == "light"))
}

#[tauri::command]
fn tauri_vault_set_theme(
    state: State<'_, AppDatabase>,
    theme_mode: String,
) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let normalized = if theme_mode.trim() == "dark" {
        "dark".to_string()
    } else {
        "light".to_string()
    };
    conn.execute(
        "INSERT INTO app_vault (key, value, updated_at) VALUES ('studio_theme_mode', ?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![normalized, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(normalized)
}

// ==================== GOAL HARNESS NATIVE COMMANDS ====================

#[tauri::command]
fn tauri_list_harness_missions(
    state: State<'_, AppDatabase>,
    user_id: String,
) -> Result<Vec<HarnessMissionSummary>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, title, goal, status, best_overall_score, best_image_path,
                    aspect_ratio, model_used, deliverables_json, rounds_json, created_at, updated_at
             FROM harness_missions
             WHERE (?1 = '' OR user_id = ?1)
             ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![user_id], |row| {
            let best_path: Option<String> = row.get(6)?;
            let best_image_url = best_path.and_then(|p| disk_path_to_data_url(&p));
            let deliv_raw: String = row.get(9)?;
            let rounds_raw: String = row.get(10)?;
            let delivs: Vec<Value> = serde_json::from_str(&deliv_raw).unwrap_or_default();
            let rounds: Vec<Value> = serde_json::from_str(&rounds_raw).unwrap_or_default();
            let solved_count = delivs
                .iter()
                .filter(|d| d.get("status").and_then(|s| s.as_str()) == Some("solved"))
                .count();

            Ok(HarnessMissionSummary {
                id: row.get(0)?,
                user_id: row.get(1)?,
                title: row.get(2)?,
                goal: row.get(3)?,
                status: row.get(4)?,
                best_score: row.get(5)?,
                best_image_url,
                aspect_ratio: row.get(7)?,
                model_used: row.get(8)?,
                deliverable_count: delivs.len(),
                solved_count,
                round_count: rounds.len(),
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for r in rows.flatten() {
        out.push(r);
    }
    Ok(out)
}

fn hydrate_harness_images_for_webview(val: &mut Value) {
    match val {
        Value::Object(map) => {
            for key in [
                "incumbentImageUrl",
                "keystoneImageUrl",
                "anchoredFromImageUrl",
                "keystoneAnchorImageUrl",
                "imageUrl",
                "dataUrl",
                "bestImageUrl",
            ] {
                if let Some(s) = map.get(key).and_then(|v| v.as_str()).map(String::from) {
                    if !s.is_empty() && !s.starts_with("data:") {
                        if let Some(data_url) = disk_path_to_data_url(&s) {
                            map.insert(key.to_string(), Value::String(data_url));
                        }
                    }
                }
            }
            for child in map.values_mut() {
                hydrate_harness_images_for_webview(child);
            }
        }
        Value::Array(arr) => {
            for item in arr.iter_mut() {
                hydrate_harness_images_for_webview(item);
            }
        }
        _ => {}
    }
}

#[tauri::command]
fn tauri_get_harness_mission(
    state: State<'_, AppDatabase>,
    mission_id: String,
) -> Result<Option<Value>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, title, goal, pack_invariants, aspect_ratio, model_used,
                    max_rounds, target_score, candidates_per_round, status, best_overall_score,
                    best_image_path, keystone_anchor_json, deliverables_json, rubric_json,
                    rounds_json, references_json, created_at, updated_at
             FROM harness_missions WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut iter = stmt
        .query_map(params![mission_id], |row| {
            let cfg_raw: Option<String> = row.get(13)?;
            let deliv_raw: String = row.get(14)?;
            let rubric_raw: String = row.get(15)?;
            let rounds_raw: String = row.get(16)?;
            let refs_raw: String = row.get(17)?;
            let best_path: Option<String> = row.get(12)?;

            let aspect_ratio: String = row.get(5)?;
            let model_used: String = row.get(6)?;
            let max_rounds: i64 = row.get(7)?;
            let target_score: i64 = row.get(8)?;
            let candidates_per_slot: i64 = row.get(9)?;

            let config = cfg_raw
                .and_then(|s| serde_json::from_str::<Value>(&s).ok())
                .unwrap_or_else(|| {
                    json!({
                        "model": model_used,
                        "modelParams": { "temperature": 1.0, "topP": 0.95, "seed": null },
                        "aspectRatio": aspect_ratio,
                        "modifierIds": [],
                        "maxRounds": max_rounds,
                        "candidatesPerSlot": candidates_per_slot,
                        "targetScore": target_score,
                        "checkpointMode": false
                    })
                });

            let mut record = json!({
                "id": row.get::<_, String>(0)?,
                "user_id": row.get::<_, String>(1)?,
                "title": row.get::<_, String>(2)?,
                "goal": row.get::<_, String>(3)?,
                "globalPackInvariants": row.get::<_, String>(4)?,
                "referenceSlots": serde_json::from_str::<Value>(&refs_raw).unwrap_or_else(|_| json!([])),
                "deliverables": serde_json::from_str::<Value>(&deliv_raw).unwrap_or_else(|_| json!([])),
                "rubric": serde_json::from_str::<Value>(&rubric_raw).unwrap_or_else(|_| json!([])),
                "config": config,
                "rounds": serde_json::from_str::<Value>(&rounds_raw).unwrap_or_else(|_| json!([])),
                "status": row.get::<_, String>(10)?,
                "bestScore": row.get::<_, i64>(11)?,
                "bestImageUrl": best_path.and_then(|p| disk_path_to_data_url(&p)),
                "created_at": row.get::<_, String>(18)?,
                "updated_at": row.get::<_, String>(19)?,
            });
            hydrate_harness_images_for_webview(&mut record);
            Ok(record)
        })
        .map_err(|e| e.to_string())?;

    match iter.next() {
        Some(Ok(val)) => Ok(Some(val)),
        _ => Ok(None),
    }
}

#[tauri::command]
fn tauri_save_harness_mission(
    state: State<'_, AppDatabase>,
    mut mission: Value,
) -> Result<Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let base_output_dir = resolve_configured_images_dir(&conn, &state.images_dir);

    let mission_id = mission
        .get("id")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(String::from)
        .unwrap_or_else(|| format!("hm_{}", &Uuid::new_v4().simple().to_string()[..12]));
    let user_id = mission
        .get("user_id")
        .and_then(|v| v.as_str())
        .unwrap_or("usr_local_dev")
        .to_string();
    let title = mission
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Harness Mission")
        .chars()
        .take(80)
        .collect::<String>();
    let goal = mission
        .get("goal")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let invariants = mission
        .get("globalPackInvariants")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let status = mission
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("idle")
        .to_string();
    let best_score = mission
        .get("bestScore")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let created_at = mission
        .get("created_at")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(String::from)
        .unwrap_or_else(|| now.clone());

    let cfg = mission.get("config").cloned().unwrap_or_else(|| json!({}));
    let aspect_ratio = cfg
        .get("aspectRatio")
        .and_then(|v| v.as_str())
        .unwrap_or("1:1")
        .to_string();
    let model_used = cfg
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("gemini-2.5-flash-image")
        .to_string();
    let max_rounds = cfg.get("maxRounds").and_then(|v| v.as_i64()).unwrap_or(4);
    let target_score = cfg.get("targetScore").and_then(|v| v.as_i64()).unwrap_or(85);
    let candidates_per_round = cfg
        .get("candidatesPerSlot")
        .and_then(|v| v.as_i64())
        .unwrap_or(2);

    let mission_dir = base_output_dir.join(sanitize_project_folder_name(
        &format!("Harness_{}", title),
        &mission_id,
    ));
    let _ = std::fs::create_dir_all(&mission_dir);

    let persist_img = |raw: Option<&str>, prefix: &str| -> Option<String> {
        let s = raw?;
        if s.starts_with("data:image/") && !s.starts_with("data:image/svg+xml") {
            return save_base64_png_to_dir(&mission_dir, &format!("{}_{}.png", prefix, mission_id), s);
        }
        if !s.is_empty() && !s.starts_with("data:") {
            return Some(s.to_string());
        }
        None
    };

    // Persist deliverable incumbent images to disk
    let mut deliverables = mission
        .get("deliverables")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let round_len = mission
        .get("rounds")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(1);
    for (d_idx, d) in deliverables.iter_mut().enumerate() {
        if let Some(obj) = d.as_object_mut() {
            let inc_r = obj
                .get("incumbentRound")
                .and_then(|v| v.as_i64())
                .unwrap_or(round_len as i64);
            let cur = obj.get("incumbentImageUrl").and_then(|v| v.as_str());
            if let Some(saved_path) =
                persist_img(cur, &format!("slot_{}_r{}_incumbent", d_idx + 1, inc_r))
            {
                obj.insert("incumbentImageUrl".to_string(), Value::String(saved_path));
            }
        }
    }

    // Persist round candidate & anchor images to disk
    let mut rounds = mission
        .get("rounds")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    for (r_idx, r) in rounds.iter_mut().enumerate() {
        if let Some(r_obj) = r.as_object_mut() {
            let r_num = r_obj
                .get("roundNumber")
                .and_then(|v| v.as_i64())
                .unwrap_or((r_idx + 1) as i64);
            if let Some(kp) = persist_img(
                r_obj.get("keystoneImageUrl").and_then(|v| v.as_str()),
                &format!("r{}_keystone", r_num),
            ) {
                r_obj.insert("keystoneImageUrl".to_string(), Value::String(kp));
            }
            if let Some(outcomes) = r_obj.get_mut("slotOutcomes").and_then(|v| v.as_array_mut()) {
                for (s_idx, so) in outcomes.iter_mut().enumerate() {
                    if let Some(so_obj) = so.as_object_mut() {
                        if let Some(ap) = persist_img(
                            so_obj.get("anchoredFromImageUrl").and_then(|v| v.as_str()),
                            &format!("r{}_s{}_anchor", r_num, s_idx + 1),
                        ) {
                            so_obj.insert("anchoredFromImageUrl".to_string(), Value::String(ap));
                        }
                        if let Some(ksp) = persist_img(
                            so_obj.get("keystoneAnchorImageUrl").and_then(|v| v.as_str()),
                            &format!("r{}_s{}_keystone", r_num, s_idx + 1),
                        ) {
                            so_obj.insert(
                                "keystoneAnchorImageUrl".to_string(),
                                Value::String(ksp),
                            );
                        }
                        if let Some(cands) =
                            so_obj.get_mut("candidates").and_then(|v| v.as_array_mut())
                        {
                            for (c_idx, c) in cands.iter_mut().enumerate() {
                                if let Some(c_obj) = c.as_object_mut() {
                                    if let Some(cp) = persist_img(
                                        c_obj.get("imageUrl").and_then(|v| v.as_str()),
                                        &format!("r{}_s{}_c{}", r_num, s_idx + 1, c_idx + 1),
                                    ) {
                                        c_obj.insert("imageUrl".to_string(), Value::String(cp));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let best_disk_path = persist_img(
        mission.get("bestImageUrl").and_then(|v| v.as_str()),
        "best_overall",
    );
    let mission_mode = if deliverables.len() > 1 {
        "ASSET_PACK"
    } else {
        "SINGLE_ASSET"
    };

    let rubric_val = mission
        .get("rubric")
        .cloned()
        .unwrap_or_else(|| json!([]));
    let refs_val = mission
        .get("referenceSlots")
        .cloned()
        .unwrap_or_else(|| json!([]));

    conn.execute(
        "INSERT INTO harness_missions (
            id, user_id, title, goal, mission_mode, pack_invariants,
            aspect_ratio, model_used, max_rounds, target_score, candidates_per_round,
            status, best_overall_score, best_image_path, best_prompt,
            keystone_anchor_json, deliverables_json, rubric_json, rounds_json, references_json,
            created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, NULL, ?15, ?16, ?17, ?18, ?19, ?20, ?21)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            goal = excluded.goal,
            mission_mode = excluded.mission_mode,
            pack_invariants = excluded.pack_invariants,
            aspect_ratio = excluded.aspect_ratio,
            model_used = excluded.model_used,
            max_rounds = excluded.max_rounds,
            target_score = excluded.target_score,
            candidates_per_round = excluded.candidates_per_round,
            status = excluded.status,
            best_overall_score = excluded.best_overall_score,
            best_image_path = COALESCE(excluded.best_image_path, harness_missions.best_image_path),
            keystone_anchor_json = excluded.keystone_anchor_json,
            deliverables_json = excluded.deliverables_json,
            rubric_json = excluded.rubric_json,
            rounds_json = excluded.rounds_json,
            references_json = excluded.references_json,
            updated_at = excluded.updated_at",
        params![
            mission_id,
            user_id,
            title,
            goal,
            mission_mode,
            invariants,
            aspect_ratio,
            model_used,
            max_rounds,
            target_score,
            candidates_per_round,
            status,
            best_score,
            best_disk_path,
            serde_json::to_string(&cfg).unwrap_or_else(|_| "{}".to_string()),
            serde_json::to_string(&deliverables).unwrap_or_else(|_| "[]".to_string()),
            serde_json::to_string(&rubric_val).unwrap_or_else(|_| "[]".to_string()),
            serde_json::to_string(&rounds).unwrap_or_else(|_| "[]".to_string()),
            serde_json::to_string(&refs_val).unwrap_or_else(|_| "[]".to_string()),
            created_at,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    if let Some(obj) = mission.as_object_mut() {
        obj.insert("id".to_string(), Value::String(mission_id));
        obj.insert("updated_at".to_string(), Value::String(now));
    }
    Ok(mission)
}

#[tauri::command]
fn tauri_update_harness_mission_title(
    state: State<'_, AppDatabase>,
    mission_id: String,
    title: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let clean = title.trim();
    let resolved = if clean.is_empty() {
        "Untitled Goal Mission"
    } else {
        clean
    };
    conn.execute(
        "UPDATE harness_missions SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![resolved, now, mission_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn tauri_update_harness_mission_status(
    state: State<'_, AppDatabase>,
    mission_id: String,
    status: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE harness_missions SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![status.trim(), now, mission_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn tauri_delete_harness_mission(
    state: State<'_, AppDatabase>,
    mission_id: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM harness_missions WHERE id = ?1",
        params![mission_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn tauri_window_minimize(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn tauri_window_toggle_maximize(window: tauri::Window) -> Result<bool, String> {
    let is_max = window.is_maximized().unwrap_or(false);
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
fn tauri_window_close(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("nanobanana-studio"));
            let _ = std::fs::create_dir_all(&app_data_dir);
            let db_path = app_data_dir.join("nanobanana.sqlite3");
            let images_dir = app
                .path()
                .picture_dir()
                .map(|p| p.join("nanobanana"))
                .unwrap_or_else(|_| app_data_dir.join("images"));
            let _ = std::fs::create_dir_all(&images_dir);

            let conn =
                init_database(&db_path).expect("Failed to initialize local SQLite database");
            app.manage(AppDatabase {
                conn: Mutex::new(conn),
                images_dir,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tauri_analyze_prompt,
            tauri_refine_prompt,
            tauri_upsert_user,
            tauri_update_user_profile,
            tauri_create_conversation,
            tauri_list_conversations,
            tauri_get_conversation_detail,
            tauri_save_conversation_turn,
            tauri_toggle_turn_publish,
            tauri_get_user_gallery,
            tauri_get_public_gallery,
            tauri_vault_get_api_key,
            tauri_vault_set_api_key,
            tauri_vault_clear_api_key,
            tauri_delete_conversation,
            tauri_update_conversation_title,
            tauri_update_conversation_dna,
            tauri_update_turn_selection,
            tauri_vault_get_images_dir,
            tauri_vault_set_images_dir,
            tauri_vault_get_modifiers,
            tauri_vault_set_modifiers,
            tauri_vault_get_ai_prompts,
            tauri_vault_set_ai_prompts,
            tauri_vault_get_theme,
            tauri_vault_set_theme,
            tauri_list_harness_missions,
            tauri_get_harness_mission,
            tauri_save_harness_mission,
            tauri_update_harness_mission_title,
            tauri_update_harness_mission_status,
            tauri_delete_harness_mission,
            tauri_window_minimize,
            tauri_window_toggle_maximize,
            tauri_window_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nano Banana Studio Tauri application");
}
