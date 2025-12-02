import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Play, Clock, Music2, GripVertical, Pencil, Check, X } from 'lucide-react';
import { Track, Playlist } from '../types';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
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

// Visual component for the track row
const TrackRow = ({ 
  track, 
  index, 
  formatDuration, 
  isOverlay = false,
  dragListeners,
  dragAttributes
}: { 
  track: Track, 
  index: number, 
  formatDuration: (s: number) => string,
  isOverlay?: boolean,
  dragListeners?: any,
  dragAttributes?: any
}) => {
  return (
    <div 
      className={`grid grid-cols-[30px_16px_1fr_1fr_60px] gap-4 px-4 py-3 rounded-md items-center text-sm text-gray-400 
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
      <div className="text-right font-mono text-xs">{formatDuration(track.duration)}</div>
    </div>
  );
};

const SortableTrackItem = ({ track, index, formatDuration }: { track: Track, index: number, formatDuration: (s: number) => string }) => {
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
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  );
};

const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({ playlistName, onPlay, onBack, onRename }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Rename state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState(playlistName);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
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
        
        setTracks(mappedTracks);
        setCoverImage(playlist.cover_image);
        setNewTitle(playlistName);
      } catch (e) {
        console.error("Failed to load playlist:", e);
      } finally {
        setLoading(false);
      }
    };

    loadPlaylistData();
  }, [playlistName]);

  const handleEditImage = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        }]
      });

      if (file) {
        const imagePath = file as string;
        setCoverImage(imagePath);
        
        // Save playlist with new image
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
          coverImage: imagePath
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
            
            // Auto-save
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
              coverImage: coverImage 
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

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-900 to-black overflow-hidden">
      {/* Single scrollable container */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="p-8 pb-4">
          <div className="flex items-start gap-6 mb-8">
            <button 
              onClick={onBack}
              className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors mt-1"
            >
              <ArrowLeft size={24} />
            </button>

            {/* Cover image */}
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

            {/* Title and info */}
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
                <div className="group flex items-center gap-4 mb-6">
                  <h1 className="text-5xl font-bold text-white">
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

              <div className="flex items-center gap-4 text-gray-400 text-sm font-medium">
                <span>{tracks.length} songs</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 px-2 mb-8">
            <button 
              onClick={onPlay}
              className="w-14 h-14 rounded-full bg-cyan-500 text-black flex items-center justify-center hover:scale-105 hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20"
            >
              <Play size={28} fill="currentColor" className="ml-1" />
            </button>
          </div>
        </div>

        {/* Track List Header */}
        <div className="grid grid-cols-[30px_16px_1fr_1fr_60px] gap-4 px-8 py-2 border-b border-white/10 text-gray-400 text-sm font-medium uppercase tracking-wider sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10">
          <div></div>
          <div>#</div>
          <div>Title</div>
          <div>Artist</div>
          <div className="flex justify-end"><Clock size={16} /></div>
        </div>

        {/* Track List */}
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
