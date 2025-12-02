import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface SavePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

const SavePlaylistModal: React.FC<SavePlaylistModalProps> = ({ isOpen, onClose, onSave }) => {
  const [playlistName, setPlaylistName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPlaylistName('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playlistName.trim()) {
      onSave(playlistName.trim());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Save Playlist</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="playlist-name" className="block text-sm font-medium text-gray-300 mb-2">
              Playlist Name
            </label>
            <input
              id="playlist-name"
              type="text"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="Enter playlist name..."
              autoFocus
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!playlistName.trim()}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SavePlaylistModal;
