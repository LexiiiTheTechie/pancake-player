import React from "react";
import { X, FileAudio, Clock, HardDrive, Music2, Layers } from "lucide-react";
import { AudioFileInfo } from "../types";
import { formatTime } from "../utils";

interface FileInfoModalProps {
  isOpen: boolean;
  fileInfo: AudioFileInfo | null;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
}

const FileInfoModal: React.FC<FileInfoModalProps> = ({
  isOpen,
  fileInfo,
  onClose,
  isLoading,
  error,
}) => {
  if (!isOpen) return null;

  const formatSize = (bytes: number) => {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 max-h-[70vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-gray-900/50 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <FileAudio className="text-cyan-400" size={24} />
            File Information
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          ) : fileInfo ? (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <HardDrive size={14} /> File Size
                  </div>
                  <div className="text-white font-mono text-lg">
                    {formatSize(fileInfo.size_bytes)}
                  </div>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <Clock size={14} /> Duration
                  </div>
                  <div className="text-white font-mono text-lg">
                    {formatTime(fileInfo.duration)}
                  </div>
                </div>
              </div>

              {/* Audio Properties */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Music2 size={16} /> Audio Properties
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-gray-800/30 p-3 rounded-lg border border-white/5">
                    <div className="text-gray-500 text-xs mb-1">Format</div>
                    <div className="text-cyan-400 font-mono font-medium">
                      {fileInfo.format}
                    </div>
                  </div>
                  <div className="bg-gray-800/30 p-3 rounded-lg border border-white/5">
                    <div className="text-gray-500 text-xs mb-1">Codec</div>
                    <div
                      className="text-white font-mono text-sm truncate"
                      title={fileInfo.codec}
                    >
                      {fileInfo.codec}
                    </div>
                  </div>
                  <div className="bg-gray-800/30 p-3 rounded-lg border border-white/5">
                    <div className="text-gray-500 text-xs mb-1">
                      Sample Rate
                    </div>
                    <div className="text-white font-mono text-sm">
                      {fileInfo.sample_rate
                        ? `${fileInfo.sample_rate} Hz`
                        : "N/A"}
                    </div>
                  </div>
                  <div className="bg-gray-800/30 p-3 rounded-lg border border-white/5">
                    <div className="text-gray-500 text-xs mb-1">Channels</div>
                    <div className="text-white font-mono text-sm">
                      {fileInfo.channels || "N/A"}
                    </div>
                  </div>
                  <div className="bg-gray-800/30 p-3 rounded-lg border border-white/5">
                    <div className="text-gray-500 text-xs mb-1">Bit Depth</div>
                    <div className="text-white font-mono text-sm">
                      {fileInfo.bit_depth ? `${fileInfo.bit_depth}-bit` : "N/A"}
                    </div>
                  </div>
                  <div className="bg-gray-800/30 p-3 rounded-lg border border-white/5">
                    <div className="text-gray-500 text-xs mb-1">Bitrate</div>
                    <div className="text-white font-mono text-sm">
                      {fileInfo.bitrate
                        ? `${Math.round(fileInfo.bitrate / 1000)} kbps`
                        : "N/A"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Layers size={16} /> Metadata
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Title
                    </label>
                    <div className="bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                      {fileInfo.title || (
                        <span className="text-gray-600 italic">No title</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Artist
                      </label>
                      <div className="bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                        {fileInfo.artist || (
                          <span className="text-gray-600 italic">
                            No artist
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Album
                      </label>
                      <div className="bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                        {fileInfo.album || (
                          <span className="text-gray-600 italic">No album</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Path */}
              <div className="pt-4 border-t border-white/5">
                <label className="block text-xs text-gray-500 mb-2">
                  Full Path
                </label>
                <div className="bg-black/30 border border-white/5 rounded-lg px-3 py-2 text-gray-500 text-xs font-mono break-all">
                  {fileInfo.path}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 bg-gray-900/50 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileInfoModal;
