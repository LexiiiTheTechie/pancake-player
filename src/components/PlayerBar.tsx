import React from 'react';
import { Pause, Play, SkipForward, SkipBack, Volume2, VolumeX, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import IconButton from './IconButton';
import { Track, RepeatMode } from '../types';
import { formatTime } from '../utils';

interface PlayerBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  shuffle: boolean;
  setShuffle: (shuffle: boolean) => void;
  repeat: RepeatMode;
  setRepeat: (repeat: RepeatMode) => void; // This needs to handle the logic or just set state
  // Actually in App.tsx it was: setRepeat(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none')
  // I will pass a function that cycles repeat mode or just the setter.
  // Let's pass the cycle logic handler from App.tsx or handle it here.
  // The prop type says setRepeat: (repeat: RepeatMode) => void.
  // I'll handle the cycling in the onClick here if I pass the setter, OR I can pass a toggleRepeat function.
  // Let's pass setRepeat and handle cycling here for now, or assume the parent passes a setter.
  // App.tsx uses setRepeat(r => ...).
  // I'll change the prop to `toggleRepeat` for cleaner API, or just `setRepeat`.
  // Let's stick to `setRepeat` and I'll implement the cycle logic here.
  currentTime: number;
  duration: number;
  setCurrentTime: (time: number) => void;
  onSeek: (time: number) => void; // Separate seek handler for the range input
  volume: number;
  setVolume: (volume: number) => void;
  isMuted: boolean;
  setIsMuted: (isMuted: boolean) => void;
}

const PlayerBar: React.FC<PlayerBarProps> = ({
  currentTrack,
  isPlaying,
  togglePlayPause,
  playNext,
  playPrevious,
  shuffle,
  setShuffle,
  repeat,
  setRepeat,
  currentTime,
  duration,
  onSeek,
  volume,
  setVolume,
  isMuted,
  setIsMuted
}) => {
  
  const cycleRepeat = () => {
    const next = repeat === 'none' ? 'all' : repeat === 'all' ? 'one' : 'none';
    setRepeat(next);
  };

  return (
    <div className="h-24 bg-gray-900/90 backdrop-blur-xl border-t border-white/5 flex items-center px-6 gap-6 z-30">

      {/* Track Info */}
      <div className="w-1/4 min-w-[200px]">
        {currentTrack ? (
          <div>
            <div className="font-bold text-white truncate">{currentTrack.title}</div>
            <div className="text-sm text-gray-400 truncate">{currentTrack.artist}</div>
          </div>
        ) : (
          <div className="text-gray-600 text-sm">Select a track to play</div>
        )}
      </div>

      {/* Controls */}
      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <IconButton icon={Shuffle} active={shuffle} onClick={() => setShuffle(!shuffle)} size={18} />
          <IconButton icon={SkipBack} onClick={playPrevious} disabled={!currentTrack} />
          <button
            onClick={togglePlayPause}
            disabled={!currentTrack}
            className="w-10 h-10 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:scale-100"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
          </button>
          <IconButton icon={SkipForward} onClick={playNext} disabled={!currentTrack} />
          <IconButton 
            icon={repeat === 'one' ? Repeat1 : Repeat} 
            active={repeat !== 'none'} 
            onClick={cycleRepeat} 
            size={18} 
          />
        </div>

        <div className="w-full max-w-md flex items-center gap-3 text-xs font-mono text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <div className="flex-1 h-1 bg-gray-700 rounded-full relative group cursor-pointer">
            <div
              className="absolute inset-y-0 left-0 bg-cyan-500 rounded-full"
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
            ></div>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={e => onSeek(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="w-1/4 min-w-[150px] flex justify-end items-center gap-2">
        <button onClick={() => setIsMuted(!isMuted)} className="text-gray-400 hover:text-white">
          {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <div className="w-24 h-1 bg-gray-700 rounded-full relative group">
          <div
            className="absolute inset-y-0 left-0 bg-white rounded-full group-hover:bg-cyan-400 transition-colors"
            style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
          ></div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={e => {
              setVolume(parseFloat(e.target.value));
              setIsMuted(false);
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>

    </div>
  );
};

export default PlayerBar;
