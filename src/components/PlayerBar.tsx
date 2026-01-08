import React, { useState, useEffect } from "react";
import {
  Pause,
  Play,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import IconButton from "./IconButton";
import { Track, RepeatMode } from "../types";
import { formatTime } from "../utils";

interface PlayerBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  shuffle: boolean;
  setShuffle: (shuffle: boolean) => void;
  repeat: RepeatMode;
  setRepeat: (repeat: RepeatMode) => void;
  currentTime: number;
  duration: number;
  setCurrentTime: (time: number) => void;
  onSeek: (time: number) => void;
  onSeekBy: (seconds: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
  isMuted: boolean;
  setIsMuted: (isMuted: boolean) => void;
}

const VolumeInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
}> = ({ value, onChange }) => {
  const [inputValue, setInputValue] = useState(
    Math.round(value * 100).toString()
  );

  useEffect(() => {
    setInputValue(Math.round(value * 100).toString());
  }, [value]);

  const handleBlur = () => {
    let num = parseInt(inputValue);
    if (isNaN(num)) num = 0;
    const clamped = Math.min(100, Math.max(0, num));
    setInputValue(clamped.toString());
    onChange(clamped / 100);
  };

  return (
    <div className="flex items-center group/input min-w-[28px]">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-5 bg-transparent border-none text-right font-mono text-[11px] text-gray-400 group-hover/input:text-white focus:text-cyan-400 focus:outline-none focus:ring-0 p-0 selection:bg-cyan-500/30 transition-colors"
      />
      <span className="text-[10px] text-gray-500 ml-0.5 group-hover/input:text-gray-300 transition-colors">
        %
      </span>
    </div>
  );
};

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
  onSeekBy,
  volume,
  setVolume,
  isMuted,
  setIsMuted,
}) => {
  const cycleRepeat = () => {
    const next = repeat === "none" ? "all" : repeat === "all" ? "one" : "none";
    setRepeat(next);
  };

  return (
    <div className="h-24 bg-gray-900/90 backdrop-blur-xl border-t border-white/5 flex items-center px-6 gap-6 z-30">
      {/* Track Info */}
      <div className="w-1/4 min-w-[200px]">
        {currentTrack ? (
          <div>
            <div className="font-bold text-white truncate">
              {currentTrack.title}
            </div>
            <div className="text-sm text-gray-400 truncate">
              {currentTrack.artist}
            </div>
          </div>
        ) : (
          <div className="text-gray-600 text-sm">Select a track to play</div>
        )}
      </div>

      {/* Controls */}
      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <IconButton
            icon={Shuffle}
            active={shuffle}
            onClick={() => setShuffle(!shuffle)}
            size={18}
          />
          <IconButton
            icon={RotateCcw}
            onClick={() => onSeekBy(-10)}
            disabled={!currentTrack}
            size={18}
          />
          <IconButton
            icon={SkipBack}
            onClick={playPrevious}
            disabled={!currentTrack}
          />
          <button
            onClick={togglePlayPause}
            disabled={!currentTrack}
            className="w-10 h-10 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:scale-100"
          >
            {isPlaying ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" className="ml-0.5" />
            )}
          </button>
          <IconButton
            icon={SkipForward}
            onClick={playNext}
            disabled={!currentTrack}
          />
          <IconButton
            icon={RotateCw}
            onClick={() => onSeekBy(10)}
            disabled={!currentTrack}
            size={18}
          />
          <IconButton
            icon={repeat === "one" ? Repeat1 : Repeat}
            active={repeat !== "none"}
            onClick={cycleRepeat}
            size={18}
          />
        </div>

        <div className="w-full max-w-md flex items-center gap-3 text-xs font-mono text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <div className="flex-1 h-1 bg-gray-700 rounded-full relative group cursor-pointer overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-cyan-500 rounded-full"
              style={{
                width: `${Math.min(
                  (currentTime / (duration || 1)) * 100,
                  100
                )}%`,
              }}
            ></div>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume Control */}
      <div className="w-1/4 min-w-[180px] flex justify-end items-center gap-3">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="text-gray-400 hover:text-white transition-colors group/mute"
        >
          {isMuted || volume === 0 ? (
            <VolumeX
              size={18}
              className="group-hover/mute:text-red-400 transition-colors"
            />
          ) : (
            <Volume2
              size={18}
              className="group-hover/mute:text-cyan-400 transition-colors"
            />
          )}
        </button>

        <div className="flex items-center gap-3">
          <div className="w-24 h-1.5 bg-white/10 rounded-full relative group/vol cursor-pointer">
            {/* Visual Track */}
            <div
              className={`absolute inset-y-0 left-0 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all duration-150 ${
                isMuted ? "bg-gray-600" : "bg-white group-hover/vol:bg-cyan-400"
              }`}
              style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
            ></div>

            {/* Hidden Input for interaction */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                setIsMuted(false);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
          </div>

          <VolumeInput
            value={isMuted ? 0 : volume}
            onChange={(val) => {
              setVolume(val);
              setIsMuted(false);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PlayerBar;
