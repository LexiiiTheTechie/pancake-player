import React, { useEffect, useRef } from "react";
import { Edit3, Trash2, Info } from "lucide-react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onEditMetadata: () => void;
  onFileInfo: () => void;
  onRemove: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onEditMetadata,
  onFileInfo,
  onRemove,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-white/10 rounded-lg shadow-2xl py-1 min-w-[200px] animate-in fade-in zoom-in duration-100"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <button
        onClick={() => {
          onEditMetadata();
          onClose();
        }}
        className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3"
      >
        <Edit3 size={16} className="text-cyan-400" />
        Edit Metadata
      </button>
      <button
        onClick={() => {
          onFileInfo();
          onClose();
        }}
        className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3"
      >
        <Info size={16} className="text-blue-400" />
        File Info
      </button>
      <div className="border-t border-white/5 my-1" />
      <button
        onClick={() => {
          onRemove();
          onClose();
        }}
        className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-white/10 transition-colors flex items-center gap-3"
      >
        <Trash2 size={16} />
        Remove from Queue
      </button>
    </div>
  );
};

export default ContextMenu;
