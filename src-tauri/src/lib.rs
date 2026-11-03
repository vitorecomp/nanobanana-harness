pub mod copilot;
pub mod db;
pub mod storage;

use chrono::Utc;
use copilot::{analyze_idea, refine_prompt, AnalyzePromptResponse, RefinePromptResponse};
use db::{
    init_database, AppDatabase, ConversationDetail, ConversationSummary, GalleryItem, TurnRecord,
    UserRecord,
};
use rusqlite::params;
use std::sync::Mutex;
use storage::persist_image_to_native_fs;
use tauri::{Manager, State};
use uuid::Uuid;

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
    let resolved_style = style_id.unwrap_or_else(|| "editorial-anime".to_string());

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
                    (SELECT t.image_data_url FROM conversation_turns t WHERE t.conversation_id = c.id ORDER BY t.turn_number DESC LIMIT 1) AS preview_image_url
             FROM conversations c
             WHERE c.user_id = ?1
             ORDER BY c.updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![user_id], |row| {
            Ok(ConversationSummary {
                id: row.get(0)?,
                user_id: row.get(1)?,
                title: row.get(2)?,
                style_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                turn_count: row.get(6)?,
                latest_prompt: row.get(7)?,
                preview_image_url: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for item in rows {
        if let Ok(conv) = item {
            out.push(conv);
        }
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
        .prepare("SELECT id, user_id, title, style_id, created_at, updated_at FROM conversations WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let mut conv_iter = stmt
        .query_map(params![conversation_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let Some(Ok((id, user_id, title, style_id, created_at, updated_at))) = conv_iter.next() else {
        return Ok(None);
    };

    let mut t_stmt = conn
        .prepare(
            "SELECT id, conversation_id, user_id, turn_number, role, raw_idea, master_prompt,
                    edit_instruction, style_id, modifiers_json, completeness_score, image_path,
                    image_data_url, aspect_ratio, model_used, is_published, created_at
             FROM conversation_turns
             WHERE conversation_id = ?1
             ORDER BY turn_number ASC",
        )
        .map_err(|e| e.to_string())?;

    let turn_rows = t_stmt
        .query_map(params![id], |row| {
            let mod_str: String = row.get(9)?;
            let modifiers: Vec<String> = serde_json::from_str(&mod_str).unwrap_or_default();
            let pub_int: i64 = row.get(15)?;
            Ok(TurnRecord {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                user_id: row.get(2)?,
                turn_number: row.get(3)?,
                role: row.get(4)?,
                raw_idea: row.get(5)?,
                master_prompt: row.get(6)?,
                edit_instruction: row.get(7)?,
                style_id: row.get(8)?,
                modifiers,
                completeness_score: row.get(10)?,
                image_bucket_key: row.get(11)?,
                image_url: row.get(12)?,
                aspect_ratio: row.get(13)?,
                model_used: row.get(14)?,
                is_published: pub_int != 0,
                created_at: row.get(16)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut turns = Vec::new();
    for tr in turn_rows {
        if let Ok(t) = tr {
            turns.push(t);
        }
    }

    let latest_prompt = turns.last().map(|t| t.master_prompt.clone());
    let preview_image_url = turns.last().and_then(|t| t.image_url.clone());

    Ok(Some(ConversationDetail {
        id,
        user_id,
        title,
        style_id,
        turn_count: turns.len(),
        latest_prompt,
        preview_image_url,
        created_at,
        updated_at,
        turns,
    }))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn tauri_save_conversation_turn(
    state: State<'_, AppDatabase>,
    conversation_id: String,
    user_id: String,
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
) -> Result<TurnRecord, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let turn_id = format!("turn_{}", &Uuid::new_v4().simple().to_string()[..12]);

    let next_turn: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(turn_number), 0) + 1 FROM conversation_turns WHERE conversation_id = ?1",
            params![conversation_id],
            |r| r.get(0),
        )
        .unwrap_or(1);

    let resolved_style = style_id.unwrap_or_else(|| "editorial-anime".to_string());
    let resolved_mods = modifiers.unwrap_or_default();
    let mods_json = serde_json::to_string(&resolved_mods).unwrap_or_else(|_| "[]".to_string());
    let resolved_score = completeness_score.unwrap_or(85);
    let resolved_aspect = aspect_ratio.unwrap_or_else(|| "3:4".to_string());
    let resolved_model = model_used.unwrap_or_else(|| "gemini-2.5-flash-image".to_string());
    let resolved_pub = is_published.unwrap_or(false);

    let image_path = image_data_url
        .as_deref()
        .and_then(|d| persist_image_to_native_fs(&state.images_dir, &user_id, &turn_id, d));

    conn.execute(
        "INSERT INTO conversation_turns (
            id, conversation_id, user_id, turn_number, role, raw_idea, master_prompt,
            edit_instruction, style_id, modifiers_json, completeness_score, image_path,
            image_data_url, aspect_ratio, model_used, is_published, created_at
         ) VALUES (?1, ?2, ?3, ?4, 'assistant', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            turn_id,
            conversation_id,
            user_id,
            next_turn,
            raw_idea,
            master_prompt,
            edit_instruction,
            resolved_style,
            mods_json,
            resolved_score,
            image_path,
            image_data_url,
            resolved_aspect,
            resolved_model,
            if resolved_pub { 1 } else { 0 },
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    let _ = conn.execute(
        "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
        params![now, conversation_id],
    );

    Ok(TurnRecord {
        id: turn_id,
        conversation_id,
        user_id,
        turn_number: next_turn,
        role: "assistant".to_string(),
        raw_idea,
        master_prompt,
        edit_instruction,
        style_id: resolved_style,
        modifiers: resolved_mods,
        completeness_score: resolved_score,
        image_bucket_key: image_path,
        image_url: image_data_url,
        aspect_ratio: resolved_aspect,
        model_used: resolved_model,
        is_published: resolved_pub,
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
             WHERE t.user_id = ?1 AND t.image_data_url IS NOT NULL AND t.image_data_url != ''
             ORDER BY t.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![user_id], |row| {
            let tid: String = row.get(0)?;
            let mod_str: String = row.get(10)?;
            let modifiers: Vec<String> = serde_json::from_str(&mod_str).unwrap_or_default();
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
                image_bucket_key: row.get(12)?,
                image_url: row.get(13)?,
                model_used: row.get(14)?,
                is_published: pub_int != 0,
                is_curated: false,
                created_at: row.get(16)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for item in rows {
        if let Ok(g) = item {
            out.push(g);
        }
    }
    Ok(out)
}

#[tauri::command]
fn tauri_get_public_gallery(state: State<'_, AppDatabase>) -> Result<Vec<GalleryItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.conversation_id, COALESCE(c.title, 'Published Session'), t.turn_number,
                    COALESCE(u.name, 'Studio Creator'), t.user_id, t.raw_idea, t.master_prompt,
                    t.edit_instruction, t.style_id, t.modifiers_json, t.aspect_ratio,
                    COALESCE(t.image_path, ''), COALESCE(t.image_data_url, ''), t.model_used,
                    t.created_at
             FROM conversation_turns t
             LEFT JOIN conversations c ON c.id = t.conversation_id
             LEFT JOIN users u ON u.id = t.user_id
             WHERE t.is_published = 1 AND t.image_data_url IS NOT NULL AND t.image_data_url != ''
             ORDER BY t.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let tid: String = row.get(0)?;
            let mod_str: String = row.get(10)?;
            let modifiers: Vec<String> = serde_json::from_str(&mod_str).unwrap_or_default();
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
                image_bucket_key: row.get(12)?,
                image_url: row.get(13)?,
                model_used: row.get(14)?,
                is_published: true,
                is_curated: false,
                created_at: row.get(15)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for item in rows {
        if let Ok(g) = item {
            out.push(g);
        }
    }
    Ok(out)
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

            let conn = init_database(&db_path).expect("Failed to initialize local SQLite database");
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
            tauri_window_minimize,
            tauri_window_toggle_maximize,
            tauri_window_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nano Banana Studio Tauri application");
}
