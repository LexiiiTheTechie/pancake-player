import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { X, Minus, Square } from 'lucide-react';

const TitleBar: React.FC = () => {
  const appWindow = getCurrentWindow();

  const minimize = () => appWindow.minimize();
  const toggleMaximize = () => appWindow.toggleMaximize();
  const close = () => appWindow.close();

  return (
    <div 
      data-tauri-drag-region 
      className="h-8 bg-gray-950 flex items-center justify-between select-none fixed top-0 left-0 right-0 z-50 border-b border-white/5"
    >
      <div className="flex items-center px-4 pointer-events-none">
        <span className="text-xs font-medium text-gray-400 tracking-wider">PANCAKE PLAYER</span>
      </div>

      <div className="flex h-full">
        <button 
          onClick={minimize}
          className="h-full w-10 flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <Minus size={16} />
        </button>
        <button 
          onClick={toggleMaximize}
          className="h-full w-10 flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <Square size={14} />
        </button>
        <button 
          onClick={close}
          className="h-full w-10 flex items-center justify-center hover:bg-red-500 text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
