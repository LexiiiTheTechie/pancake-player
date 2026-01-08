import { useRef, useEffect } from "react";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";

interface UseGlobalShortcutsProps {
  playNext: () => void;
  playPrevious: () => void;
  togglePlayPause: () => void;
}

export const useGlobalShortcuts = ({
  playNext,
  playPrevious,
  togglePlayPause,
}: UseGlobalShortcutsProps) => {
  // Use a ref to keep handlers fresh without re-registering shortcuts constantly
  const handlersRef = useRef({
    playNext,
    playPrevious,
    togglePlayPause,
  });

  // Timestamp to prevent double-firing (debounce)
  const lastActionTimeRef = useRef<number>(0);

  // Always keep the ref updated with the latest functions
  useEffect(() => {
    handlersRef.current = {
      playNext,
      playPrevious,
      togglePlayPause,
    };
  }, [playNext, playPrevious, togglePlayPause]);

  useEffect(() => {
    const setupShortcuts = async () => {
      try {
        await unregisterAll();

        await register("MediaPlayPause", () => {
          const now = Date.now();
          if (now - lastActionTimeRef.current > 300) {
            console.log("Global Shortcut: Play/Pause");
            handlersRef.current.togglePlayPause();
            lastActionTimeRef.current = now;
          }
        });
        await register("MediaNextTrack", () => {
          const now = Date.now();
          if (now - lastActionTimeRef.current > 300) {
            console.log("Global Shortcut: Next");
            handlersRef.current.playNext();
            lastActionTimeRef.current = now;
          }
        });
        await register("MediaPrevTrack", () => {
          const now = Date.now();
          if (now - lastActionTimeRef.current > 300) {
            console.log("Global Shortcut: Previous");
            handlersRef.current.playPrevious();
            lastActionTimeRef.current = now;
          }
        });
        console.log("Global shortcuts registered");
      } catch (error) {
        console.error("Failed to register global shortcuts:", error);
      }
    };

    setupShortcuts();

    return () => {
      unregisterAll();
    };
  }, []);
};
