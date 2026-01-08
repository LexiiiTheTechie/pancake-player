import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

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
import SettingsModal from "./components/SettingsModal";

// Contexts
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";

// Hooks
import { useQueue } from "./hooks/useQueue";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

// Types
import { Track, Tab } from "./types";

const AppContent: React.FC = () => {
  const { settings, currentStyle, setCurrentStyle } = useSettings();

  // --- UI State ---
  const [activeTab, setActiveTab] = useState<Tab>("home");

  // Settings driven state
  const { enableGapless } = settings.audio;

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [viewingPlaylist, setViewingPlaylist] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- Hook Integration ---

  // 1. Queue Logic
  const {
    queue,
    setQueue,
    currentTrack,
    currentTrackIndex,
    setCurrentTrackIndex,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
    isDragging,
    searchQuery,
    setSearchQuery,
    addFiles,
    reorderQueue,
    removeFromQueue,
    clearQueue,
    updateTrackMetadata,
    setupDragDrop,
  } = useQueue({ enableGapless });

  // 2. Audio Logic
  const {
    engineRef,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    playTrack,
    playNext,
    playPrevious,
    togglePlayPause,
    handleSeek,
    seekBy,
  } = useAudioPlayer({
    queue,
    currentTrackIndex,
    setCurrentTrackIndex,
    repeat,
    shuffle,
    enableGapless,
  });

  const handleClearQueue = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.reset();
    }
    setIsPlaying(false);
    clearQueue();
  }, [clearQueue, setIsPlaying, engineRef]);

  // 3. Shortcuts
  useGlobalShortcuts({ playNext, playPrevious, togglePlayPause });
  useKeyboardShortcuts({ playNext, playPrevious, togglePlayPause, seekBy });

  // 4. Drag & Drop Setup
  useEffect(() => {
    const unlisten = setupDragDrop();
    return () => {
      unlisten(); // Clean up listeners
    };
  }, [setupDragDrop]);

  // 5. Discord Rich Presence via Node.js Bridge
  useEffect(() => {
    const updatePresence = async () => {
      console.log("🎵 Discord Presence Update:", {
        enabled: settings.presence.enableRichPresence,
        track: currentTrack?.title,
        index: currentTrackIndex,
        isPlaying,
      });

      try {
        if (settings.presence.enableRichPresence && currentTrack) {
          await fetch("http://127.0.0.1:33333", {
            method: "POST",
            body: JSON.stringify({
              title: currentTrack.title,
              artist: currentTrack.artist,
              isPlaying: isPlaying,
              startTime: Math.floor(Date.now() / 1000),
            }),
          });
        } else {
          await fetch("http://127.0.0.1:33333", {
            method: "POST",
            body: JSON.stringify({ isPlaying: false, title: "" }),
          });
        }
      } catch (err) {
        // Silently fail if bridge isn't running
      }
    };

    updatePresence();
  }, [
    currentTrack?.path,
    currentTrackIndex,
    isPlaying,
    settings.presence.enableRichPresence,
  ]);

  // --- Playlist Logic (Still in App.tsx for now as it bridges UI and state) ---

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
    }
  };

  const handleViewPlaylist = (name: string) => {
    setViewingPlaylist(name);
    setActiveTab("playlist");
  };

  return (
    <div className="h-screen w-screen bg-gray-950 text-white flex flex-col overflow-hidden selection:bg-cyan-500/30 pt-8">
      <TitleBar />

      {/* Top Bar */}
      <TopBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        visualizerStyle={currentStyle}
        setVisualizerStyle={setCurrentStyle}
        addFiles={addFiles}
        onVisualizerClick={() => {}}
        onSettingsClick={() => setIsSettingsOpen(true)}
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
            channels={engineRef.current?.channels}
            visualizerStyle={currentStyle}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
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
            clearQueue={handleClearQueue}
            searchQuery={searchQuery}
            updateTrackMetadata={updateTrackMetadata}
          />
        </div>

        {/* Sidebar Settings */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
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
        onSeekBy={seekBy}
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

const MusicPlayer: React.FC = () => {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
};

export default MusicPlayer;
