import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Plus, Loader2, RefreshCw, Music, FolderUp, Star, ChevronDown, ChevronUp } from "lucide-react";
import PlaylistCard from "./PlaylistCard";
import TagContextMenu from "./TagContextMenu";
import { PlaylistSummary } from "../types";

interface HomeProps {
  playlists: PlaylistSummary[];
  favouriteTags: Set<string>;
  onToggleFavourite: (tag: string) => void;
  onRefresh: () => void;
  onPlayPlaylist: (name: string) => void;
  onViewPlaylist: (name: string) => void;
  onDeletePlaylist: (name: string) => void;
  searchQuery: string;
}

const PAGE_SIZE = 50;

interface TagMenu {
  x: number;
  y: number;
  tag: string;
}

const Home: React.FC<HomeProps> = ({ playlists, favouriteTags, onToggleFavourite, onRefresh, onPlayPlaylist, onViewPlaylist, onDeletePlaylist, searchQuery }) => {
  const [loading, setLoading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "tracks">("name");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [tagMenu, setTagMenu] = useState<TagMenu | null>(null);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);

  const observerTarget = useRef<HTMLDivElement>(null);
  
  // Defer the search query to prevent laggy typing
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const allTags = useMemo(() => {
    return Array.from(new Set(playlists.flatMap(p => p.tags || []))).sort();
  }, [playlists]);

  // Split tags into favourites (shown at top) and the rest
  const { favouriteTagList, regularTagList } = useMemo(() => {
    const favouriteTagList = allTags.filter(t => favouriteTags.has(t));
    const regularTagList = allTags.filter(t => !favouriteTags.has(t));
    return { favouriteTagList, regularTagList };
  }, [allTags, favouriteTags]);

  const filteredAndSortedPlaylists = useMemo(() => {
    const query = deferredSearchQuery.toLowerCase().trim();
    return playlists
      .filter(p => !selectedTag || p.tags?.includes(selectedTag))
      .filter(p => !query || p.name.toLowerCase().includes(query) || p.tags?.some(tag => tag.toLowerCase().includes(query)))
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "tracks") return b.track_count - a.track_count;
        return 0;
      });
  }, [playlists, selectedTag, deferredSearchQuery, sortBy]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedTag, deferredSearchQuery, sortBy]);

  // Infinite scroll observer — re-attach when list changes so sentinel re-attaches correctly
  useEffect(() => {
    const el = observerTarget.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + PAGE_SIZE);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredAndSortedPlaylists]);

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
        onRefresh();
      }
    } catch (e) {
      console.error("Failed to import folder:", e);
      alert("Failed to import folder: " + e);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const handleTagContextMenu = useCallback((e: React.MouseEvent, tag: string) => {
    e.preventDefault();
    e.stopPropagation();
    setTagMenu({ x: e.clientX, y: e.clientY, tag });
  }, []);

  const tagButtonClass = (active: boolean, isFav?: boolean) =>
    `px-4 py-1.5 rounded-full text-xs font-bold transition-all select-none ${
      active
        ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/30"
        : isFav
        ? "bg-yellow-500/10 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/20 hover:text-yellow-200"
        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5"
    }`;

  return (
    <div className="p-8 pb-32 overflow-y-auto h-full bg-gradient-to-b from-gray-900 via-gray-900 to-black">
      {/* Hero */}
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

      {/* All Playlists Section */}
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
                onClick={onRefresh}
                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95"
                title="Refresh Playlists"
              >
                <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Tags Cloud */}
          {allTags.length > 0 && (
            <div className="py-4 border-y border-white/5 flex flex-col gap-4">
              <div 
                className="flex items-center justify-between cursor-pointer group/tag-header select-none"
                onClick={() => setIsTagsExpanded(!isTagsExpanded)}
              >
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500 group-hover/tag-header:text-gray-300 transition-colors">
                  Filter by Tags
                </span>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 group-hover/tag-header:text-cyan-300 transition-colors">
                  <ChevronDown 
                    size={16} 
                    className={`transition-transform duration-500 ease-out ${isTagsExpanded ? 'rotate-180' : 'rotate-0'}`} 
                  />
                  {isTagsExpanded ? "Show Less" : "Show All"}
                </div>
              </div>
              
              <div className={`relative flex flex-wrap gap-2 transition-[max-height] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[max-height] ${isTagsExpanded ? "max-h-[1000px] pb-4" : "max-h-[84px] overflow-hidden"}`}>
                <button
                  onClick={() => setSelectedTag(null)}
                  className={tagButtonClass(selectedTag === null)}
                >
                  All Playlists
                </button>

                {/* Favourite tags first — gold styling */}
                {favouriteTagList.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    onContextMenu={(e) => handleTagContextMenu(e, tag)}
                    className={tagButtonClass(selectedTag === tag, true)}
                    title="Right-click to manage favourites"
                  >
                    ★ {tag}
                  </button>
                ))}

                {/* Divider */}
                {favouriteTagList.length > 0 && regularTagList.length > 0 && (
                  <div className="w-px h-6 bg-white/10 self-center mx-1" />
                )}

                {regularTagList.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    onContextMenu={(e) => handleTagContextMenu(e, tag)}
                    className={tagButtonClass(selectedTag === tag)}
                    title="Right-click to manage favourites"
                  >
                    {tag}
                  </button>
                ))}

                {/* Smooth blur fade for the collapsed state */}
                <div 
                  className={`absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-gray-900 via-gray-900/95 to-transparent pointer-events-none backdrop-blur-[2px] z-10 transition-all duration-500 ease-in-out ${isTagsExpanded ? 'opacity-0 invisible' : 'opacity-100 visible'}`} 
                />
              </div>
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
              {selectedTag
                ? "Try exploring other categories or clear the filter."
                : "Start by adding songs to your queue and saving them as a playlist."}
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 will-change-transform">
              {filteredAndSortedPlaylists.slice(0, visibleCount).map((playlist, idx) => (
                <PlaylistCard
                  key={`${playlist.name}-${idx}`}
                  name={playlist.name}
                  trackCount={playlist.track_count}
                  coverImage={playlist.cover_image}
                  tags={playlist.tags}
                  onPlay={() => onPlayPlaylist(playlist.name)}
                  onView={() => onViewPlaylist(playlist.name)}
                  onDelete={() => onDeletePlaylist(playlist.name)}
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

      {/* Tag right-click context menu */}
      {tagMenu && (
        <TagContextMenu
          x={tagMenu.x}
          y={tagMenu.y}
          tag={tagMenu.tag}
          isFavourite={favouriteTags.has(tagMenu.tag)}
          onClose={() => setTagMenu(null)}
          onToggleFavourite={onToggleFavourite}
        />
      )}
    </div>
  );
};

export default Home;
