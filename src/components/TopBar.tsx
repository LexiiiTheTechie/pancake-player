import React from "react";
import { Search, Music2, Home as HomeIcon, Plus, Settings } from "lucide-react";
import { Tab, VisualizerStyle } from "../types";

interface TopBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  visualizerStyle: VisualizerStyle;
  setVisualizerStyle: (style: VisualizerStyle) => void;
  addFiles: () => void;
  onVisualizerClick: () => void;
  onSettingsClick: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  visualizerStyle,
  setVisualizerStyle,
  addFiles,
  onVisualizerClick,
  onSettingsClick,
}) => {
  return (
    <>
      <div className="h-16 flex items-center justify-between px-6 bg-black/20 backdrop-blur-md border-b border-white/5 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Music2 size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Pancake
          </span>
        </div>

        <div className="flex-1 max-w-md mx-6 relative group">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-cyan-400 transition-colors"
            size={16}
          />
          <input
            type="text"
            placeholder="Search library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:bg-white/10 focus:border-cyan-500/50 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("home")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "home"
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <HomeIcon size={16} /> Home
          </button>
          <button
            onClick={() => setActiveTab("queue")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeTab === "queue"
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Library
          </button>
          <button
            onClick={() => {
              setActiveTab("visualizer");
              onVisualizerClick();
            }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeTab === "visualizer"
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Visualizer
          </button>

          {/* Visualizer Toggle (Only visible when visualizer tab is active) */}
          {activeTab === "visualizer" && (
            <div className="flex items-center bg-white/5 rounded-full p-1 ml-2 border border-white/5">
              <button
                onClick={() => setVisualizerStyle("mirror")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  visualizerStyle === "mirror"
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Mirror
              </button>
              <button
                onClick={() => setVisualizerStyle("standard")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  visualizerStyle === "standard"
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => setVisualizerStyle("surround")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  visualizerStyle === "surround"
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Surround
              </button>
            </div>
          )}

          {/* Settings Button */}
          <button
            onClick={onSettingsClick}
            className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors ml-2"
          >
            <Settings size={20} />
          </button>

          <button
            onClick={addFiles}
            className="ml-4 bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-1.5 rounded-full text-sm font-bold transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Add Music
          </button>
        </div>
      </div>
    </>
  );
};

export default TopBar;
