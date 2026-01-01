use crate::media_player::Track;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct Playlist {
    pub name: String,
    pub tracks: Vec<Track>,
    pub cover_image: Option<String>,
}

fn get_playlist_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let playlist_dir = app_data_dir.join("playlists");

    if !playlist_dir.exists() {
        fs::create_dir_all(&playlist_dir).map_err(|e| e.to_string())?;
    }

    Ok(playlist_dir)
}

fn get_playlist_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = get_playlist_dir(app)?;
    Ok(dir.join(format!("{}.json", name)))
}

fn save_playlist_to_disk(path: &PathBuf, playlist: &Playlist) -> Result<(), String> {
    let json = serde_json::to_string_pretty(playlist).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_playlist(
    app: AppHandle,
    name: String,
    tracks: Vec<Track>,
    cover_image: Option<String>,
) -> Result<(), String> {
    println!("Saving playlist: {}, cover_image: {:?}", name, cover_image);
    let file_path = get_playlist_path(&app, &name)?;

    let playlist = Playlist {
        name,
        tracks,
        cover_image,
    };

    save_playlist_to_disk(&file_path, &playlist)?;
    Ok(())
}

#[tauri::command]
pub fn load_playlist(app: AppHandle, name: String) -> Result<Playlist, String> {
    let file_path = get_playlist_path(&app, &name)?;

    if !file_path.exists() {
        return Err("Playlist not found".to_string());
    }

    let json = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let playlist: Playlist = serde_json::from_str(&json).map_err(|e| e.to_string())?;

    Ok(playlist)
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct PlaylistSummary {
    pub name: String,
    pub track_count: usize,
    pub cover_image: Option<String>,
}

#[tauri::command]
pub fn get_playlists(app: AppHandle) -> Result<Vec<PlaylistSummary>, String> {
    let dir = get_playlist_dir(&app)?;
    let mut playlists = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if let Some(extension) = path.extension() {
                    if extension == "json" {
                        // Read the file to get the metadata
                        if let Ok(json) = fs::read_to_string(&path) {
                            // We deserialize to Playlist to get the track count,
                            // but we don't send the tracks to the frontend.
                            if let Ok(playlist) = serde_json::from_str::<Playlist>(&json) {
                                playlists.push(PlaylistSummary {
                                    name: playlist.name,
                                    track_count: playlist.tracks.len(),
                                    cover_image: playlist.cover_image,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(playlists)
}

#[tauri::command]
pub fn delete_playlist(app: AppHandle, name: String) -> Result<(), String> {
    let file_path = get_playlist_path(&app, &name)?;

    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn rename_playlist(app: AppHandle, old_name: String, new_name: String) -> Result<(), String> {
    println!("Renaming playlist from {} to {}", old_name, new_name);
    let old_path = get_playlist_path(&app, &old_name)?;
    let new_path = get_playlist_path(&app, &new_name)?;

    if !old_path.exists() {
        return Err("Playlist not found".to_string());
    }
    if new_path.exists() {
        return Err("Playlist with new name already exists".to_string());
    }

    // Read, update name field, write to new path, delete old path
    let json = fs::read_to_string(&old_path).map_err(|e| e.to_string())?;
    let mut playlist: Playlist = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    playlist.name = new_name;

    save_playlist_to_disk(&new_path, &playlist)?;
    fs::remove_file(&old_path).map_err(|e| e.to_string())?;

    Ok(())
}
