// src-tauri/src/media_player.rs
use base64::{engine::general_purpose, Engine as _};
use id3::TagLike;
use std::fs::File;
use std::path::Path;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::StandardTagKey;
use symphonia::core::probe::Hint;

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct Track {
    pub path: String,
    pub filename: String,
    pub duration: f64,
    pub artist: Option<String>,
    pub title: Option<String>,
    pub album: Option<String>,
}

// Helper function to clean metadata strings
fn clean_metadata_string(s: &str) -> String {
    s.trim()
        .trim_matches('\0')
        .trim()
        .replace('\0', "")
        .to_string()
}

// Try to read metadata using id3 crate (for MP3 files)
fn try_id3_metadata(
    path: &Path,
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    f64,
    Option<String>,
) {
    match id3::Tag::read_from_path(path) {
        Ok(tag) => {
            let artist = tag.artist().map(|s| clean_metadata_string(s));
            let title = tag.title().map(|s| clean_metadata_string(s));
            let album = tag.album().map(|s| clean_metadata_string(s));

            // Extract cover image
            let cover_image = tag
                .pictures()
                .next()
                .map(|p| general_purpose::STANDARD.encode(&p.data));

            // Try to get duration from id3
            let duration = tag.duration().unwrap_or(0) as f64 / 1000.0;

            eprintln!(
                "ID3 read - Artist: {:?}, Title: {:?}, Album: {:?}, Duration: {}, Has Image: {}",
                artist,
                title,
                album,
                duration,
                cover_image.is_some()
            );
            (artist, title, album, duration, cover_image)
        }
        Err(e) => {
            eprintln!("Failed to read ID3 tags: {}", e);
            (None, None, None, 0.0, None)
        }
    }
}

// Try to read metadata using mp4ameta crate (for M4A/MP4 files)
fn try_mp4_metadata(
    path: &Path,
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    f64,
    Option<String>,
) {
    match mp4ameta::Tag::read_from_path(path) {
        Ok(tag) => {
            let artist = tag.artist().map(|s| clean_metadata_string(s));
            let title = tag.title().map(|s| clean_metadata_string(s));
            let album = tag.album().map(|s| clean_metadata_string(s));

            // Extract cover image
            let cover_image = tag
                .artworks()
                .next()
                .map(|art| general_purpose::STANDARD.encode(&art.data));

            // Try to get duration
            let duration = tag.duration().map(|d| d.as_secs_f64()).unwrap_or(0.0);

            eprintln!(
                "MP4 read - Artist: {:?}, Title: {:?}, Album: {:?}, Duration: {}, Has Image: {}",
                artist,
                title,
                album,
                duration,
                cover_image.is_some()
            );
            (artist, title, album, duration, cover_image)
        }
        Err(e) => {
            eprintln!("Failed to read MP4 tags: {}", e);
            (None, None, None, 0.0, None)
        }
    }
}

