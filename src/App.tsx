import React, { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
// import { convertFileSrc } from "@tauri-apps/api/core";

// Components
import Home from "./components/Home";
import SavePlaylistModal from "./components/SavePlaylistModal";
import TopBar from "./components/TopBar";
import PlayerBar from "./components/PlayerBar";
import QueueView from "./components/QueueView";
import VisualizerView from "./components/VisualizerView";
import DragDropOverlay from "./components/DragDropOverlay";
import PlaylistDetailView from "./components/PlaylistDetailView";
import TitleBar from "./components/TitleBar";

// Audio Engine
import { AudioEngine } from "./audioEngine";

// Types
import { Track, RawMetadata, RepeatMode, Tab, VisualizerStyle } from "./types";

const MusicPlayer: React.FC = () => {
  // Refs
  const engineRef = useRef<AudioEngine | null>(null);

  // State
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(
    null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("none");
  const [, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [visualizerStyle, setVisualizerStyle] =
    useState<VisualizerStyle>("mirror");
  const [isDragging, setIsDragging] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [viewingPlaylist, setViewingPlaylist] = useState<string | null>(null);
  const [showFps, setShowFps] = useState(false);
  // Add gapless toggle state (default true, safety check handles large files)
  const [enableGapless, setEnableGapless] = useState(true);

  const currentTrack =
    currentTrackIndex !== null ? queue[currentTrackIndex] : null;

  // --- Initialize Engine ---
  useEffect(() => {
    engineRef.current = new AudioEngine();
    return () => {
      engineRef.current?.stop();
    };
  }, []);

  // --- Queue Management ---

  const processPaths = useCallback(
    async (paths: string[]) => {
      const audioExtensions = [".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"];
      const validPaths = paths.filter((path) =>
        audioExtensions.some((ext) => path.toLowerCase().endsWith(ext))
      );

      if (validPaths.length === 0) return;

      setIsLoading(true);

      // 1. Create initial track objects immediately so UI updates fast
      const newTracks: Track[] = validPaths.map((path) => ({
        id: `${Date.now()}-${Math.random()}`,
        path,
        filename: path.split(/[/\\]/).pop() || "Unknown",
        duration: 0,
        artist: "Loading...",
        title:
          path
            .split(/[/\\]/)
            .pop()
            ?.replace(/\.[^/.]+$/, "") || "Unknown",
        album: "Loading...",
        metadataLoaded: false,
      }));

      // Add to queue immediately
      setQueue((prev) => [...prev, ...newTracks]);

      // 2. Fetch metadata in parallel batches to maximize throughput
      // We process all of them in parallel, letting the OS/Rust backend handle the threading
      const metadataPromises = newTracks.map(async (track) => {
        try {
          const metadata = await invoke<RawMetadata>("get_audio_metadata", {
            filePath: track.path,
            enableGapless: enableGapless,
          });
          return { trackId: track.id, metadata, success: true };
        } catch (e) {
          console.error(`Metadata error for ${track.path}:`, e);
          return { trackId: track.id, success: false };
        }
      });

      // Wait for all metadata to load
      const results = await Promise.all(metadataPromises);

      // 3. Update queue with all loaded metadata at once (batch update)
      setQueue((prev) => {
        const updates = new Map(results.map((r) => [r.trackId, r]));

        return prev.map((t) => {
          const update = updates.get(t.id);
          if (update && update.success && update.metadata) {
            return {
              ...t,
              metadataLoaded: true,
              artist: update.metadata.artist || "Unknown Artist",
              title: update.metadata.title || t.title,
              album: update.metadata.album || "Unknown Album",
              duration: update.metadata.duration || 0,
            };
          } else if (update && !update.success) {
            return { ...t, metadataLoaded: true };
          }
          return t;
        });
      });

      if (queue.length === 0 && newTracks.length > 0) {
        setCurrentTrackIndex(0);
        setIsPlaying(true);
      }

      setIsLoading(false);
    },
    [queue.length, enableGapless]
  );

  const addFiles = useCallback(async () => {
    try {
      const selectedPaths = await open({
        multiple: true,
        title: "Add Music Files",
        filters: [
          {
            name: "Audio",
            extensions: ["mp3", "wav", "ogg", "flac", "aac", "m4a"],
          },
        ],
      });

      if (!selectedPaths) return;

      const paths = Array.isArray(selectedPaths)
        ? selectedPaths
        : [selectedPaths];
      await processPaths(paths);
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  }, [processPaths]);

  const updateTrackMetadata = useCallback(
    async (trackPath: string, artist: string, title: string, album: string) => {
      try {
        // Call backend to update metadata
        await invoke("update_metadata", {
          filePath: trackPath,
          artist: artist || null,
          title: title || null,
          album: album || null,
        });

        // Update the track in the queue
        setQueue((prev) =>
          prev.map((t) => {
            if (t.path === trackPath) {
              return {
                ...t,
                artist: artist || "Unknown Artist",
                title: title || "Unknown",
                album: album || "Unknown Album",
              };
            }
            return t;
          })
        );

        return true;
      } catch (error) {
        console.error("Failed to update metadata:", error);
        throw error;
      }
    },
    []
  );

  // Drag & Drop Listeners
  useEffect(() => {
    const unlistenDrop = listen("tauri://drag-drop", (event) => {
      setIsDragging(false);
      const payload = event.payload as { paths: string[] };
      if (payload.paths && payload.paths.length > 0) {
        processPaths(payload.paths);
      }
    });

    const unlistenEnter = listen("tauri://drag-enter", () => {
      setIsDragging(true);
    });

    const unlistenLeave = listen("tauri://drag-leave", () => {
      setIsDragging(false);
    });

    return () => {
      unlistenDrop.then((f) => f());
      unlistenEnter.then((f) => f());
      unlistenLeave.then((f) => f());
    };
  }, [processPaths]);

  // --- Playlist Management ---

  const handleSavePlaylist = async (name: string) => {
    try {
      const tracksToSave = queue.map((t) => ({
        path: t.path,
        filename: t.filename,
        duration: isFinite(t.duration) ? t.duration : 0,
        artist: t.artist === "Unknown Artist" ? null : t.artist,
        title: t.title === "Unknown" ? null : t.title,
        album: t.album === "Unknown Album" ? null : t.album,
      }));

      await invoke("save_playlist", { name, tracks: tracksToSave });
      alert(`Playlist "${name}" saved!`);
      setIsSaveModalOpen(false);
    } catch (e) {
      console.error("Failed to save playlist:", e);
      alert("Failed to save playlist: " + e);
    }
  };

  const openSaveModal = () => {
    if (queue.length === 0) return;
    setIsSaveModalOpen(true);
  };

  const playPlaylist = async (name: string) => {
    try {
      setIsLoading(true);
      // Stop current playback immediately and clear state
      if (engineRef.current) {
        engineRef.current.reset();
      }
      setIsPlaying(false);
      setCurrentTrackIndex(null); // Reset index to force a change detection later

      const playlist = await invoke<any>("load_playlist", { name });
      const tracks = playlist.tracks;

      const newTracks: Track[] = tracks.map((t: any) => ({
        id: `${Date.now()}-${Math.random()}`,
        path: t.path,
        filename: t.filename,
        duration: t.duration,
        artist: t.artist || "Unknown Artist",
        title: t.title || "Unknown",
        album: t.album || "Unknown Album",
        metadataLoaded: true,
      }));

      setQueue(newTracks);

      // Small timeout to allow state to settle before starting
      setTimeout(() => {
        setCurrentTrackIndex(0);
        setIsPlaying(true);
        setActiveTab("queue");
      }, 50);
    } catch (e) {
      console.error("❌ Failed to load playlist:", e);
      alert("Failed to load playlist: " + e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPlaylist = (name: string) => {
    setViewingPlaylist(name);
    setActiveTab("playlist");
  };

  // --- Playback Control ---

  const playTrack = (index: number) => {
    if (currentTrackIndex === index) {
      // If clicking the same track, just toggle play/pause
      togglePlayPause();
    } else {
      setCurrentTrackIndex(index);
      setIsPlaying(true);
    }
  };

  const togglePlayPause = () => {
    if (!currentTrack && queue.length > 0) {
      playTrack(0);
    } else {
      setIsPlaying((p) => !p);
    }
  };

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIndex = 0;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex =
        currentTrackIndex === null || currentTrackIndex === queue.length - 1
          ? 0
          : currentTrackIndex + 1;
    }
    setCurrentTrackIndex(nextIndex);
  }, [queue.length, currentTrackIndex, shuffle]);

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return;
    if (currentTime > 3) {
      if (engineRef.current) engineRef.current.seek(0);
      return;
    }
    const prevIndex =
      !currentTrackIndex || currentTrackIndex === 0
        ? queue.length - 1
        : currentTrackIndex - 1;
    setCurrentTrackIndex(prevIndex);
  }, [queue.length, currentTrackIndex, currentTime]);

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (engineRef.current) engineRef.current.seek(time);
  };

  const reorderQueue = (oldIndex: number, newIndex: number) => {
    setQueue((items) => {
      const newQueue = [...items];
      const [movedItem] = newQueue.splice(oldIndex, 1);
      newQueue.splice(newIndex, 0, movedItem);
      return newQueue;
    });

    if (currentTrackIndex !== null) {
      if (currentTrackIndex === oldIndex) {
        setCurrentTrackIndex(newIndex);
      } else if (
        currentTrackIndex > oldIndex &&
        currentTrackIndex <= newIndex
      ) {
        setCurrentTrackIndex(currentTrackIndex - 1);
      } else if (
        currentTrackIndex < oldIndex &&
        currentTrackIndex >= newIndex
      ) {
        setCurrentTrackIndex(currentTrackIndex + 1);
      }
    }
  };

  const removeFromQueue = (index: number) => {
    setQueue((q) => q.filter((_, idx) => idx !== index));

    // Update currentTrackIndex to prevent invalid references
    if (currentTrackIndex !== null) {
      if (index === currentTrackIndex) {
        // Removing the currently playing track - stop playback
        if (engineRef.current) {
          engineRef.current.stop();
        }
        setIsPlaying(false);
        // Move to next track if available, otherwise clear
        if (queue.length > 1) {
          setCurrentTrackIndex(index >= queue.length - 1 ? 0 : index);
        } else {
          setCurrentTrackIndex(null);
        }
      } else if (index < currentTrackIndex) {
        // Removed a track before the current one - shift index down
        setCurrentTrackIndex(currentTrackIndex - 1);
      }
      // If index > currentTrackIndex, no change needed
    }
  };

  // --- Audio Engine Effects ---

  // Handle Track Change
  useEffect(() => {
    const loadAndPlay = async () => {
      const engine = engineRef.current;
      if (!engine || !currentTrack) return;

      // Check if engine is ALREADY playing this track (from internal auto-switch)
      // We can infer this if the engine is playing and we didn't just manually change tracks
      // A robust way is to check if the engine's current buffer matches what we expect,
      // but since we don't expose that, we can trust the internal switch logic.

      // If the engine successfully auto-switched, we don't need to do anything
      // except update duration.

      // Try to "claim" the preloaded track if it hasn't been claimed yet
      const wasPreloaded = engine.playNext(currentTrack.path);

      if (!wasPreloaded) {
        // If playNext returned false, it means either:
        // 1. There was no preloaded track
        // 2. The preloaded track didn't match
        // 3. OR (Crucially) The engine ALREADY switched to it internally!

        // We need a way to know if we should load from scratch.
        // For now, we'll assume if we are playing and the time is near 0, we might be good.
        // But safer is to just force load if we aren't sure.

        // To fix the "stutter" on auto-switch:
        // When auto-switch happens, engine plays next track -> onEnded fires -> React sets new index -> this effect runs.
        // Inside engine, `nextBuffer` is nullified after playing. So `playNext` returns false.
        // So we fall through to here and RELOAD the track that is already playing!

        // FIX: We need to know if the engine is already playing the correct file.
        // We now use activeTrackPath to verify this definitively.
        if (
          engine.activeTrackPath === currentTrack.path &&
          (engine.currentTime < 2.0 || isPlaying)
        ) {
          // Already playing the correct track (auto-switched).
          // We add a small time check (< 2.0s) to ensure we don't accidentally
          // match a track that was fully played and stopped, although activeTrackPath
          // should handle most cases.
          // Actually, activeTrackPath is sufficient if we trust the engine state.
          console.log("🚀 Auto-switch detected, syncing state...");
          if (isPlaying) engine.play();
        } else {
          try {
            engine.stop();
            const loaded = await engine.loadTrack(currentTrack.path);
            if (loaded && isPlaying) engine.play();
          } catch (e) {
            console.error("Failed to load track:", e);
            setIsPlaying(false);
          }
        }
      }

      if (currentTrack.duration > 0) {
        setDuration(currentTrack.duration);
      } else {
        setDuration(engine.duration || 0);
      }

      // Set up onEnded callback
      engine.setOnEnded(() => {
        if (repeat === "one") {
          engine.seek(0);
          engine.play();
        } else {
          playNext();
        }
      });
    };

    loadAndPlay();
  }, [currentTrack]); // Intentionally not including isPlaying to avoid re-loading

  // Handle Play/Pause
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (isPlaying) {
      engine.play();
    } else {
      engine.pause();
    }
  }, [isPlaying]);

  // Handle Volume/Mute
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setVolume(volume);
    engine.setMute(isMuted);
  }, [volume, isMuted]);

  // Preload Next Track
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || queue.length === 0 || currentTrackIndex === null) return;

    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeat === "all") nextIndex = 0;
      else return;
    }

    const nextTrack = queue[nextIndex];
    if (nextTrack) {
      engine.preloadNextTrack(nextTrack.path);
    }
  }, [queue, currentTrackIndex, repeat]);

  // Time Update Polling
  useEffect(() => {
    const interval = setInterval(() => {
      if (engineRef.current && isPlaying) {
        setCurrentTime(engineRef.current.currentTime);
        // Also update duration if it wasn't valid initially or is different (e.g. VBR)
        // But prefer metadata duration if we have it to avoid "0" jumps
        if (
          engineRef.current.duration > 0 &&
          Math.abs(engineRef.current.duration - duration) > 1
        ) {
          setDuration(engineRef.current.duration);
        }
      }
    }, 100); // Poll every 100ms
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === "ArrowRight") playNext();
      else if (e.code === "ArrowLeft") playPrevious();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [togglePlayPause, playNext, playPrevious]);

  // --- Global Shortcuts ---
  const handlersRef = useRef({
    playNext,
    playPrevious,
    togglePlayPause,
  });

  useEffect(() => {
    handlersRef.current = {
      playNext,
      playPrevious,
      togglePlayPause,
    };
  }, [playNext, playPrevious, togglePlayPause]);

  useEffect(() => {
    const setupShortcuts = async () => {
      try {
        await unregisterAll();

        await register("MediaPlayPause", (event) => {
          if (event.state === "Pressed") {
            handlersRef.current.togglePlayPause();
          }
        });
        await register("MediaTrackNext", (event) => {
          if (event.state === "Pressed") {
            handlersRef.current.playNext();
          }
        });
        await register("MediaTrackPrevious", (event) => {
          if (event.state === "Pressed") {
            handlersRef.current.playPrevious();
          }
        });
        console.log("Global shortcuts registered");
      } catch (error) {
        console.error("Failed to register global shortcuts:", error);
      }
    };

    setupShortcuts();

    return () => {
      unregisterAll();
    };
  }, []);

  return (
    <div className="h-screen w-screen bg-gray-950 text-white flex flex-col overflow-hidden selection:bg-cyan-500/30 pt-8">
      <TitleBar />

      {/* Top Bar */}
      <TopBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        visualizerStyle={visualizerStyle}
        setVisualizerStyle={setVisualizerStyle}
        addFiles={addFiles}
        onVisualizerClick={() => {}}
        showFps={showFps}
        setShowFps={setShowFps}
        enableGapless={enableGapless}
        setEnableGapless={setEnableGapless}
      />

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Visualizer Layer */}
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            activeTab === "visualizer" ? "opacity-100 z-10" : "opacity-0 -z-10"
          }`}
        >
          <VisualizerView
            analyser={engineRef.current?.analyserNode || null}
            visualizerStyle={visualizerStyle}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            showFps={showFps}
          />
        </div>

        {/* Home Layer */}
        <div
          className={`absolute inset-0 overflow-hidden bg-gray-950 transition-opacity duration-300 ${
            activeTab === "home" ? "opacity-100 z-10" : "opacity-0 -z-10"
          }`}
        >
          {activeTab === "home" && (
            <Home
              onPlayPlaylist={playPlaylist}
              onViewPlaylist={handleViewPlaylist}
            />
          )}
        </div>

        {/* Playlist Detail Layer */}
        <div
          className={`absolute inset-0 overflow-hidden bg-gray-950 transition-opacity duration-300 ${
            activeTab === "playlist" ? "opacity-100 z-10" : "opacity-0 -z-10"
          }`}
        >
          {activeTab === "playlist" && viewingPlaylist && (
            <PlaylistDetailView
              playlistName={viewingPlaylist}
              onPlay={() => playPlaylist(viewingPlaylist)}
              onBack={() => setActiveTab("home")}
              onRename={(newName) => setViewingPlaylist(newName)}
            />
          )}
        </div>

        {/* Queue Layer */}
        <div
          className={`absolute inset-0 overflow-hidden flex flex-col bg-gray-950 transition-opacity duration-300 ${
            activeTab === "queue" ? "opacity-100 z-10" : "opacity-0 -z-10"
          }`}
        >
          <QueueView
            queue={queue}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            playTrack={playTrack}
            removeFromQueue={removeFromQueue}
            reorderQueue={reorderQueue}
            openSaveModal={openSaveModal}
            addFiles={addFiles}
            searchQuery={searchQuery}
            updateTrackMetadata={updateTrackMetadata}
          />
        </div>
      </div>

      {/* Player Bar */}
      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        togglePlayPause={togglePlayPause}
        playNext={playNext}
        playPrevious={playPrevious}
        shuffle={shuffle}
        setShuffle={setShuffle}
        repeat={repeat}
        setRepeat={setRepeat}
        currentTime={currentTime}
        duration={duration}
        setCurrentTime={setCurrentTime}
        onSeek={handleSeek}
        volume={volume}
        setVolume={setVolume}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
      />

      {/* Drag & Drop Overlay */}
      <DragDropOverlay isDragging={isDragging} />

      {/* Save Playlist Modal */}
      <SavePlaylistModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSavePlaylist}
      />
    </div>
  );
};

export default MusicPlayer;
