use std::fs;
use std::path::{Path, PathBuf};

/// Saves a generated image (`data:image/...` or SVG) into the native OS app data directory
/// (`<app_data_dir>/images/<user_id>/<turn_id>.<ext>`) and returns the relative file key.
pub fn persist_image_to_native_fs(
    images_root: &Path,
    user_id: &str,
    turn_id: &str,
    data_url: &str,
) -> Option<String> {
    if data_url.trim().is_empty() {
        return None;
    }

    let safe_user: String = user_id
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect();
    let safe_turn: String = turn_id
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect();

    let user_dir: PathBuf = images_root.join(&safe_user);
    let _ = fs::create_dir_all(&user_dir);

    let ext = if data_url.contains("image/svg") {
        "svg"
    } else if data_url.contains("image/jpeg") {
        "jpg"
    } else {
        "png"
    };

    let filename = format!("{}.{}", safe_turn, ext);
    let file_path = user_dir.join(&filename);
    let _ = fs::write(&file_path, data_url.as_bytes());

    Some(format!("local_fs/{}/{}", safe_user, filename))
}
