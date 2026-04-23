import React, { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Plus, Loader2, RefreshCw, Music, FolderUp } from "lucide-react";
import PlaylistCard from "./PlaylistCard";
import { PlaylistSummary } from "../types";

interface HomeProps {
  onPlayPlaylist: (name: string) => void;
  onViewPlaylist: (name: string) => void;
  searchQuery: string;
}

const PAGE_SIZE = 50;

const Home: React.FC<HomeProps> = ({ onPlayPlaylist, onViewPlaylist, searchQuery }) => {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "tracks">("name");
  
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerTarget = useRef<HTMLDivElement>(null);

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

  const allTags = useMemo(() => {
    return Array.from(new Set(playlists.flatMap(p => p.tags || []))).sort();
  }, [playlists]);

  const filteredAndSortedPlaylists = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return playlists
      .filter(p => !selectedTag || p.tags?.includes(selectedTag))
      .filter(p => !query || p.name.toLowerCase().includes(query) || p.tags?.some(tag => tag.toLowerCase().includes(query)))
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "tracks") return b.track_count - a.track_count;
        return 0;
      });
  }, [playlists, selectedTag, searchQuery, sortBy]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedTag, searchQuery, sortBy]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + PAGE_SIZE);
        }
      },
      { threshold: 0.1 }
    );
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => observer.disconnect();
  }, []);

  const handleImportFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Folder to Import as Playlist",
      });

      if (selected && typeof selected === "string") {
        setLoading(true);
        await invoke("import_folder_as_playlist", { folderPath: selected });
        await loadPlaylists();
      }
    } catch (e) {
      console.error("Failed to import folder:", e);
      alert("Failed to import folder: " + e);
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
        <div className="flex-1 text-glow text-cyan-500/20">
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
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              Your Playlists
              <span className="text-sm font-normal text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                {filteredAndSortedPlaylists.length}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white/5 border border-white/10 rounded-full py-1.5 px-4 text-sm text-gray-400 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer hover:bg-white/10 transition-all font-medium"
              >
                <option value="name">Sort by Name</option>
                <option value="tracks">Sort by Tracks</option>
              </select>
              <button
                onClick={handleImportFolder}
                className="flex items-center gap-2 px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all active:scale-95 border border-white/10 text-sm font-medium"
              >
                <FolderUp size={18} className="text-cyan-400" />
                Import Folder
              </button>
              <button
                onClick={loadPlaylists}
                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95"
                title="Refresh Playlists"
              >
                <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Tags Cloud */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2 py-4 border-y border-white/5">
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  selectedTag === null
                    ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/30"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                All Playlists
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    selectedTag === tag
                      ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/30"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="animate-spin text-cyan-500" size={40} />
            <p className="text-gray-500 text-sm">Loading your collection...</p>
          </div>
        ) : filteredAndSortedPlaylists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 rounded-2xl border-dashed">
            <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6 ring-1 ring-white/10">
              <Plus size={32} className="text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {selectedTag ? `No playlists tagged with "${selectedTag}"` : "No playlists yet"}
            </h3>
            <p className="text-gray-400 mb-8 max-w-sm text-center">
              {selectedTag ? "Try exploring other categories or clear the filter." : "Start by adding songs to your queue and saving them as a playlist."}
            </p>
            {selectedTag && (
               <button
               onClick={() => setSelectedTag(null)}
               className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full text-sm font-bold transition-all"
             >
               Clear Filters
             </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
              {filteredAndSortedPlaylists.slice(0, visibleCount).map((playlist) => (
                <PlaylistCard
                  key={playlist.name}
                  name={playlist.name}
                  trackCount={playlist.track_count}
                  coverImage={playlist.cover_image}
                  tags={playlist.tags}
                  onPlay={() => onPlayPlaylist(playlist.name)}
                  onView={() => onViewPlaylist(playlist.name)}
                  onDelete={() => handleDelete(playlist.name)}
                />
              ))}
            </div>
            {visibleCount < filteredAndSortedPlaylists.length && (
              <div ref={observerTarget} className="h-20 flex items-center justify-center mt-8">
                <Loader2 className="animate-spin text-cyan-500/50" size={24} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Home;
