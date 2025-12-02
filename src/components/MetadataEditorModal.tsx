import React, { useState, useEffect } from "react";
import { X, Music, Clock } from "lucide-react";
import { Track } from "../types";

interface MetadataEditorModalProps {
  isOpen: boolean;
  track: Track | null;
  onClose: () => void;
  onSave: (artist: string, title: string, album: string) => void;
}

const MetadataEditorModal: React.FC<MetadataEditorModalProps> = ({
  isOpen,
  track,
  onClose,
  onSave,
}) => {
  const [artist, setArtist] = useState("");
  const [title, setTitle] = useState("");
  const [album, setAlbum] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && track) {
      setArtist(track.artist || "");
      setTitle(track.title || "");
      setAlbum(track.album || "");
      setError(null);
    }
  }, [isOpen, track]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!track || !title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(artist.trim(), title.trim(), album.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save metadata");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 max-h-[70vh] flex flex-col overflow-hidden">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col h-full overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5 bg-gray-900/50 shrink-0">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <Music className="text-cyan-400" size={24} />
              Edit Metadata
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="p-5 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
            {error && (
              <div className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-5">
              {/* Read-only fields */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Filename
                  </label>
                  <div className="bg-gray-800/50 border border-white/5 rounded-lg px-4 py-3 text-gray-500 text-sm font-mono truncate">
                    {track.filename}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <Clock size={14} />
                    Duration
                  </label>
                  <div className="bg-gray-800/50 border border-white/5 rounded-lg px-4 py-3 text-gray-500 text-sm font-mono">
                    {formatDuration(track.duration)}
                  </div>
                </div>
              </div>

              {/* Editable fields */}
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter track title..."
                  required
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="artist"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Artist
                </label>
                <input
                  id="artist"
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Enter artist name..."
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="album"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Album
                </label>
                <input
                  id="album"
                  type="text"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  placeholder="Enter album name..."
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
              </div>

              {/* File path info */}
              <div className="pt-4 border-t border-white/5">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  File Path
                </label>
                <div className="bg-gray-800/30 border border-white/5 rounded-lg px-4 py-2 text-gray-600 text-xs font-mono break-all max-h-20 overflow-y-auto">
                  {track.path}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-white/5 bg-gray-900/50 shrink-0">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || isSaving}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MetadataEditorModal;
