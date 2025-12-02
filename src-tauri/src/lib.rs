// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn test_command() -> String {
    "Test works!".to_string()
}

pub mod media_player;
pub mod playlist;

// Re-export the commands
pub use media_player::{check_file_exists, get_audio_metadata, update_metadata};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            test_command,
            get_audio_metadata,
            media_player::get_audio_file_info,
            update_metadata,
            check_file_exists,
            playlist::save_playlist,
            playlist::load_playlist,
            playlist::get_playlists,
            playlist::delete_playlist,
            playlist::rename_playlist
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
