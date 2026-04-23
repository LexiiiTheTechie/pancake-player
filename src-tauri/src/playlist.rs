use crate::media_player::{get_audio_metadata, Track};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri::Manager;

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct Playlist {
    pub name: String,
    pub tracks: Vec<Track>,
    pub cover_image: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub folder_path: Option<String>,
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
    tags: Option<Vec<String>>,
    folder_path: Option<String>,
) -> Result<(), String> {
    println!("Saving playlist: {}, tags: {:?}, folder: {:?}", name, tags, folder_path);
    let file_path = get_playlist_path(&app, &name)?;

    let playlist = Playlist {
        name,
        tracks,
        cover_image,
        tags: tags.unwrap_or_default(),
        folder_path,
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
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub folder_path: Option<String>,
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
                            if let Ok(playlist) = serde_json::from_str::<Playlist>(&json) {
                                playlists.push(PlaylistSummary {
                                    name: playlist.name,
                                    track_count: playlist.tracks.len(),
                                    cover_image: playlist.cover_image,
                                    tags: playlist.tags,
                                    folder_path: playlist.folder_path,
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

#[tauri::command]
pub fn update_playlist_tags(app: AppHandle, name: String, tags: Vec<String>) -> Result<(), String> {
    println!("Updating tags for playlist: {} to {:?}", name, tags);
    let file_path = get_playlist_path(&app, &name)?;

    if !file_path.exists() {
        return Err("Playlist not found".to_string());
    }

    let json = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let mut playlist: Playlist = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    playlist.tags = tags;

    save_playlist_to_disk(&file_path, &playlist)?;
    Ok(())
}

#[tauri::command]
pub async fn import_folder_as_playlist(
    app: AppHandle,
    folder_path: String,
) -> Result<PlaylistSummary, String> {
    let folder = Path::new(&folder_path);
    if !folder.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let folder_name = folder.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("New Playlist")
        .to_string();

    let mut audio_files = Vec::new();
    let mut image_path = None;

    let audio_extensions = ["mp3", "m4a", "mp4", "wav", "flac", "ogg", "aiff", "aif"];
    let image_extensions = ["jpg", "jpeg", "png", "webp"];
    let cover_names = ["cover", "folder", "album", "art", "front"];

    if let Ok(entries) = fs::read_dir(folder) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()) {
                    if audio_extensions.contains(&ext.as_str()) {
                        audio_files.push(path.to_string_lossy().to_string());
                    } else if image_extensions.contains(&ext.as_str()) {
                        // Case-insensitive stem check
                        let stem = path.file_stem()
                            .and_then(|s| s.to_str())
                            .map(|s| s.to_lowercase())
                            .unwrap_or_default();
                        let is_named_cover = cover_names.iter().any(|&cn| stem == cn || stem.contains(cn));
                        if is_named_cover {
                            // Named cover takes priority — overwrite any previous fallback
                            image_path = Some(path.clone());
                        } else if image_path.is_none() {
                            // Fallback: use the first image found if no named cover
                            image_path = Some(path.clone());
                        }
                    }
                }
            }
        }
    }

    if audio_files.is_empty() {
        return Err("No audio files found in folder".to_string());
    }

    // Sort audio files by name
    audio_files.sort();

    // Limit concurrency for metadata extraction
    use std::sync::Arc;
    use tokio::sync::Semaphore;
    let semaphore = Arc::new(Semaphore::new(4));
    let mut tasks = Vec::new();

    for path in audio_files {
        let sem: Arc<Semaphore> = Arc::clone(&semaphore);
        tasks.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            get_audio_metadata(path, false).await
        }));
    }

    let mut tracks = Vec::new();
    for task in tasks {
        if let Ok(Ok(track)) = task.await {
            tracks.push(track);
        }
    }

    // Prepare cover image (use path instead of base64 for better performance/compatibility)
    let cover_image_path = image_path.map(|p| p.to_string_lossy().to_string());

    let mut playlist = Playlist {
        name: folder_name.clone(),
        tracks,
        cover_image: cover_image_path.clone(),
        tags: Vec::new(),
        folder_path: Some(folder_path.clone()),
    };

    // Auto-generate tags from unique artists found in the tracks
    let mut artists: Vec<String> = playlist.tracks.iter()
        .filter_map(|t| t.artist.clone())
        .flat_map(|a| {
            a.replace("feat.", ",")
             .replace('&', ",")
             .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| s != "Unknown Artist" && !s.is_empty())
                .collect::<Vec<_>>()
        })
        .collect();
    artists.sort();
    artists.dedup();
    playlist.tags = artists;

    let file_path = get_playlist_path(&app, &folder_name)?;
    save_playlist_to_disk(&file_path, &playlist)?;

    Ok(PlaylistSummary {
        name: folder_name,
        track_count: playlist.tracks.len(),
        cover_image: cover_image_path,
        tags: playlist.tags,
        folder_path: playlist.folder_path,
    })
}
