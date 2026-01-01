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

        await register("MediaPlayPause", (event) => {
          if (event.state === "Pressed") {
            handlersRef.current.togglePlayPause();
          }
        });
        await register("MediaTrackNext", (event) => {
          if (event.state === "Pressed") {
            handlersRef.current.playNext();
          }
        });
        await register("MediaTrackPrevious", (event) => {
          if (event.state === "Pressed") {
            handlersRef.current.playPrevious();
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
