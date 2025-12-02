import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Loader2, RefreshCw, Music } from "lucide-react";
import PlaylistCard from "./PlaylistCard";
import { PlaylistSummary } from "../types";

interface HomeProps {
  onPlayPlaylist: (name: string) => void;
  onViewPlaylist: (name: string) => void;
}

const Home: React.FC<HomeProps> = ({ onPlayPlaylist, onViewPlaylist }) => {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const loadedPlaylists = await invoke<PlaylistSummary[]>("get_playlists");
      setPlaylists(loadedPlaylists);
    } catch (e) {
      console.error("Failed to load playlists:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, []);

  const handleDelete = async (name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await invoke("delete_playlist", { name });
        loadPlaylists();
      } catch (e) {
        console.error("Failed to delete playlist:", e);
      }
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="p-8 pb-32 overflow-y-auto h-full bg-gradient-to-b from-gray-900 via-gray-900 to-black">
      {/* Hero Section */}
      <div className="mb-12 flex flex-col md:flex-row items-start md:items-end gap-6 border-b border-white/5 pb-10">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/20 ring-1 ring-white/10">
          <Music size={40} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">
            {getGreeting()}
          </h1>
          <p className="text-gray-400 text-lg font-medium">
            Your personal music library
          </p>
        </div>
      </div>

      {/* Playlists Section */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            Your Playlists
            <span className="text-sm font-normal text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
              {playlists.length}
            </span>
          </h2>
          <button
            onClick={loadPlaylists}
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95"
            title="Refresh Playlists"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="animate-spin text-cyan-500" size={40} />
            <p className="text-gray-500 text-sm">Loading your collection...</p>
          </div>
        ) : playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 rounded-2xl border-dashed">
            <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6 ring-1 ring-white/10">
              <Plus size={32} className="text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              No playlists yet
            </h3>
            <p className="text-gray-400 mb-8 max-w-sm text-center">
              Start by adding songs to your queue and saving them as a playlist.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.name}
                name={playlist.name}
                trackCount={playlist.track_count}
                coverImage={playlist.cover_image}
                onPlay={() => onPlayPlaylist(playlist.name)}
                onView={() => onViewPlaylist(playlist.name)}
                onDelete={() => handleDelete(playlist.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
