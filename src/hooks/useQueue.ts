import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { Track, RawMetadata, RepeatMode } from "../types";
import {
  SUPPORTED_AUDIO_EXTENSIONS_DOT,
  SUPPORTED_AUDIO_EXTENSIONS_NO_DOT,
} from "../constants";

interface UseQueueProps {
  enableGapless: boolean;
}

export const useQueue = ({ enableGapless }: UseQueueProps) => {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(
    null
  );
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("none");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const currentTrack =
    currentTrackIndex !== null ? queue[currentTrackIndex] : null;

  // --- File Processing ---

  const processPaths = useCallback(
    async (paths: string[]) => {
      const validPaths = paths.filter((path) =>
        SUPPORTED_AUDIO_EXTENSIONS_DOT.some((ext) =>
          path.toLowerCase().endsWith(ext)
        )
      );

      if (validPaths.length === 0) return;

      setIsLoading(true);

      // 1. Create initial track objects immediately so UI updates fast
      const newTracks: Track[] = validPaths.map((path) => ({
        id: `${Date.now()}-${Math.random()}`,
        path,
        filename: path.split(/[/\\]/).pop() || "Unknown",
        duration: 0,
        artist: "Loading...",
        title:
          path
            .split(/[/\\]/)
            .pop()
            ?.replace(/\.[^/.]+$/, "") || "Unknown",
        album: "Loading...",
        metadataLoaded: false,
      }));

      // Add to queue immediately
      setQueue((prev) => [...prev, ...newTracks]);

      // 2. Fetch metadata in parallel batches
      const metadataPromises = newTracks.map(async (track) => {
        try {
          const metadata = await invoke<RawMetadata>("get_audio_metadata", {
            filePath: track.path,
            enableGapless: enableGapless,
          });
          return { trackId: track.id, metadata, success: true };
        } catch (e) {
          console.error(`Metadata error for ${track.path}:`, e);
          return { trackId: track.id, success: false };
        }
      });

      // Wait for all metadata
      const results = await Promise.all(metadataPromises);

      // 3. Update queue with all loaded metadata at once
      setQueue((prev) => {
        const updates = new Map(results.map((r) => [r.trackId, r]));

        return prev.map((t) => {
          const update = updates.get(t.id);
          if (update && update.success && update.metadata) {
            return {
              ...t,
              metadataLoaded: true,
              artist: update.metadata.artist || "Unknown Artist",
              title: update.metadata.title || t.title,
              album: update.metadata.album || "Unknown Album",
              duration: update.metadata.duration || 0,
            };
          } else if (update && !update.success) {
            return { ...t, metadataLoaded: true };
          }
          return t;
        });
      });

      // If queue was empty, set current index to 0 to be ready to play
      if (queue.length === 0 && newTracks.length > 0) {
        if (currentTrackIndex === null) {
          setCurrentTrackIndex(0);
        }
      }

      setIsLoading(false);
    },
    [queue.length, enableGapless, currentTrackIndex]
  );

  const addFiles = useCallback(async () => {
    try {
      const selectedPaths = await open({
        multiple: true,
        title: "Add Music Files",
        filters: [
          {
            name: "Audio",
            extensions: SUPPORTED_AUDIO_EXTENSIONS_NO_DOT,
          },
        ],
      });

      if (!selectedPaths) return;

      const paths = Array.isArray(selectedPaths)
        ? selectedPaths
        : [selectedPaths];
      await processPaths(paths);
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  }, [processPaths]);

  // --- Queue State Management ---

  const reorderQueue = (oldIndex: number, newIndex: number) => {
    setQueue((items) => {
      const newQueue = [...items];
      const [movedItem] = newQueue.splice(oldIndex, 1);
      newQueue.splice(newIndex, 0, movedItem);
      return newQueue;
    });

    if (currentTrackIndex !== null) {
      if (currentTrackIndex === oldIndex) {
        setCurrentTrackIndex(newIndex);
      } else if (
        currentTrackIndex > oldIndex &&
        currentTrackIndex <= newIndex
      ) {
        setCurrentTrackIndex(currentTrackIndex - 1);
      } else if (
        currentTrackIndex < oldIndex &&
        currentTrackIndex >= newIndex
      ) {
        setCurrentTrackIndex(currentTrackIndex + 1);
      }
    }
  };

  const removeFromQueue = (index: number) => {
    setQueue((q) => q.filter((_, idx) => idx !== index));

    // Update currentTrackIndex
    if (currentTrackIndex !== null) {
      if (index === currentTrackIndex) {
        // If removing currently playing track, the caller (App.tsx) needs to handle stop()
        // Here we just update the index safely
        if (queue.length > 1) {
          setCurrentTrackIndex(index >= queue.length - 1 ? 0 : index);
        } else {
          setCurrentTrackIndex(null);
        }
      } else if (index < currentTrackIndex) {
        setCurrentTrackIndex(currentTrackIndex - 1);
      }
    }
  };

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentTrackIndex(null);
  }, [setCurrentTrackIndex]);

  const updateTrackMetadata = useCallback(
    async (trackPath: string, artist: string, title: string, album: string) => {
      try {
        await invoke("update_metadata", {
          filePath: trackPath,
          artist: artist || null,
          title: title || null,
          album: album || null,
        });

        setQueue((prev) =>
          prev.map((t) => {
            if (t.path === trackPath) {
              return {
                ...t,
                artist: artist || "Unknown Artist",
                title: title || "Unknown",
                album: album || "Unknown Album",
              };
            }
            return t;
          })
        );
        return true;
      } catch (error) {
        console.error("Failed to update metadata:", error);
        throw error;
      }
    },
    []
  );

  // --- Listeners ---
  // We can attach drag/drop listeners here or in App, but here keeps App clean
  // NOTE: If usage of this hook is unmounted, listeners should be cleaned up.
  // App.tsx is root, so it's safe.

  const setupDragDrop = useCallback(() => {
    const unlistenDrop = listen("tauri://drag-drop", (event) => {
      setIsDragging(false);
      const payload = event.payload as { paths: string[] };
      if (payload.paths && payload.paths.length > 0) {
        processPaths(payload.paths);
      }
    });

    const unlistenEnter = listen("tauri://drag-enter", () => {
      setIsDragging(true);
    });

    const unlistenLeave = listen("tauri://drag-leave", () => {
      setIsDragging(false);
    });

    return () => {
      unlistenDrop.then((f) => f());
      unlistenEnter.then((f) => f());
      unlistenLeave.then((f) => f());
    };
  }, [processPaths]);

  return {
    queue,
    setQueue,
    currentTrack,
    currentTrackIndex,
    setCurrentTrackIndex,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
    isLoading,
    isDragging,
    searchQuery,
    setSearchQuery,
    addFiles,
    reorderQueue,
    removeFromQueue,
    clearQueue,
    updateTrackMetadata,
    processPaths,
    setupDragDrop,
  };
};
