use chrono::Utc;
use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppDatabase {
    pub conn: Mutex<Connection>,
    pub images_dir: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRecord {
    pub id: String,
    pub provider: String,
    pub google_sub: String,
    pub email: String,
    pub name: String,
    pub picture: String,
    pub email_verified: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationSummary {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub style_id: String,
    pub turn_count: i64,
    pub latest_prompt: Option<String>,
    pub preview_image_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnRecord {
    pub id: String,
    pub conversation_id: String,
    pub user_id: String,
    pub turn_number: i64,
    pub role: String,
    pub raw_idea: String,
    pub master_prompt: String,
    pub edit_instruction: Option<String>,
    pub style_id: String,
    pub modifiers: Vec<String>,
    pub completeness_score: i64,
    pub image_bucket_key: Option<String>,
    pub image_url: Option<String>,
    pub aspect_ratio: String,
    pub model_used: String,
    pub is_published: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationDetail {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub style_id: String,
    pub turn_count: usize,
    pub latest_prompt: Option<String>,
    pub preview_image_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub turns: Vec<TurnRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GalleryItem {
    pub id: String,
    pub turn_id: String,
    pub conversation_id: String,
    pub conversation_title: String,
    pub turn_number: i64,
    pub author_name: String,
    pub author_id: String,
    pub raw_idea: String,
    pub master_prompt: String,
    pub edit_instruction: Option<String>,
    pub style_id: String,
    pub modifiers: Vec<String>,
    pub aspect_ratio: String,
    pub image_bucket_key: String,
    pub image_url: String,
    pub model_used: String,
    pub is_published: bool,
    pub is_curated: bool,
    pub created_at: String,
}

pub fn init_database(db_path: &PathBuf) -> SqlResult<Connection> {
    if let Some(parent) = db_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let conn = Connection::open(db_path)?;
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            provider TEXT NOT NULL DEFAULT 'google',
            google_sub TEXT NOT NULL,
            email TEXT NOT NULL,
            name TEXT NOT NULL,
            picture TEXT NOT NULL DEFAULT '',
            email_verified INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            style_id TEXT NOT NULL DEFAULT 'editorial-anime',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS conversation_turns (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            turn_number INTEGER NOT NULL DEFAULT 1,
            role TEXT NOT NULL DEFAULT 'assistant',
            raw_idea TEXT NOT NULL DEFAULT '',
            master_prompt TEXT NOT NULL DEFAULT '',
            edit_instruction TEXT,
            style_id TEXT NOT NULL DEFAULT 'editorial-anime',
            modifiers_json TEXT NOT NULL DEFAULT '[]',
            completeness_score INTEGER NOT NULL DEFAULT 80,
            image_path TEXT,
            image_data_url TEXT,
            aspect_ratio TEXT NOT NULL DEFAULT '3:4',
            model_used TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
            is_published INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS app_vault (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        ",
    )?;

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR IGNORE INTO users (id, provider, google_sub, email, name, picture, email_verified, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7)",
        params![
            "usr_local_dev",
            "local_dev",
            "local-dev-instance",
            "dev@localhost",
            "Local Studio Creator",
            "",
            now
        ],
    )?;

    Ok(conn)
}
