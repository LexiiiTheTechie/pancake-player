import React, { useRef, useState, useEffect } from "react";
import {
  X,
  Layout,
  Zap,
  Music,
  Aperture,
  RotateCcw,
  Info,
  Sparkles,
} from "lucide-react";
import { useSettings, AppSettings } from "../contexts/SettingsContext";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingInput: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  widthClass?: string;
}> = ({ value, min, max, onChange, widthClass = "w-10" }) => {
  const [inputValue, setInputValue] = useState(value.toString());

  // Keep in sync with external value (from slider/reset)
  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleBlur = () => {
    let num = parseInt(inputValue);
    if (isNaN(num)) num = min;
    const clamped = Math.min(max, Math.max(min, num));
    setInputValue(clamped.toString());
    onChange(clamped);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/10 focus-within:border-cyan-500/50 transition-colors">
      <input
        type="number"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`bg-transparent text-cyan-400 text-sm font-mono ${widthClass} outline-none text-right`}
      />
      <span className="text-cyan-400/50 text-[10px] font-mono">%</span>
    </div>
  );
};

const ResetButton: React.FC<{
  category: keyof AppSettings;
  onReset: (category: keyof AppSettings) => void;
}> = ({ category, onReset }) => (
  <div className="pt-6 mt-6 border-t border-white/5 flex justify-end">
    <button
      onClick={() => onReset(category)}
      className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors group border border-white/5 active:scale-95 whitespace-nowrap min-w-[150px] justify-center"
    >
      <RotateCcw
        size={14}
        className="group-hover:rotate-[-90deg] transition-transform duration-300 flex-shrink-0"
      />
      <span>Reset to Defaults</span>
    </button>
  </div>
);

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    updateVisualizerSettings,
    updatePerVisualizerSettings,
    toggleSetting,
    resetCategory,
    currentStyle,
  } = useSettings();
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState<"visual" | "perf" | "audio">(
    "visual"
  );

  // Animation State
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isConfirmingToggle, setIsConfirmingToggle] = useState(false);
  const [targetHeight, setTargetHeight] = useState<number>(500);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsAnimatingOut(false);
      setIsConfirmingToggle(false);
    } else if (isRendered) {
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsAnimatingOut(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isRendered]);

  // Measure content height whenever activeTab changes
  useEffect(() => {
    if (contentRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        const height = entries[0].target.scrollHeight;
        setTargetHeight(height + 2); // Add buffer to prevent sub-pixel scrollbars
      });
      resizeObserver.observe(contentRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [activeTab, isRendered, settings.visualizer.useIndividualSettings]);

  if (!isRendered) return null;

  const totalHeight = Math.min(window.innerHeight * 0.85, targetHeight + 64);

  const renderVisualizerSection = (
    title: string,
    icon: React.ReactNode,
    vizSettings: {
      sensitivity: number;
      reactivity: number;
      enableShake: boolean;
      centerSensitivity?: number;
      lfeSensitivity?: number;
    },
    onUpdate: (
      newSettings: Partial<{
        sensitivity: number;
        reactivity: number;
        enableShake: boolean;
        centerSensitivity: number;
        lfeSensitivity: number;
      }>
    ) => void,
    isHighlighted: boolean = false,
    showShake: boolean = true,
    recommendation?: string
  ) => (
    <div
      className={`space-y-6 p-6 rounded-2xl border transition-all ${
        isHighlighted
          ? "bg-cyan-500/5 border-cyan-500/20"
          : "bg-white/5 border-white/5"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
          {title}
        </h4>
        {isHighlighted && (
          <span className="text-[10px] bg-cyan-500 text-white px-1.5 py-0.5 rounded ml-auto">
            ACTIVE
          </span>
        )}
      </div>

      {/* Sensitivity */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="space-y-0.5">
            <label className="text-gray-300 text-xs font-semibold flex items-center gap-1.5">
              Sensitivity
              <div className="group relative">
                <Info size={12} className="text-gray-500 cursor-help" />
                <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-gray-800 text-[10px] text-gray-300 rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-20 border border-white/10">
                  Adjusts the input gain. Higher values make the visualizer more
                  reactive to quiet sections.
                </div>
              </div>
            </label>
          </div>
          <SettingInput
            value={Math.round(vizSettings.sensitivity * 100)}
            min={50}
            max={300}
            widthClass="w-10"
            onChange={(val) => onUpdate({ sensitivity: val / 100 })}
          />
        </div>
        <input
          type="range"
          min="0.5"
          max="3.0"
          step="0.05"
          value={vizSettings.sensitivity}
          onChange={(e) =>
            onUpdate({ sensitivity: parseFloat(e.target.value) })
          }
          className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
      </div>

      {/* Smoothing */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="space-y-0.5">
            <label className="text-gray-300 text-xs font-semibold flex items-center gap-1.5">
              Smoothing
              <div className="group relative">
                <Info size={12} className="text-gray-500 cursor-help" />
                <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-gray-800 text-[10px] text-gray-300 rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-20 border border-white/10">
                  Controls the speed of movement. Higher values create a fluid,
                  liquid feel; lower is snappier.
                </div>
              </div>
            </label>
          </div>
          <SettingInput
            value={Math.round(vizSettings.reactivity * 100)}
            min={0}
            max={95}
            widthClass="w-8"
            onChange={(val) => onUpdate({ reactivity: val / 100 })}
          />
        </div>
        <input
          type="range"
          min="0"
          max="0.95"
          step="0.05"
          value={vizSettings.reactivity}
          onChange={(e) => onUpdate({ reactivity: parseFloat(e.target.value) })}
          className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
      </div>

      {/* Center Sensitivity (Surround Only) */}
      {vizSettings.centerSensitivity !== undefined && (
        <div className="space-y-3 pt-2 border-t border-white/5">
          <div className="flex justify-between items-center">
            <label className="text-gray-400 text-xs font-semibold">
              Center Channel Gain
            </label>
            <SettingInput
              value={Math.round(vizSettings.centerSensitivity * 100)}
              min={0}
              max={300}
              widthClass="w-10"
              onChange={(val) => onUpdate({ centerSensitivity: val / 100 })}
            />
          </div>
          <input
            type="range"
            min="0"
            max="3.0"
            step="0.1"
            value={vizSettings.centerSensitivity}
            onChange={(e) =>
              onUpdate({ centerSensitivity: parseFloat(e.target.value) })
            }
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400/50"
          />
        </div>
      )}

      {/* LFE Sensitivity (Surround Only) */}
      {vizSettings.lfeSensitivity !== undefined && (
        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center">
            <label className="text-gray-400 text-xs font-semibold">
              Subwoofer (LFE) Gain
            </label>
            <SettingInput
              value={Math.round(vizSettings.lfeSensitivity * 100)}
              min={0}
              max={300}
              widthClass="w-10"
              onChange={(val) => onUpdate({ lfeSensitivity: val / 100 })}
            />
          </div>
          <input
            type="range"
            min="0"
            max="3.0"
            step="0.1"
            value={vizSettings.lfeSensitivity}
            onChange={(e) =>
              onUpdate({ lfeSensitivity: parseFloat(e.target.value) })
            }
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400/50"
          />
        </div>
      )}

      {recommendation && (
        <p className="flex items-center gap-2 text-[10px] text-cyan-400/80 bg-cyan-400/5 px-2 py-1 rounded-md border border-cyan-400/10">
          <Sparkles size={10} />
          {recommendation}
        </p>
      )}

      {/* Shake Toggle */}
      {showShake && (
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">Screen Shake</span>
          <button
            onClick={() => onUpdate({ enableShake: !vizSettings.enableShake })}
            className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${
              vizSettings.enableShake ? "bg-cyan-500" : "bg-gray-700"
            }`}
          >
            <div
              className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all duration-200 ${
                vizSettings.enableShake ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
      )}
    </div>
  );

  if (!isRendered) return null;

  // Click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300 ${
        isAnimatingOut ? "animate-overlay-out" : "animate-overlay-in"
      }`}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        style={{ height: `${totalHeight}px` }}
        className={`w-full max-w-2xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-[height] duration-200 ease-out ${
          isAnimatingOut ? "animate-modal-out" : "animate-modal-in"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5 h-[64px] flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layout className="w-5 h-5 text-cyan-400" />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-black/20 border-r border-white/5 flex flex-col p-2 gap-1 flex-shrink-0">
            <button
              onClick={() => setActiveTab("visual")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "visual"
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              <Aperture className="w-4 h-4" />
              Visualizer
            </button>
            <button
              onClick={() => setActiveTab("perf")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "perf"
                  ? "bg-purple-500/10 text-purple-400"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              <Zap className="w-4 h-4" />
              Performance
            </button>
            <button
              onClick={() => setActiveTab("audio")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "audio"
                  ? "bg-green-500/10 text-green-400"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              <Music className="w-4 h-4" />
              Audio
            </button>
          </div>

          {/* Tab Content */}
          <div ref={contentRef} className="flex-1 p-8 overflow-y-auto">
            {activeTab === "visual" && (
              <div className="space-y-8 animate-tab-in">
                {/* Visualizer Settings */}
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                      <Aperture className="w-6 h-6 text-cyan-400" />
                      Visualizer Settings
                    </h3>

                    {isConfirmingToggle ? (
                      <div className="flex items-center gap-2 animate-tab-in">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mr-2">
                          Switch Mode?
                        </span>
                        <button
                          onClick={() => {
                            toggleSetting(
                              "visualizer",
                              "useIndividualSettings"
                            );
                            setIsConfirmingToggle(false);
                          }}
                          className="px-4 py-1.5 bg-cyan-500 text-black rounded-lg text-xs font-bold hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setIsConfirmingToggle(false)}
                          className="px-4 py-1.5 bg-white/5 text-gray-400 rounded-lg text-xs font-medium hover:bg-white/10 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsConfirmingToggle(true)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          settings.visualizer.useIndividualSettings
                            ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                            : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                        }`}
                      >
                        {settings.visualizer.useIndividualSettings
                          ? "Individual Mode"
                          : "Global Mode"}
                      </button>
                    )}
                  </div>

                  <div className="grid gap-6">
                    {!settings.visualizer.useIndividualSettings ? (
                      // GLOBAL MODE
                      renderVisualizerSection(
                        "Global Response",
                        <Zap className="w-4 h-4 text-cyan-400" />,
                        {
                          sensitivity: settings.visualizer.sensitivity,
                          reactivity: settings.visualizer.reactivity,
                          enableShake: settings.visualizer.enableShake,
                          centerSensitivity:
                            settings.visualizer.centerSensitivity,
                          lfeSensitivity: settings.visualizer.lfeSensitivity,
                        },
                        (newVals) => updateVisualizerSettings(newVals),
                        true,
                        true,
                        "100% Sensitivity & 40% Smoothing for a standard feel."
                      )
                    ) : (
                      // INDIVIDUAL MODE - CATEGORIES
                      <>
                        {renderVisualizerSection(
                          "Standard Visualizer",
                          <Layout className="w-4 h-4 text-blue-400" />,
                          settings.visualizer.perVisualizer.standard,
                          (newVals) =>
                            updatePerVisualizerSettings("standard", newVals),
                          currentStyle === "standard",
                          false,
                          "Rec: 120% Sensitivity & 40% Smoothing (Punchy & Detailed)"
                        )}
                        {renderVisualizerSection(
                          "Mirror Visualizer",
                          <Aperture className="w-4 h-4 text-purple-400" />,
                          settings.visualizer.perVisualizer.mirror,
                          (newVals) =>
                            updatePerVisualizerSettings("mirror", newVals),
                          currentStyle === "mirror",
                          false,
                          "Rec: 150% Sensitivity & 65% Smoothing (Fluid & Symmetric)"
                        )}
                        {renderVisualizerSection(
                          "Surround Visualizer",
                          <Music className="w-4 h-4 text-green-400" />,
                          settings.visualizer.perVisualizer.surround,
                          (newVals) =>
                            updatePerVisualizerSettings("surround", newVals),
                          currentStyle === "surround",
                          true,
                          "Rec: 100% Sensitivity & 85% Smoothing (Organic & Immersive)"
                        )}
                      </>
                    )}
                  </div>

                  <p className="mt-6 text-xs text-gray-500 italic">
                    {settings.visualizer.useIndividualSettings
                      ? "In Individual Mode, each visualizer remembers its own unique personality."
                      : "In Global Mode, all visualizers share the same physics and gain settings."}
                  </p>

                  <ResetButton category="visualizer" onReset={resetCategory} />
                </section>
              </div>
            )}

            {activeTab === "perf" && (
              <div className="space-y-8 animate-tab-in">
                <section>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-400" />
                    Optimization
                  </h3>
                  <div className="space-y-4">
                    {/* Show FPS */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-gray-200 font-medium">
                        Show FPS Counter
                      </span>
                      <button
                        onClick={() => toggleSetting("visualizer", "showFps")}
                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${
                          settings.visualizer.showFps
                            ? "bg-purple-500"
                            : "bg-gray-700"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-200 ${
                            settings.visualizer.showFps ? "left-7" : "left-1"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Resolution Mode */}
                    <div className="space-y-2 pt-2">
                      <label className="text-gray-300 text-sm font-medium">
                        Rendering Quality
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() =>
                            updateVisualizerSettings({ resolution: "native" })
                          }
                          className={`p-3 rounded-lg border text-sm transition-all ${
                            settings.visualizer.resolution === "native"
                              ? "bg-purple-500/20 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                              : "bg-black/20 border-white/5 text-gray-400 hover:bg-white/5"
                          }`}
                        >
                          Native (High DPI)
                        </button>
                        <button
                          onClick={() =>
                            updateVisualizerSettings({
                              resolution: "efficient",
                            })
                          }
                          className={`p-3 rounded-lg border text-sm transition-all ${
                            settings.visualizer.resolution === "efficient"
                              ? "bg-purple-500/20 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                              : "bg-black/20 border-white/5 text-gray-400 hover:bg-white/5"
                          }`}
                        >
                          Efficient (1x Scale)
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 px-1">
                        Use 'Efficient' if you experience lag on high-resolution
                        (4k) screens.
                      </p>
                    </div>
                  </div>
                  <ResetButton category="visualizer" onReset={resetCategory} />
                </section>
              </div>
            )}

            {activeTab === "audio" && (
              <div className="space-y-8 animate-tab-in">
                <section>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Music className="w-5 h-5 text-green-400" />
                    Playback
                  </h3>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="space-y-1">
                      <span className="text-gray-200 font-medium">
                        Gapless Playback
                      </span>
                      <p className="text-xs text-gray-500">
                        Preload next track for seamless transitions
                      </p>
                    </div>
                    <button
                      onClick={() => toggleSetting("audio", "enableGapless")}
                      className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${
                        settings.audio.enableGapless
                          ? "bg-green-500"
                          : "bg-gray-700"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-200 ${
                          settings.audio.enableGapless ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                  <ResetButton category="audio" onReset={resetCategory} />
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
