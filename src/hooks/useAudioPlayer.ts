import { useRef, useState, useEffect, useCallback } from "react";
import { AudioEngine } from "../audioEngine";
import { Track, RepeatMode } from "../types";

interface UseAudioPlayerProps {
  queue: Track[];
  currentTrackIndex: number | null;
  setCurrentTrackIndex: (index: number | null) => void;
  repeat: RepeatMode;
  shuffle: boolean;
  enableGapless: boolean;
}

export const useAudioPlayer = ({
  queue,
  currentTrackIndex,
  setCurrentTrackIndex,
  repeat,
  shuffle,
}: UseAudioPlayerProps) => {
  const engineRef = useRef<AudioEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);

  // To avoid circular dependency logic with onEnded triggering next track
  // we need internal refs or callbacks passed to the engine

  const currentTrack =
    currentTrackIndex !== null ? queue[currentTrackIndex] : null;

  // Use refs for callbacks to avoid stale closures in engine events/polling
  const playNextRef = useRef<(isAuto?: boolean) => void>(() => {});
  const playPreviousRef = useRef<() => void>(() => {});
  const togglePlayPauseRef = useRef<() => void>(() => {});
  const repeatRef = useRef(repeat);
  const queueRef = useRef(queue);
  const currentTrackIndexRef = useRef(currentTrackIndex);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    repeatRef.current = repeat;
    queueRef.current = queue;
    currentTrackIndexRef.current = currentTrackIndex;
    isPlayingRef.current = isPlaying;
  }, [repeat, queue, currentTrackIndex, isPlaying]);

  // Initialize Engine
  useEffect(() => {
    engineRef.current = new AudioEngine();
    return () => {
      engineRef.current?.stop();
    };
  }, []);

  // Helper to safely play a specific track index
  const playTrack = useCallback(
    (index: number) => {
      if (currentTrackIndex === index) {
        // If same track, just make sure it's playing and maybe restart if paused
        if (!isPlaying) {
          setIsPlaying(true);
        } else {
          // Optional: restart track? For now just keep playing
          if (engineRef.current) engineRef.current.seek(0);
        }
      } else {
        setCurrentTrackIndex(index);
        setIsPlaying(true);
      }
    },
    [currentTrackIndex, isPlaying, setCurrentTrackIndex]
  );

  const togglePlayPause = useCallback(() => {
    if (!currentTrack && queue.length > 0) {
      playTrack(0);
    } else {
      setIsPlaying((p) => !p);
    }
  }, [currentTrack, queue, playTrack]);

  const playNext = useCallback(
    (isAuto = false) => {
      const q = queueRef.current;
      const idx = currentTrackIndexRef.current;
      const rep = repeatRef.current;

      if (q.length === 0) return;

      // If auto-advancing and we are at the end without repeat all, STOP.
      if (isAuto && rep === "none" && idx === q.length - 1) {
        setIsPlaying(false);
        return;
      }

      let nextIndex = 0;
      if (shuffle) {
        if (q.length > 1) {
          // Avoid playing the same track again if possible
          do {
            nextIndex = Math.floor(Math.random() * q.length);
          } while (nextIndex === idx);
        } else {
          nextIndex = 0;
        }
      } else {
        nextIndex = idx === null || idx === q.length - 1 ? 0 : idx + 1;
      }
      setCurrentTrackIndex(nextIndex);
      setIsPlaying(true);
    },
    [shuffle, setCurrentTrackIndex]
  );

  const playPrevious = useCallback(() => {
    const q = queueRef.current;
    const idx = currentTrackIndexRef.current;

    if (q.length === 0) return;
    if (currentTime > 3 && engineRef.current) {
      engineRef.current.seek(0);
      return;
    }
    const prevIndex = !idx || idx === 0 ? q.length - 1 : idx - 1;
    setCurrentTrackIndex(prevIndex);
    setIsPlaying(true);
  }, [currentTime, setCurrentTrackIndex]);

  useEffect(() => {
    playNextRef.current = playNext;
    playPreviousRef.current = playPrevious;
    togglePlayPauseRef.current = togglePlayPause;
  }, [playNext, playPrevious, togglePlayPause]);

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (engineRef.current) engineRef.current.seek(time);
  };

  const seekBy = useCallback(
    (seconds: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      const newTime = Math.max(
        0,
        Math.min(engine.duration, engine.currentTime + seconds)
      );
      handleSeek(newTime);
    },
    [handleSeek]
  );

  // --- Effects ---

  // 1. Handle Play/Pause State
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isPlaying) engine.play();
    else engine.pause();
  }, [isPlaying]);

  // 2. Handle Volume/Mute
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setVolume(volume);
    engine.setMute(isMuted);
  }, [volume, isMuted]);

  // 3. Preload Next Track
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || queue.length === 0 || currentTrackIndex === null) return;

    let nextIndex;
    if (shuffle) {
      // In shuffle mode, we don't know the "next" index until we pick it.
      // For now, let's not preload in shuffle or pick a random one if we want to be fancy.
      // But a random pick might be different from what playNext() eventually picks.
      // So gapless is harder with random shuffle without a lookahead queue.
      return;
    } else {
      nextIndex = currentTrackIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeat === "all") nextIndex = 0;
        else return;
      }
    }

    const nextTrack = queue[nextIndex];
    if (nextTrack) {
      engine.preloadNextTrack(nextTrack.path);
    }
  }, [queue, currentTrackIndex, repeat, shuffle]);

  // 4. Handle Track Change & Gapless Logic
  // Using a ref to track if we just did a gapless switch to avoid double-loading
  const gaplessSwitchedRef = useRef(false);

  useEffect(() => {
    const loadAndPlay = async () => {
      const engine = engineRef.current;
      if (!engine || !currentTrack) return;

      // Smart check: Is engine already playing this file? (Gapless auto-switch)
      if (
        engine.activeTrackPath === currentTrack.path &&
        (engine.currentTime < 2.0 || isPlaying)
      ) {
        console.log("🚀 Syncing state with auto-switched track");
        if (isPlaying) engine.play();
      } else {
        // Standard load
        try {
          engine.stop();
          const loaded = await engine.loadTrack(currentTrack.path);
          if (loaded && isPlaying) engine.play();
        } catch (e) {
          console.error("Failed to load track:", e);
          setIsPlaying(false);
        }
      }

      // Update duration
      if (currentTrack.duration > 0) setDuration(currentTrack.duration);
      else setDuration(engine.duration || 0);

      // OnEnded Callback
      engine.setOnEnded(() => {
        if (gaplessSwitchedRef.current) {
          console.log("🔇 onEnded skipped - handled by gapless logic");
          return;
        }
        // Auto-advance
        playNextRef.current(true);
      });
    };

    loadAndPlay();
  }, [currentTrack]); // Intentionally minimal deps

  // 5. Polling Loop (Time Update & Gapless Trigger)
  useEffect(() => {
    const interval = setInterval(() => {
      if (engineRef.current && isPlaying) {
        const engine = engineRef.current;
        setCurrentTime(engine.currentTime);

        const timeUntilEnd = engine.getTimeUntilEnd();
        if (
          timeUntilEnd <= 0.15 &&
          timeUntilEnd > 0 &&
          !gaplessSwitchedRef.current
        ) {
          if (repeatRef.current !== "one" && engine.startNextTrackNow()) {
            gaplessSwitchedRef.current = true;
            playNextRef.current(true); // Updates React state to match engine
          }
        } else if (timeUntilEnd > 0.5) {
          gaplessSwitchedRef.current = false;
        }

        if (engine.duration > 0 && Math.abs(engine.duration - duration) > 1) {
          setDuration(engine.duration);
        }
      }
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying, duration]); // Use refs inside for other values to avoid interval restarts

  return {
    engineRef,
    isPlaying,
    setIsPlaying, // Exported if UI needs to force it
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
  };
};
