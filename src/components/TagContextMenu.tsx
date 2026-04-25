import React, { useEffect, useRef } from "react";
import { Star, StarOff } from "lucide-react";

interface TagContextMenuProps {
  x: number;
  y: number;
  tag: string;
  isFavourite: boolean;
  onClose: () => void;
  onToggleFavourite: (tag: string) => void;
}

const TagContextMenu: React.FC<TagContextMenuProps> = ({
  x,
  y,
  tag,
  isFavourite,
  onClose,
  onToggleFavourite,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Clamp menu to viewport
  const menuWidth = 220;
  const menuHeight = 60;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-white/10 rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in duration-100"
      style={{ left: `${clampedX}px`, top: `${clampedY}px`, minWidth: `${menuWidth}px` }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-4 py-1.5 text-xs text-gray-500 font-semibold uppercase tracking-wider border-b border-white/5 mb-1 truncate">
        Tag: {tag}
      </div>
      <button
        onClick={() => {
          onToggleFavourite(tag);
          onClose();
        }}
        className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3"
      >
        {isFavourite ? (
          <>
            <StarOff size={15} className="text-yellow-400" />
            Remove from Favourites
          </>
        ) : (
          <>
            <Star size={15} className="text-yellow-400" />
            Add to Favourites
          </>
        )}
      </button>
    </div>
  );
};

export default TagContextMenu;
