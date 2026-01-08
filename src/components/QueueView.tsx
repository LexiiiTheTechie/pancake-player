import React, { useState } from "react";
import { Disc, Save, Trash2, GripVertical } from "lucide-react";
import { Track, AudioFileInfo } from "../types";
import { formatTime } from "../utils";
import ContextMenu from "./ContextMenu";
import MetadataEditorModal from "./MetadataEditorModal";
import FileInfoModal from "./FileInfoModal";
import { invoke } from "@tauri-apps/api/core";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface QueueViewProps {
  queue: Track[];
  currentTrackIndex: number | null;
  isPlaying: boolean;
  playTrack: (index: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  reorderQueue: (oldIndex: number, newIndex: number) => void;
  openSaveModal: () => void;
  addFiles: () => void;
  searchQuery: string;
  updateTrackMetadata: (
    trackPath: string,
    artist: string,
    title: string,
    album: string
  ) => Promise<boolean>;
}

const restrictToVerticalAxis: Modifier = ({ transform }) => {
  return {
    ...transform,
    x: 0,
  };
};

const getFileFormat = (path: string) => {
  const ext = path.split(".").pop();
  return ext ? ext.toUpperCase() : "???";
};

const SortableTrackRow = ({
  track,
  index,
  currentTrackIndex,
  isPlaying,
  playTrack,
  removeFromQueue,
  onContextMenu,
}: {
  track: Track;
  index: number;
  currentTrackIndex: number | null;
  isPlaying: boolean;
  playTrack: (index: number) => void;
  removeFromQueue: (index: number) => void;
  onContextMenu: (e: React.MouseEvent, track: Track, index: number) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : "auto",
    position: isDragging ? ("relative" as const) : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      onClick={() => playTrack(index)}
      onContextMenu={(e) => onContextMenu(e, track, index)}
      className={`
        group border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer
        ${currentTrackIndex === index ? "bg-white/5" : ""}
        ${isDragging ? "bg-white/10 opacity-50" : ""}
      `}
    >
      <td className="py-3 pl-2 w-8">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={16} />
        </button>
      </td>
      <td className="py-3 pl-2 text-sm text-gray-500 group-hover:text-white w-8">
        {currentTrackIndex === index && isPlaying ? (
          <div className="flex gap-0.5 items-end h-3">
            <div className="w-0.5 bg-cyan-400 animate-[bounce_1s_infinite] h-2"></div>
            <div className="w-0.5 bg-cyan-400 animate-[bounce_1.2s_infinite] h-3"></div>
            <div className="w-0.5 bg-cyan-400 animate-[bounce_0.8s_infinite] h-1"></div>
          </div>
        ) : (
          <span className="font-mono">{index + 1}</span>
        )}
      </td>
      <td
        className={`py-3 text-sm font-medium ${
          currentTrackIndex === index ? "text-cyan-400" : "text-white"
        }`}
      >
        {track.title}
      </td>
      <td className="py-3 text-sm text-gray-400">{track.artist}</td>
      <td className="py-3 text-sm text-gray-400">{track.album}</td>
      <td className="py-3 pr-4 text-sm text-gray-500 text-right font-mono">
        {formatTime(track.duration)}
      </td>
      <td className="py-3 px-2 text-xs text-gray-600 font-mono uppercase">
        {getFileFormat(track.path)}
      </td>
      <td className="py-3 w-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeFromQueue(index);
          }}
          className="p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
};

const StaticTrackRow = ({
  track,
  index,
  currentTrackIndex,
  isPlaying,
  playTrack,
  removeFromQueue,
  onContextMenu,
}: {
  track: Track;
  index: number;
  currentTrackIndex: number | null;
  isPlaying: boolean;
  playTrack: (index: number) => void;
  removeFromQueue: (index: number) => void;
  onContextMenu: (e: React.MouseEvent, track: Track, index: number) => void;
}) => {
  return (
    <tr
      onClick={() => playTrack(index)}
      onContextMenu={(e) => onContextMenu(e, track, index)}
      className={`
        group border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer
        ${currentTrackIndex === index ? "bg-white/5" : ""}
      `}
    >
      <td className="py-3 pl-2 w-8">{/* No drag handle for static row */}</td>
      <td className="py-3 pl-2 text-sm text-gray-500 group-hover:text-white w-8">
        {currentTrackIndex === index && isPlaying ? (
          <div className="flex gap-0.5 items-end h-3">
            <div className="w-0.5 bg-cyan-400 animate-[bounce_1s_infinite] h-2"></div>
            <div className="w-0.5 bg-cyan-400 animate-[bounce_1.2s_infinite] h-3"></div>
            <div className="w-0.5 bg-cyan-400 animate-[bounce_0.8s_infinite] h-1"></div>
          </div>
        ) : (
          <span className="font-mono">{index + 1}</span>
        )}
      </td>
      <td
        className={`py-3 text-sm font-medium ${
          currentTrackIndex === index ? "text-cyan-400" : "text-white"
        }`}
      >
        {track.title}
      </td>
      <td className="py-3 text-sm text-gray-400">{track.artist}</td>
      <td className="py-3 text-sm text-gray-400">{track.album}</td>
      <td className="py-3 pr-4 text-sm text-gray-500 text-right font-mono">
        {formatTime(track.duration)}
      </td>
      <td className="py-3 px-2 text-xs text-gray-600 font-mono uppercase">
        {getFileFormat(track.path)}
      </td>
      <td className="py-3 w-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeFromQueue(index);
          }}
          className="p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
};

