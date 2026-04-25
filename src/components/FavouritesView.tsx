import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { ChevronDown, Music, Play, Star, Sparkles, Search } from 'lucide-react';
import { PlaylistSummary } from '../types';
import { convertFileSrc } from '@tauri-apps/api/core';

interface FavouritesViewProps {
  playlists: PlaylistSummary[];
  favouriteTags: Set<string>;
  onPlayPlaylist: (name: string) => void;
  onViewPlaylist: (name: string) => void;
}

const FavouritesView: React.FC<FavouritesViewProps> = ({ playlists, favouriteTags, onPlayPlaylist, onViewPlaylist }) => {
  // We'll track which sections are expanded using an object map
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);

  const toggleSection = (name: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // Group and filter playlists by favourite tags and search query
  const filteredFavourites = useMemo(() => {
    const query = deferredQuery.toLowerCase().trim();
    const tags = Array.from(favouriteTags).sort();
    
    return tags.map(tag => {
      const tagPlaylists = playlists.filter(p => p.tags?.includes(tag));
      const isTagMatch = tag.toLowerCase().includes(query);
      
      // If the tag matches, show all its playlists. Otherwise, show only matching playlists.
      const matches = tagPlaylists.filter(p => 
        isTagMatch || p.name.toLowerCase().includes(query)
      );

      return { tag, playlists: matches };
    }).filter(group => group.playlists.length > 0);
  }, [playlists, favouriteTags, deferredQuery]);

  // Automatically expand sections when searching to show results
  useEffect(() => {
    if (deferredQuery.trim()) {
      const newExpanded: Record<string, boolean> = {};
      filteredFavourites.forEach(group => {
        newExpanded[group.tag] = true;
      });
      setExpandedSections(newExpanded);
    }
  }, [deferredQuery, filteredFavourites]);

  return (
    <div className="h-full w-full overflow-y-auto bg-gradient-to-b from-[#0a0a0a] to-black p-8 pb-32 text-white animate-in fade-in duration-500 custom-scrollbar">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-10">
        <div className="flex items-center gap-6">
          <div className="p-5 bg-gradient-to-br from-yellow-400/20 to-orange-500/10 rounded-3xl border border-yellow-500/20 shadow-2xl shadow-yellow-500/10 ring-1 ring-white/5">
            <Star className="w-12 h-12 text-yellow-400 fill-yellow-400/20" />
          </div>
          <div>
            <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-500">
              Collections
            </h1>
            <p className="text-gray-400 mt-1.5 font-medium flex items-center gap-2">
              <Sparkles size={14} className="text-cyan-400" />
              {favouriteTags.size} tags organized into custom galleries
            </p>
          </div>
        </div>

        {/* Collection Search */}
        <div className="relative group max-w-sm w-full">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-cyan-400 transition-colors"
            size={18}
          />
          <input
            type="text"
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:bg-white/10 focus:border-cyan-500/50 transition-all placeholder:text-gray-600 font-medium"
          />
        </div>
      </header>

      <div className="grid gap-8">
        {filteredFavourites.length > 0 ? (
          filteredFavourites.map(({ tag, playlists: tagPlaylists }) => (
            <div key={tag} className="group/section bg-white/[0.02] rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-500">
              <div 
                className="p-6 flex items-center justify-between cursor-pointer group select-none"
                onClick={() => toggleSection(tag)}
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-yellow-400/10 rounded-2xl flex items-center justify-center border border-yellow-400/20 group-hover:scale-110 transition-transform duration-500">
                    <Star size={24} className="text-yellow-400 fill-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-2xl tracking-tight">{tag}</h3>
                    <p className="text-xs font-bold uppercase tracking-widest text-cyan-400/60">{tagPlaylists.length} Playlists</p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-white group-hover:bg-white/10 transition-all">
                  <ChevronDown 
                    size={20} 
                    className={`transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${expandedSections[tag] ? 'rotate-0' : '-rotate-90'}`}
                  />
                </div>
              </div>

              <div 
                className={`transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] overflow-hidden will-change-[max-height,opacity] [transform:translateZ(0)] ${expandedSections[tag] ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <div className={`px-6 pb-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-5 transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${expandedSections[tag] ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0'}`}>
                    {tagPlaylists.map((playlist) => (
                      <div
                        key={playlist.name}
                        className="group/item flex flex-col gap-3 p-4 bg-black/20 rounded-[2rem] border border-white/5 hover:bg-white/5 transition-all duration-300 cursor-pointer"
                        onClick={() => onViewPlaylist(playlist.name)}
                      >
                        <div className="aspect-square bg-gray-800 rounded-[1.5rem] flex-shrink-0 relative overflow-hidden shadow-xl group-hover/item:shadow-cyan-500/10 transition-all">
                          {playlist.cover_image ? (
                            <img src={convertFileSrc(playlist.cover_image)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music size={32} className="text-gray-700 group-hover/item:text-cyan-500/50 transition-colors" />
                            </div>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); onPlayPlaylist(playlist.name); }}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 flex items-center justify-center transition-all duration-300 backdrop-blur-[2px]"
                          >
                            <div className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center text-black scale-75 group-hover/item:scale-100 transition-transform">
                              <Play size={20} fill="currentColor" className="ml-1" />
                            </div>
                          </button>
                        </div>
                        <div className="min-w-0 px-2">
                          <h4 className="font-bold text-[15px] truncate text-white/90 group-hover/item:text-cyan-400 transition-colors">{playlist.name}</h4>
                          <p className="text-[11px] text-gray-500 font-bold uppercase tracking-tighter">{playlist.track_count} tracks</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-gray-600">
            {searchQuery ? <Search className="w-16 h-16 mb-4 opacity-20" /> : <Star className="w-16 h-16 mb-4 opacity-20" />}
            <p className="text-lg font-medium italic text-center">
              {searchQuery ? (
                <>
                  No matches found for "{searchQuery}"<br/>
                  <span className="text-sm font-normal opacity-60">Try a different search term or clear the filter.</span>
                </>
              ) : (
                <>
                  No favourite tags found.<br/>
                  <span className="text-sm font-normal opacity-60">Right-click a tag in the Library to add it to your favourites.</span>
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FavouritesView;