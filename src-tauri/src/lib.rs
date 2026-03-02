use std::fs;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[tauri::command]
fn list_files(path: &str) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    let read_result = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in read_result {
        if let Ok(entry) = entry {
            let path = entry.path();
            let is_dir = path.is_dir();
            let name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();
            
            // Convert to string safely (ignoring non-UTF8 paths generally good for GUI)
            let path_str = path.to_string_lossy().to_string();

            entries.push(FileEntry {
                name,
                path: path_str,
                is_dir,
            });
        }
    }
    
    // Sort directories first, then files
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else {
            b.is_dir.cmp(&a.is_dir)
        }
    });

    Ok(entries)
}

#[tauri::command]
fn read_file_content(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not find home directory".to_string())
}

#[tauri::command]
fn read_binary_file(path: &str) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file_content(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_files, 
            read_file_content, 
            get_home_dir,
            read_binary_file,
            write_file_content
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
