import React from 'react';
import { Play, Music2, Trash2 } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface PlaylistCardProps {
  name: string;
  trackCount?: number;
  coverImage?: string;
  onPlay: () => void;
  onView: () => void;
  onDelete?: () => void;
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({ name, trackCount, coverImage, onPlay, onView, onDelete }) => {
  return (
    <div 
      className="group relative bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10 cursor-pointer"
      onClick={onView}
    >
      <div className="aspect-square bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden group-hover:from-gray-800 group-hover:to-gray-800 transition-colors">
        {coverImage ? (
          <img 
            src={convertFileSrc(coverImage)} 
            alt={name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <Music2 size={48} className="text-gray-600 group-hover:text-cyan-500 transition-colors duration-300" />
        )}
        
        {/* Play Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
          <button 
            className="w-12 h-12 rounded-full bg-cyan-500 text-black flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform duration-300 shadow-lg shadow-cyan-500/40 hover:bg-cyan-400"
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
          >
            <Play size={24} fill="currentColor" className="ml-1" />
          </button>
        </div>
      </div>

      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white truncate pr-2 text-lg" title={name}>{name}</h3>
          <p className="text-sm text-gray-400 font-medium">
            {trackCount !== undefined ? `${trackCount} tracks` : 'Playlist'}
          </p>
        </div>
        
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-gray-600 hover:text-red-400 p-1.5 rounded-full hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
            title="Delete Playlist"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default PlaylistCard;
