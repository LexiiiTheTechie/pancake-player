import { useEffect } from "react";

interface UseKeyboardShortcutsProps {
  playNext: () => void;
  playPrevious: () => void;
  togglePlayPause: () => void;
  seekBy: (seconds: number) => void;
}

export const useKeyboardShortcuts = ({
  playNext,
  playPrevious,
  togglePlayPause,
  seekBy,
}: UseKeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if the user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlayPause();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            playNext();
          } else {
            seekBy(10);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            playPrevious();
          } else {
            seekBy(-10);
          }
          break;
        case "KeyL": // Example: maybe just use media keys for next/prev
          // playNext();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playNext, playPrevious, togglePlayPause]);
};
