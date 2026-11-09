use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::fs;
use std::path::{Path, PathBuf};

pub fn sanitize_project_folder_name(title: &str, fallback_id: &str) -> String {
    let cleaned: String = title
        .trim()
        .chars()
        .map(|c| {
            if matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') || c.is_control()
            {
                '_'
            } else {
                c
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if cleaned.is_empty() {
        if fallback_id.is_empty() {
            "New_Project".to_string()
        } else {
            fallback_id.to_string()
        }
    } else {
        cleaned
    }
}

/// Decodes a `data:image/...;base64,...` string and writes the binary PNG/JPEG file to `dir_path/file_name`.
pub fn save_base64_png_to_dir(dir_path: &Path, file_name: &str, data_url: &str) -> Option<String> {
    let trimmed = data_url.trim();
    if !trimmed.starts_with("data:image/")
        || trimmed.starts_with("data:image/svg+xml")
        || !trimmed.contains(";base64,")
    {
        return None;
    }
    let comma_idx = trimmed.find(',')?;
    let b64 = &trimmed[comma_idx + 1..];
    let bytes = STANDARD.decode(b64).ok()?;
    fs::create_dir_all(dir_path).ok()?;
    let full_path = dir_path.join(file_name);
    fs::write(&full_path, bytes).ok()?;
    Some(full_path.to_string_lossy().to_string())
}

/// Reads a local image file from disk and encodes it as a `data:image/...;base64,...` URL for WebView display.
pub fn disk_path_to_data_url(path_or_url: &str) -> Option<String> {
    let trimmed = path_or_url.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.starts_with("data:") || trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return Some(trimmed.to_string());
    }

    let raw_path = if let Some(stripped) = trimmed.strip_prefix("/api/image?path=") {
        urlencoding_decode(stripped)
    } else {
        trimmed.to_string()
    };

    let path = PathBuf::from(&raw_path);
    let bytes = fs::read(&path).ok()?;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_ascii_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    };
    Some(format!("data:{};base64,{}", mime, STANDARD.encode(bytes)))
}

fn urlencoding_decode(input: &str) -> String {
    let mut out = Vec::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex_str) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(val) = u8::from_str_radix(hex_str, 16) {
                    out.push(val);
                    i += 3;
                    continue;
                }
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

/// Legacy helper kept for backward compatibility.
pub fn persist_image_to_native_fs(
    images_root: &Path,
    project_title: &str,
    file_stem: &str,
    data_url: &str,
) -> Option<String> {
    let folder = sanitize_project_folder_name(project_title, "Studio_Project");
    let proj_dir = images_root.join(folder);
    save_base64_png_to_dir(&proj_dir, &format!("{}.png", file_stem), data_url)
}