const QueueView: React.FC<QueueViewProps> = ({
  queue,
  currentTrackIndex,
  isPlaying,
  playTrack,
  removeFromQueue,
  clearQueue,
  reorderQueue,
  openSaveModal,
  addFiles,
  searchQuery,
  updateTrackMetadata,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    track: Track;
    index: number;
  } | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  // File Info Modal State
  const [fileInfoModalOpen, setFileInfoModalOpen] = useState(false);
  const [selectedFileInfo, setSelectedFileInfo] =
    useState<AudioFileInfo | null>(null);
  const [isLoadingFileInfo, setIsLoadingFileInfo] = useState(false);
  const [fileInfoError, setFileInfoError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    // ... (existing drag logic)
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = queue.findIndex((item) => item.id === active.id);
      const newIndex = queue.findIndex((item) => item.id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderQueue(oldIndex, newIndex);
      }
    }
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    track: Track,
    index: number
  ) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, track, index });
  };

  const handleFileInfo = async (track: Track) => {
    setFileInfoModalOpen(true);
    setIsLoadingFileInfo(true);
    setFileInfoError(null);
    setSelectedFileInfo(null);

    try {
      const info = await invoke<AudioFileInfo>("get_audio_file_info", {
        filePath: track.path,
      });
      setSelectedFileInfo(info);
    } catch (err) {
      setFileInfoError(String(err));
    } finally {
      setIsLoadingFileInfo(false);
    }
  };

  const handleSaveMetadata = async (
    artist: string,
    title: string,
    album: string
  ) => {
    // ... (existing save logic)
    if (!editingTrack) return;

    try {
      await updateTrackMetadata(editingTrack.path, artist, title, album);
    } catch (error) {
      throw new Error(String(error));
    }
  };

  const filteredQueue = queue.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.album.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSearching = searchQuery.length > 0;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* ... (existing empty state check) */}
      {queue.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-500">
          <Disc size={64} className="mb-4 opacity-20" />
          <p>Your queue is empty</p>
          <button
            onClick={addFiles}
            className="mt-4 text-cyan-400 hover:underline"
          >
            Add some tracks
          </button>
        </div>
      ) : (
        <>
          <div className="flex justify-end gap-3 mb-4">
            <button
              onClick={clearQueue}
              className="flex items-center gap-2 text-sm font-medium text-red-500/80 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/5"
            >
              <Trash2 size={16} /> Clear Queue
            </button>
            <button
              onClick={openSaveModal}
              className="flex items-center gap-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              <Save size={16} /> Save as Playlist
            </button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                  <th className="pb-3 pl-2 w-8"></th>
                  <th className="pb-3 pl-2 font-medium w-8">#</th>
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Artist</th>
                  <th className="pb-3 font-medium">Album</th>
                  <th className="pb-3 font-medium text-right pr-4">Time</th>
                  <th className="pb-3 font-medium px-2">Format</th>
                  <th className="pb-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {isSearching ? (
                  filteredQueue.map((track) => {
                    const originalIndex = queue.findIndex(
                      (t) => t.id === track.id
                    );
                    return (
                      <StaticTrackRow
                        key={track.id}
                        track={track}
                        index={originalIndex}
                        currentTrackIndex={currentTrackIndex}
                        isPlaying={isPlaying}
                        playTrack={playTrack}
                        removeFromQueue={removeFromQueue}
                        onContextMenu={handleContextMenu}
                      />
                    );
                  })
                ) : (
                  <SortableContext
                    items={queue.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {queue.map((track, i) => (
                      <SortableTrackRow
                        key={track.id}
                        track={track}
                        index={i}
                        currentTrackIndex={currentTrackIndex}
                        isPlaying={isPlaying}
                        playTrack={playTrack}
                        removeFromQueue={removeFromQueue}
                        onContextMenu={handleContextMenu}
                      />
                    ))}
                  </SortableContext>
                )}
              </tbody>
            </table>
          </DndContext>
        </>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onEditMetadata={() => {
            setEditingTrack(contextMenu.track);
            setContextMenu(null);
          }}
          onFileInfo={() => {
            handleFileInfo(contextMenu.track);
            setContextMenu(null);
          }}
          onRemove={() => {
            removeFromQueue(contextMenu.index);
            setContextMenu(null);
          }}
        />
      )}

      <MetadataEditorModal
        isOpen={editingTrack !== null}
        track={editingTrack}
        onClose={() => setEditingTrack(null)}
        onSave={handleSaveMetadata}
      />

      <FileInfoModal
        isOpen={fileInfoModalOpen}
        fileInfo={selectedFileInfo}
        isLoading={isLoadingFileInfo}
        error={fileInfoError}
        onClose={() => setFileInfoModalOpen(false)}
      />
    </div>
  );
};

export default QueueView;
