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
        togglePlayPause();
      } else {
        setCurrentTrackIndex(index);
        setIsPlaying(true);
      }
    },
    [currentTrackIndex, setCurrentTrackIndex] // Dependencies for closure
  );

  const togglePlayPause = useCallback(() => {
    if (!currentTrack && queue.length > 0) {
      playTrack(0);
    } else {
      setIsPlaying((p) => !p);
    }
  }, [currentTrack, queue, playTrack]);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIndex = 0;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex =
        currentTrackIndex === null || currentTrackIndex === queue.length - 1
          ? 0
          : currentTrackIndex + 1;
    }
    setCurrentTrackIndex(nextIndex);
  }, [queue.length, currentTrackIndex, shuffle, setCurrentTrackIndex]);

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return;
    if (currentTime > 3 && engineRef.current) {
      engineRef.current.seek(0);
      return;
    }
    const prevIndex =
      !currentTrackIndex || currentTrackIndex === 0
        ? queue.length - 1
        : currentTrackIndex - 1;
    setCurrentTrackIndex(prevIndex);
  }, [queue.length, currentTrackIndex, currentTime, setCurrentTrackIndex]);

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (engineRef.current) engineRef.current.seek(time);
  };

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

    // Logic for finding next track matches playNext but simplified for preload
    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeat === "all") nextIndex = 0;
      else return;
    }
    const nextTrack = queue[nextIndex];
    if (nextTrack) {
      engine.preloadNextTrack(nextTrack.path);
    }
  }, [queue, currentTrackIndex, repeat]);

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
        if (repeat === "one") {
          engine.seek(0);
          engine.play();
        } else {
          // This call needs to trigger the state update in the PARENT
          // effectively calling playNext() but we can't call the hook's playNext directly inside the hook's effect easily
          // unless we're careful. We'll use the function passed in props or defined above.

          // However, playNext changes state, which re-renders, which triggers this effect again.
          // This is fine.

          // WARNING: We need to break the cycle.
          // We can just call the state setter directly or helper.
          playNext();
        }
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
          if (repeat !== "one" && engine.startNextTrackNow()) {
            gaplessSwitchedRef.current = true;
            playNext(); // Updates React state to match engine
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
  }, [isPlaying, duration, repeat, playNext]); // playNext dep is stable due to useCallback

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
  };
};
