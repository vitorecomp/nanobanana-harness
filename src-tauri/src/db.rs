use chrono::Utc;
use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use serde_json::Value;
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
pub struct TurnVariantOutput {
    pub label: String,
    pub prompt: String,
    #[serde(rename = "imageUrl")]
    pub image_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnRecord {
    pub id: String,
    pub conversation_id: String,
    pub user_id: String,
    pub turn_number: i64,
    pub parent_turn_number: Option<i64>,
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
    pub variants: Vec<TurnVariantOutput>,
    pub selected_variant_index: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationDetail {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub style_id: String,
    pub canonical_dna: Option<Value>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HarnessMissionSummary {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub goal: String,
    pub status: String,
    #[serde(rename = "deliverableCount")]
    pub deliverable_count: usize,
    #[serde(rename = "solvedCount")]
    pub solved_count: usize,
    #[serde(rename = "roundCount")]
    pub round_count: usize,
    #[serde(rename = "bestScore")]
    pub best_score: i64,
    #[serde(rename = "bestImageUrl")]
    pub best_image_url: Option<String>,
    #[serde(rename = "aspectRatio")]
    pub aspect_ratio: String,
    #[serde(rename = "modelUsed")]
    pub model_used: String,
    pub created_at: String,
    pub updated_at: String,
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
            style_id TEXT NOT NULL DEFAULT '',
            canonical_dna_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS conversation_turns (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            turn_number INTEGER NOT NULL DEFAULT 1,
            parent_turn_number INTEGER,
            role TEXT NOT NULL DEFAULT 'assistant',
            raw_idea TEXT NOT NULL DEFAULT '',
            master_prompt TEXT NOT NULL DEFAULT '',
            edit_instruction TEXT,
            style_id TEXT NOT NULL DEFAULT '',
            modifiers_json TEXT NOT NULL DEFAULT '[]',
            completeness_score INTEGER NOT NULL DEFAULT 80,
            image_path TEXT,
            image_data_url TEXT,
            aspect_ratio TEXT NOT NULL DEFAULT '3:4',
            model_used TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
            is_published INTEGER NOT NULL DEFAULT 0,
            variants_json TEXT NOT NULL DEFAULT '[]',
            selected_variant_index INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS app_vault (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS harness_missions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            goal TEXT NOT NULL,
            mission_mode TEXT NOT NULL DEFAULT 'SINGLE_ASSET',
            pack_invariants TEXT NOT NULL DEFAULT '',
            aspect_ratio TEXT NOT NULL DEFAULT '1:1',
            model_used TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
            max_rounds INTEGER NOT NULL DEFAULT 4,
            target_score INTEGER NOT NULL DEFAULT 85,
            candidates_per_round INTEGER NOT NULL DEFAULT 2,
            status TEXT NOT NULL DEFAULT 'idle',
            best_overall_score INTEGER NOT NULL DEFAULT 0,
            best_image_path TEXT,
            best_prompt TEXT,
            keystone_anchor_json TEXT,
            deliverables_json TEXT NOT NULL DEFAULT '[]',
            rubric_json TEXT NOT NULL DEFAULT '[]',
            rounds_json TEXT NOT NULL DEFAULT '[]',
            references_json TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        ",
    )?;

    // Idempotent column migrations for pre-existing local databases
    let _ = conn.execute(
        "ALTER TABLE conversation_turns ADD COLUMN variants_json TEXT NOT NULL DEFAULT '[]';",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE conversation_turns ADD COLUMN selected_variant_index INTEGER NOT NULL DEFAULT 0;",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE conversation_turns ADD COLUMN parent_turn_number INTEGER;",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE conversations ADD COLUMN canonical_dna_json TEXT;",
        [],
    );

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