// Try to read metadata using Symphonia (for FLAC, WAV, OGG, etc.)
fn try_symphonia_metadata(
    path: &Path,
    enable_gapless: bool,
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    f64,
    Option<String>,
) {
    let source = match File::open(path) {
        Ok(file) => file,
        Err(e) => {
            eprintln!("Failed to open file: {}", e);
            return (None, None, None, 0.0, None);
        }
    };

    let mss = MediaSourceStream::new(Box::new(source), Default::default());
    let mut hint = Hint::new();
    if let Some(extension) = path.extension().and_then(|s| s.to_str()) {
        hint.with_extension(extension);
    }

    let format_opts = symphonia::core::formats::FormatOptions {
        enable_gapless,
        ..Default::default()
    };
    let metadata_opts = symphonia::core::meta::MetadataOptions {
        limit_metadata_bytes: symphonia::core::meta::Limit::Maximum(50 * 1024 * 1024), // 50 MB limit
        limit_visual_bytes: symphonia::core::meta::Limit::Maximum(50 * 1024 * 1024),
    };

    let probed =
        match symphonia::default::get_probe().format(&hint, mss, &format_opts, &metadata_opts) {
            Ok(probed) => probed,
            Err(e) => {
                eprintln!("Failed to probe format: {}", e);
                return (None, None, None, 0.0, None);
            }
        };

    let mut format = probed.format;
    let mut probe_metadata = probed.metadata;

    // Calculate duration
    let mut duration = 0.0;
    if let Some(track) = format.default_track() {
        if let (Some(n_frames), Some(sample_rate)) =
            (track.codec_params.n_frames, track.codec_params.sample_rate)
        {
            if n_frames > 0 && sample_rate > 0 {
                duration = n_frames as f64 / sample_rate as f64;
            }
        }
    }

    let (mut artist, mut title, mut album, mut cover_image) = (None, None, None, None);

    // Helper to extract from revision
    let extract = |rev: &symphonia::core::meta::MetadataRevision,
                   artist: &mut Option<String>,
                   title: &mut Option<String>,
                   album: &mut Option<String>| {
        for tag in rev.tags() {
            if let Some(std_key) = tag.std_key {
                match std_key {
                    StandardTagKey::Artist => {
                        if artist.is_none() {
                            let cleaned = clean_metadata_string(&tag.value.to_string());
                            if !cleaned.is_empty() {
                                *artist = Some(cleaned);
                            }
                        }
                    }
                    StandardTagKey::TrackTitle => {
                        if title.is_none() {
                            let cleaned = clean_metadata_string(&tag.value.to_string());
                            if !cleaned.is_empty() {
                                *title = Some(cleaned);
                            }
                        }
                    }
                    StandardTagKey::Album => {
                        if album.is_none() {
                            let cleaned = clean_metadata_string(&tag.value.to_string());
                            if !cleaned.is_empty() {
                                *album = Some(cleaned);
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    };

    // Helper to extract visual (cover art)
    let extract_visual = |rev: &symphonia::core::meta::MetadataRevision| -> Option<String> {
        rev.visuals()
            .first()
            .map(|v| general_purpose::STANDARD.encode(&v.data))
    };

    // Check probe metadata (if it exists)
    if let Some(mut metadata_queue) = probe_metadata.get() {
        if let Some(rev) = metadata_queue.current() {
            extract(rev, &mut artist, &mut title, &mut album);
            if cover_image.is_none() {
                cover_image = extract_visual(rev);
            }
        }

        // Try all revisions from probe metadata
        if artist.is_none() || title.is_none() || album.is_none() {
            while let Some(rev) = metadata_queue.pop() {
                extract(&rev, &mut artist, &mut title, &mut album);
                if cover_image.is_none() {
                    cover_image = extract_visual(&rev);
                }
                if artist.is_some() && title.is_some() && album.is_some() && cover_image.is_some() {
                    break;
                }
            }
        }
    }

    // Check format metadata
    if let Some(rev) = format.metadata().current() {
        extract(rev, &mut artist, &mut title, &mut album);
        if cover_image.is_none() {
            cover_image = extract_visual(rev);
        }
    }

    // Try all format metadata revisions if still missing
    if artist.is_none() || title.is_none() || album.is_none() {
        let mut format_metadata = format.metadata();
        while let Some(rev) = format_metadata.pop() {
            extract(&rev, &mut artist, &mut title, &mut album);
            if cover_image.is_none() {
                cover_image = extract_visual(&rev);
            }
            if artist.is_some() && title.is_some() && album.is_some() && cover_image.is_some() {
                break;
            }
        }
    }

    eprintln!(
        "Symphonia read - Artist: {:?}, Title: {:?}, Album: {:?}, Duration: {}, Has Image: {}",
        artist,
        title,
        album,
        duration,
        cover_image.is_some()
    );
    (artist, title, album, duration, cover_image)
}

#[tauri::command]
pub async fn get_audio_metadata(file_path: String, enable_gapless: bool) -> Result<Track, String> {
    let result = tauri::async_runtime::spawn(async move {
        let path = Path::new(&file_path);

        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown File")
            .to_string();

        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        eprintln!(
            "\n=== Processing file: {} (extension: {}) ===",
            filename, extension
        );

        // Safety CHECK: If file is huge (> 3GB), force disable gapless scan to prevent crash
        // This heuristic protects against OOM on massive FLAC rips while allowing gapless for normal sized tracks.
        let file_size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
        let safe_enable_gapless = if enable_gapless && file_size > 3 * 1024 * 1024 * 1024 {
            eprintln!(
                "⚠️ Safety Override: File size {} MB is too large for gapless scan. Disabling gapless to prevent crash.",
                file_size / (1024 * 1024)
            );
            false
        } else {
            enable_gapless
        };

        // Try different metadata readers based on file extension
        let (mut artist, mut title, mut album, mut duration, _) =
            match extension.as_str() {
                "mp3" => try_id3_metadata(path),
                "m4a" | "mp4" | "aac" => try_mp4_metadata(path),
                _ => (None, None, None, 0.0, None),
            };

        // If specialized reader didn't work or for other formats, try Symphonia
        if artist.is_none()
            || title.is_none()
            || album.is_none()
            || duration == 0.0
        {
            eprintln!("Trying Symphonia as fallback...");
            let (sym_artist, sym_title, sym_album, sym_duration, _) =
                try_symphonia_metadata(path, safe_enable_gapless);

            if artist.is_none() {
                artist = sym_artist;
            }
            if title.is_none() {
                title = sym_title;
            }
            if album.is_none() {
                album = sym_album;
            }
            if duration == 0.0 {
                duration = sym_duration;
            }
        }

        // Fallback title to filename if still missing
        let final_title = if let Some(t) = title {
            if t.is_empty() {
                filename
                    .strip_suffix(&format!(".{}", extension))
                    .unwrap_or(&filename)
                    .to_string()
            } else {
                t
            }
        } else {
            filename
                .strip_suffix(&format!(".{}", extension))
                .unwrap_or(&filename)
                .to_string()
        };

        eprintln!(
            "=== Final result - Artist: {:?}, Title: {:?}, Album: {:?}, Duration: {} ===\n",
            artist, final_title, album, duration
        );

        Ok(Track {
            path: file_path,
            filename,
            duration,
            artist,
            title: Some(final_title),
            album,
        })
    })
    .await;

    match result {
        Ok(inner_res) => inner_res,
        Err(e) => Err(format!("Task failed to execute: {}", e)),
    }
}

#[tauri::command]
pub async fn update_metadata(
    file_path: String,
    artist: Option<String>,
    title: Option<String>,
    album: Option<String>,
) -> Result<(), String> {
    let result = tauri::async_runtime::spawn(async move {
        let path = Path::new(&file_path);

        // Check if file exists
        if !path.exists() {
            return Err("File not found".to_string());
        }

        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        match extension.as_str() {
            "mp3" => {
                // Handle MP3 files with id3
                let mut tag = id3::Tag::read_from_path(path).unwrap_or_else(|_| id3::Tag::new());

                if let Some(a) = artist {
                    tag.set_artist(a);
                }
                if let Some(t) = title {
                    tag.set_title(t);
                }
                if let Some(alb) = album {
                    tag.set_album(alb);
                }

                tag.write_to_path(path, id3::Version::Id3v24)
                    .map_err(|e| format!("Failed to write ID3 tags: {}", e))?;

                Ok(())
            }
            "m4a" | "mp4" | "aac" => {
                // Handle M4A/MP4 files with mp4ameta
                let mut tag = mp4ameta::Tag::read_from_path(path)
                    .map_err(|e| format!("Failed to read MP4 tags: {}", e))?;

                if let Some(a) = artist {
                    tag.set_artist(a);
                }
                if let Some(t) = title {
                    tag.set_title(t);
                }
                if let Some(alb) = album {
                    tag.set_album(alb);
                }

                tag.write_to_path(path)
                    .map_err(|e| format!("Failed to write MP4 tags: {}", e))?;

                Ok(())
            }
            "flac" | "wav" | "ogg" => {
                use lofty::{Accessor, Probe, TagExt, TaggedFileExt};

                let mut tagged_file = Probe::open(path)
                    .map_err(|e| format!("Failed to open file: {}", e))?
                    .read()
                    .map_err(|e| format!("Failed to read tags: {}", e))?;

                let tag = match tagged_file.primary_tag_mut() {
                    Some(primary_tag) => primary_tag,
                    None => {
                        // If no tag, create one based on file type
                        let tag_type = tagged_file.file_type().primary_tag_type();
                        tagged_file.insert_tag(lofty::Tag::new(tag_type));
                        tagged_file.primary_tag_mut().unwrap()
                    }
                };

                if let Some(a) = artist {
                    tag.set_artist(a);
                }
                if let Some(t) = title {
                    tag.set_title(t);
                }
                if let Some(alb) = album {
                    tag.set_album(alb);
                }

                tag.save_to_path(path)
                    .map_err(|e| format!("Failed to save tags: {}", e))?;

                Ok(())
            }
            _ => Err(format!(
                "Metadata editing not supported for .{} files",
                extension
            )),
        }
    })
    .await;

    match result {
        Ok(inner_res) => inner_res,
        Err(e) => Err(format!("Task failed to execute: {}", e)),
    }
}

// New struct for detailed file info
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct AudioFileInfo {
    pub path: String,
    pub filename: String,
    pub size_bytes: u64,
    // Audio props
    pub duration: f64,
    pub format: String,
    pub codec: String,
    pub bitrate: Option<u32>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
    pub bit_depth: Option<u32>,
    // Metadata
    pub artist: Option<String>,
    pub title: Option<String>,
    pub album: Option<String>,
    pub cover_image: Option<String>,
}

#[tauri::command]
pub async fn get_audio_file_info(file_path: String) -> Result<AudioFileInfo, String> {
    let result = tauri::async_runtime::spawn(async move {
        let path = Path::new(&file_path);

        if !path.exists() {
            return Err("File not found".to_string());
        }

        let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
        let size_bytes = metadata.len();
        let filename = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // Use Symphonia to probe for detailed audio info
        let source = File::open(path).map_err(|e| e.to_string())?;
        let mss = MediaSourceStream::new(Box::new(source), Default::default());
        let mut hint = Hint::new();
        if let Some(extension) = path.extension().and_then(|s| s.to_str()) {
            hint.with_extension(extension);
        }

        let probed = symphonia::default::get_probe()
            .format(&hint, mss, &Default::default(), &Default::default())
            .map_err(|e| format!("Failed to probe: {}", e))?;

        let mut codec = "Unknown".to_string();
        let mut sample_rate = None;
        let mut channels = None;
        let mut bit_depth = None;
        let mut duration = 0.0;

        // Get track info
        if let Some(track) = probed.format.default_track() {
            codec = format!("{:?}", track.codec_params.codec);
            sample_rate = track.codec_params.sample_rate;
            channels = track.codec_params.channels.map(|c| c.count() as u32);
            bit_depth = track.codec_params.bits_per_sample;

            if let (Some(n_frames), Some(sr)) =
                (track.codec_params.n_frames, track.codec_params.sample_rate)
            {
                if n_frames > 0 && sr > 0 {
                    duration = n_frames as f64 / sr as f64;
                }
            }
        }

        // Reuse existing metadata extraction logic (simplified here for brevity, or we can call the helper)
        // For this detailed view, we can just use the values we already have or re-extract
        // Let's re-use the helpers we defined earlier for consistency
        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        let (mut artist, mut title, mut album, _, mut cover_image) = match extension.as_str() {
            "mp3" => try_id3_metadata(path),
            "m4a" | "mp4" | "aac" => try_mp4_metadata(path),
            _ => try_symphonia_metadata(path, false),
        };

        // Fallback to symphonia if specific readers failed
        if artist.is_none() || title.is_none() || album.is_none() || cover_image.is_none() {
            let (sym_artist, sym_title, sym_album, _, sym_cover) =
                try_symphonia_metadata(path, false);
            if artist.is_none() {
                artist = sym_artist;
            }
            if title.is_none() {
                title = sym_title;
            }
            if album.is_none() {
                album = sym_album;
            }
            if cover_image.is_none() {
                cover_image = sym_cover;
            }
        }

        Ok(AudioFileInfo {
            path: file_path,
            filename,
            size_bytes,
            duration,
            format: extension.to_uppercase(),
            codec,
            bitrate: None, // Symphonia doesn't always give bitrate easily without decoding, leaving as None for now or we could calculate from size/duration
            sample_rate,
            channels,
            bit_depth,
            artist,
            title,
            album,
            cover_image,
        })
    })
    .await;

    match result {
        Ok(inner_res) => inner_res,
        Err(e) => Err(format!("Task failed to execute: {}", e)),
    }
}

#[tauri::command]
pub async fn check_file_exists(file_path: String) -> Result<bool, String> {
    Ok(Path::new(&file_path).exists())
}
