import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Play, Clock, Music2, GripVertical, Pencil, Check, X, Plus, FolderUp, Trash2, FilePlus2, FolderOpen } from 'lucide-react';
import { Track, Playlist } from '../types';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  Modifier
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PlaylistDetailViewProps {
  playlistName: string;
  onPlay: () => void;
  onBack: () => void;
  onRename?: (newName: string) => void;
}

const restrictToVerticalAxis: Modifier = ({ transform }) => {
  return {
    ...transform,
    x: 0,
  };
};

const TrackRow = ({ 
  track, 
  index, 
  formatDuration, 
  onRemove,
  isOverlay = false,
  dragListeners,
  dragAttributes
}: { 
  track: Track, 
  index: number, 
  formatDuration: (s: number) => string,
  onRemove?: () => void,
  isOverlay?: boolean,
  dragListeners?: any,
  dragAttributes?: any
}) => {
  const getFormat = (path: string) => {
    const ext = path.split('.').pop()?.toUpperCase();
    return ext || '???';
  };

  return (
    <div 
      className={`grid grid-cols-[30px_16px_1fr_1fr_50px_60px_30px] gap-4 px-4 py-3 rounded-md items-center text-sm text-gray-400 
        ${isOverlay ? 'bg-gray-800 shadow-xl border border-white/10' : 'hover:bg-white/5 hover:text-white group transition-colors'}
      `}
    >
      <div className="flex items-center justify-center">
         <button 
          {...dragAttributes} 
          {...dragListeners}
          className={`p-1 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing ${isOverlay ? 'cursor-grabbing' : ''}`}
        >
          <GripVertical size={16} />
        </button>
      </div>
      <div className={!isOverlay ? "group-hover:text-white" : ""}>{index + 1}</div>
      <div className="font-medium text-white truncate">{track.title}</div>
      <div className="truncate">{track.artist}</div>
      <div className="text-[10px] font-bold text-gray-600 bg-white/5 px-1.5 py-0.5 rounded uppercase tracking-tighter text-center">{getFormat(track.path)}</div>
      <div className="text-right font-mono text-xs">{formatDuration(track.duration)}</div>
      <div className="flex justify-center">
        {!isOverlay && (
          <button 
            onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
            className="p-1.5 rounded-md hover:bg-red-500/20 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            title="Remove from playlist"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

const SortableTrackItem = ({ track, index, formatDuration, onRemove }: { track: Track, index: number, formatDuration: (s: number) => string, onRemove: () => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TrackRow 
        track={track} 
        index={index} 
        formatDuration={formatDuration} 
        onRemove={onRemove}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  );
};

const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({ playlistName, onPlay, onBack, onRename }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [folderPath, setFolderPath] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Rename state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState(playlistName);
  
  // Tag state
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [allLibraryTags, setAllLibraryTags] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (isAddingTag) {
        const fetchAllTags = async () => {
            try {
                const playlistsResult = await invoke<any[]>('get_playlists');
                const uniqueTags = Array.from(new Set(playlistsResult.flatMap(p => p.tags || []))).sort();
                setAllLibraryTags(uniqueTags);
            } catch (e) {
                console.error("Failed to fetch library tags:", e);
            }
        };
        fetchAllTags();
    }
  }, [isAddingTag]);

  const loadPlaylistData = async () => {
    try {
      setLoading(true);
      const playlist = await invoke<Playlist>('load_playlist', { name: playlistName });
      
      const mappedTracks: Track[] = playlist.tracks.map((t: any) => ({
        id: `${Date.now()}-${Math.random()}`, 
        path: t.path,
        filename: t.filename,
        duration: t.duration,
        artist: t.artist || 'Unknown Artist',
        title: t.title || 'Unknown',
        album: t.album || 'Unknown Album',
        metadataLoaded: true,
      }));
      
      const fallbackPath = playlist.tracks.length > 0 
        ? playlist.tracks[0].path.replace(/\\[^\\]+$/, '').replace(/\/[^\/]+$/, '')
        : undefined;

      setTracks(mappedTracks);
      setCoverImage(playlist.cover_image);
      setTags(playlist.tags || []);
      setFolderPath(playlist.folder_path || fallbackPath);
      setNewTitle(playlistName);
    } catch (e) {
      console.error("Failed to load playlist:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaylistData();
  }, [playlistName]);

  const handleAddTag = async (tagName?: string) => {
    const nameToUse = (tagName || tagInput).trim();
    if (!nameToUse) {
        setIsAddingTag(false);
        return;
    }
    
    if (tags.includes(nameToUse)) {
        setTagInput("");
        setIsAddingTag(false);
        return;
    }

    const updatedTags = [...tags, nameToUse];
    try {
        await invoke('update_playlist_tags', { name: playlistName, tags: updatedTags });
        setTags(updatedTags);
        setTagInput("");
        setIsAddingTag(false);
    } catch (e) {
        console.error("Failed to add tag:", e);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = tags.filter(t => t !== tagToRemove);
    try {
        await invoke('update_playlist_tags', { name: playlistName, tags: updatedTags });
        setTags(updatedTags);
    } catch (e) {
        console.error("Failed to remove tag:", e);
    }
  };

  const handleEditImage = async () => {
    try {
      const file = await open({
        multiple: false,
        defaultPath: folderPath,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        }]
      });

      if (file) {
        const imagePath = file as string;
        setCoverImage(imagePath);
        
        const tracksToSave = tracks.map(t => ({
            path: t.path,
            filename: t.filename,
            duration: t.duration,
            artist: t.artist === 'Unknown Artist' ? null : t.artist,
            title: t.title === 'Unknown' ? null : t.title,
            album: t.album === 'Unknown Album' ? null : t.album
        }));
        
        await invoke('save_playlist', { 
          name: playlistName, 
          tracks: tracksToSave,
          coverImage: imagePath,
          tags: tags,
          folder_path: folderPath
        });
      }
    } catch (e) {
      console.error("Failed to update cover image:", e);
    }
  };

  const handleRename = async () => {
    if (!newTitle.trim() || newTitle === playlistName) {
      setIsEditingTitle(false);
      setNewTitle(playlistName);
      return;
    }

    try {
      await invoke('rename_playlist', { oldName: playlistName, newName: newTitle });
      if (onRename) {
        onRename(newTitle);
      }
      setIsEditingTitle(false);
    } catch (e) {
      console.error("Failed to rename playlist:", e);
      alert("Failed to rename playlist: " + e);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setTracks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);
        
        if (oldIndex !== -1 && newIndex !== -1) {
            const newTracks = [...items];
            const [movedItem] = newTracks.splice(oldIndex, 1);
            newTracks.splice(newIndex, 0, movedItem);
            
            const tracksToSave = newTracks.map(t => ({
                path: t.path,
                filename: t.filename,
                duration: t.duration,
                artist: t.artist === 'Unknown Artist' ? null : t.artist,
                title: t.title === 'Unknown' ? null : t.title,
                album: t.album === 'Unknown Album' ? null : t.album
            }));
            
            invoke('save_playlist', { 
              name: playlistName, 
              tracks: tracksToSave,
              coverImage: coverImage,
              tags: tags,
              folder_path: folderPath
            })
            .catch(e => console.error("Failed to auto-save playlist order:", e));

            return newTracks;
        }
        return items;
      });
    }
    setActiveId(null);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeTrack = activeId ? tracks.find(t => t.id === activeId) : null;
  const activeIndex = activeId ? tracks.findIndex(t => t.id === activeId) : -1;

  const handleRemoveTrack = async (index: number) => {
    const newTracks = [...tracks];
    newTracks.splice(index, 1);
    setTracks(newTracks);
    
    // Auto-save
    try {
        const tracksToSave = newTracks.map(t => ({
            path: t.path,
            filename: t.filename,
            duration: t.duration,
            artist: t.artist === 'Unknown Artist' ? null : t.artist,
            title: t.title === 'Unknown' ? null : t.title,
            album: t.album === 'Unknown Album' ? null : t.album
        }));
        
        await invoke('save_playlist', { 
          name: playlistName, 
          tracks: tracksToSave,
          coverImage: coverImage,
          tags: tags,
          folder_path: folderPath
        });
    } catch (e) {
        console.error("Failed to save playlist after removal:", e);
    }
  };

  const handleAddTracks = async () => {
    try {
      const selected = await open({
        multiple: true,
        defaultPath: folderPath,
        filters: [{
          name: 'Audio',
          extensions: ['mp3', 'm4a', 'flac', 'wav', 'ogg', 'opus']
        }]
      });

      if (selected && Array.isArray(selected)) {
        setLoading(true);
        const newTrackResults = await Promise.all(
          selected.map(path => invoke<any>('get_audio_metadata', { filePath: path, enableGapless: false }))
        );

        const mappedNewTracks: Track[] = newTrackResults.map((t: any) => ({
          id: `${Date.now()}-${Math.random()}`,
          path: t.path,
          filename: t.filename,
          duration: t.duration,
          artist: t.artist || 'Unknown Artist',
          title: t.title || 'Unknown',
          album: t.album || 'Unknown Album',
          metadataLoaded: true,
        }));

        const finalTracks = [...tracks, ...mappedNewTracks];
        setTracks(finalTracks);

        // Save
        const tracksToSave = finalTracks.map(t => ({
            path: t.path,
            filename: t.filename,
            duration: t.duration,
            artist: t.artist === 'Unknown Artist' ? null : t.artist,
            title: t.title === 'Unknown' ? null : t.title,
            album: t.album === 'Unknown Album' ? null : t.album
        }));
        
        await invoke('save_playlist', { 
          name: playlistName, 
          tracks: tracksToSave,
          coverImage: coverImage,
          tags: tags,
          folder_path: folderPath
        });
      }
    } catch (e) {
      console.error("Failed to add tracks:", e);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = allLibraryTags.filter(t => 
    !tags.includes(t) && 
    t.toLowerCase().includes(tagInput.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-900 to-black overflow-hidden selection:bg-cyan-500/30">
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 pb-4">
          <div className="flex items-start gap-6 mb-8">
            <button 
              onClick={onBack}
              className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors mt-1"
            >
              <ArrowLeft size={24} />
            </button>

            <div className="w-48 h-48 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center shadow-2xl shadow-black/50 relative group overflow-hidden">
              {coverImage ? (
                <img 
                  src={convertFileSrc(coverImage)} 
                  alt={playlistName} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music2 size={64} className="text-gray-600" />
              )}
              
              <button 
                onClick={handleEditImage}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity duration-200 cursor-pointer"
              >
                <Pencil size={32} className="text-white mb-2" />
                <span className="text-white text-sm font-medium">Change Image</span>
              </button>
            </div>

            <div className="flex flex-col justify-end flex-1">
              <h4 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-2">
                Playlist
              </h4>
              
              {isEditingTitle ? (
                <div className="flex items-center gap-2 mb-6">
                  <input 
                    type="text" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="text-5xl font-bold text-white bg-transparent border-b border-white/20 focus:border-cyan-500 focus:outline-none w-full"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename();
                      if (e.key === 'Escape') {
                        setIsEditingTitle(false);
                        setNewTitle(playlistName);
                      }
                    }}
                  />
                  <button onClick={handleRename} className="p-2 hover:bg-white/10 rounded-full text-green-400">
                    <Check size={24} />
                  </button>
                  <button onClick={() => { setIsEditingTitle(false); setNewTitle(playlistName); }} className="p-2 hover:bg-white/10 rounded-full text-red-400">
                    <X size={24} />
                  </button>
                </div>
              ) : (
                <div className="group flex items-center gap-4 mb-2">
                  <h1 className="text-5xl font-bold text-white line-clamp-2 leading-tight">
                    {playlistName}
                  </h1>
                  <button 
                    onClick={() => setIsEditingTitle(true)}
                    className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil size={20} />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mb-4 relative">
                {tags.map(tag => (
                  <div 
                    key={tag} 
                    className="group bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 transition-all hover:bg-cyan-500/20"
                  >
                    {tag}
                    <button 
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                
                {isAddingTag ? (
                  <div className="flex flex-col relative">
                    <input 
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTag();
                        if (e.key === 'Escape') setIsAddingTag(false);
                      }}
                      autoFocus
                      placeholder="Add tag..."
                      className="bg-white/10 border border-cyan-500/30 rounded-full px-3 py-0.5 text-[11px] text-white focus:outline-none focus:border-cyan-500 focus:bg-white/20 w-32 transition-all placeholder:text-gray-500"
                    />
                    
                    {isAddingTag && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 mt-2 bg-gray-900 border border-white/10 rounded-xl shadow-2xl p-2 z-50 min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-200">
                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold px-2 mb-1.5">Suggestions</p>
                            <div className="flex flex-wrap gap-1">
                                {suggestions.map(suggestion => (
                                    <button
                                        key={suggestion}
                                        onClick={() => handleAddTag(suggestion)}
                                        className="text-[11px] px-2 py-1 bg-white/5 hover:bg-cyan-500 hover:text-black rounded-lg text-gray-400 transition-all font-medium border border-white/5"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsAddingTag(true)}
                    className="text-gray-500 hover:text-cyan-400 transition-all p-1 hover:scale-110 active:scale-95"
                    title="Add Tag"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-4 text-gray-400 text-sm font-medium">
                  <span>{tracks.length} songs</span>
                </div>
                
                {folderPath && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-gray-500 text-xs font-medium hover:text-cyan-400/80 transition-colors group/path cursor-pointer" 
                         onClick={() => {
                           navigator.clipboard.writeText(folderPath);
                         }}
                         title="Click to copy path">
                      <FolderUp size={14} className="group-hover/path:text-cyan-400" />
                      <span className="group-hover/path">{folderPath}</span>
                    </div>
                    
                    <div className="w-px h-3 bg-white/10 mx-1" />
                    
                    <button 
                      onClick={() => openPath(folderPath)}
                      className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-cyan-400 transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                      title="Open in File Explorer"
                    >
                      <FolderOpen size={14} />
                      Open
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 px-2 mb-8">
            <button 
              onClick={onPlay}
              className="w-14 h-14 rounded-full bg-cyan-500 text-black flex items-center justify-center hover:scale-105 hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20"
            >
              <Play size={28} fill="currentColor" className="ml-1" />
            </button>
            <button 
              onClick={handleAddTracks}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all active:scale-95 border border-white/10 text-sm font-bold"
            >
              <FilePlus2 size={20} className="text-cyan-400" />
              Add Songs
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[30px_16px_1fr_1fr_50px_60px_30px] gap-4 px-8 py-2 border-b border-white/10 text-gray-400 text-[10px] font-bold uppercase tracking-widest sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10 items-center">
          <div></div>
          <div>#</div>
          <div>Title</div>
          <div>Artist</div>
          <div className="text-center">Ext</div>
          <div className="flex justify-end pr-2"><Clock size={16} /></div>
          <div></div>
        </div>

        <div className="px-4 pb-8">
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading tracks...</div>
          ) : tracks.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No tracks in this playlist</div>
          ) : (
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext 
                  items={tracks.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
              >
                  <div className="space-y-1 mt-2">
                      {tracks.map((track, index) => (
                      <SortableTrackItem 
                          key={track.id}
                          track={track}
                          index={index}
                          formatDuration={formatDuration}
                          onRemove={() => handleRemoveTrack(index)}
                      />
                      ))}
                  </div>
              </SortableContext>
              
              <DragOverlay>
                {activeTrack ? (
                  <TrackRow 
                    track={activeTrack} 
                    index={activeIndex} 
                    formatDuration={formatDuration} 
                    isOverlay 
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaylistDetailView;
