import React from 'react';
import { Plus } from 'lucide-react';

interface DragDropOverlayProps {
  isDragging: boolean;
}

const DragDropOverlay: React.FC<DragDropOverlayProps> = ({ isDragging }) => {
  if (!isDragging) return null;

  return (
    <div className="absolute inset-0 z-50 bg-cyan-500/20 backdrop-blur-sm border-4 border-cyan-500 border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none">
      <div className="bg-gray-900/90 p-8 rounded-2xl flex flex-col items-center shadow-2xl shadow-cyan-500/20 animate-bounce">
        <Plus size={48} className="text-cyan-400 mb-4" />
        <h3 className="text-2xl font-bold text-white">Drop Music Here</h3>
      </div>
    </div>
  );
};

export default DragDropOverlay;
