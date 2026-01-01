import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { Track, VisualizerStyle } from "../types";

import { IVisualizerRenderer } from "../visualizers/IVisualizerRenderer";
import { StandardRenderer } from "../visualizers/StandardRenderer";
import { MirrorRenderer } from "../visualizers/MirrorRenderer";
import { SurroundRenderer } from "../visualizers/SurroundRenderer";
import { useSettings } from "../contexts/SettingsContext";

interface VisualizerViewProps {
  analyser: AnalyserNode | null;
  channels?: AnalyserNode[]; // 0-7 for Surround
  visualizerStyle: VisualizerStyle;
  currentTrack: Track | null;
  isPlaying: boolean;
}

const VisualizerView: React.FC<VisualizerViewProps> = ({
  analyser,
  channels,
  visualizerStyle,
  currentTrack,
  isPlaying,
}) => {
  const { settings, visualizerSettings } = useSettings();
  const { showFps } = settings.visualizer;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fpsRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const [fps, setFps] = React.useState(0);

  // Ref for live access inside animation loop without restarting it
  const settingsRef = useRef(settings);
  const visualizerSettingsRef = useRef(visualizerSettings);

  useEffect(() => {
    settingsRef.current = settings;
    visualizerSettingsRef.current = visualizerSettings;

    // Sync Analyser Smoothing
    if (analyser) {
      analyser.smoothingTimeConstant = visualizerSettings.reactivity;
    }
  }, [settings, visualizerSettings, analyser]);

  // --- Initialize Renderers ---
  // We memorize them so state (like smooth energy) persists across re-renders
  const renderers = useMemo<Record<VisualizerStyle, IVisualizerRenderer>>(
    () => ({
      standard: new StandardRenderer(),
      mirror: new MirrorRenderer(),
      surround: new SurroundRenderer(),
    }),
    []
  );

  const drawVisualizer = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Cancel any existing loop before starting a new one
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      // Check if we should still be drawing
      if (!isPlaying) return;

      // FPS Calculation
      const now = performance.now();
      frameCountRef.current++;
      if (now - lastTimeRef.current >= 1000) {
        fpsRef.current = Math.round(
          (frameCountRef.current * 1000) / (now - lastTimeRef.current)
        );
        setFps(fpsRef.current);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      animationFrameRef.current = requestAnimationFrame(draw);

      const currentSettings = settingsRef.current;
      const dpr =
        currentSettings.visualizer.resolution === "native"
          ? window.devicePixelRatio || 1
          : 1;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

      // Reset shake transform before each frame.
      // Renderers that support shake (like Surround) will re-apply it via onShake.
      if (containerRef.current) {
        containerRef.current.style.transform = "none";
      }

      const renderer = renderers[visualizerStyle];
      if (renderer) {
        // Create a "patched" settings object with effective visualizer values
        const effectiveSettings = {
          ...currentSettings,
          visualizer: {
            ...currentSettings.visualizer,
            ...visualizerSettingsRef.current,
          },
        };

        renderer.draw(
          ctx,
          analyser,
          dataArray,
          { width, height, dpr },
          {
            channels,
            enableShake: visualizerSettingsRef.current.enableShake,
            settings: effectiveSettings, // Pass patched settings
            onShake: (dx: number, dy: number, rot: number) => {
              if (containerRef.current) {
                if (dx === 0 && dy === 0 && rot === 0) {
                  containerRef.current.style.transform = "none";
                } else {
                  containerRef.current.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
                }
              }
            },
          }
        );
      } else {
        // Fallback if somehow style is invalid, reset transform
        if (containerRef.current) {
          containerRef.current.style.transform = "none";
        }
      }
    };

    draw();
  }, [analyser, visualizerStyle, isPlaying, renderers, channels]); // Added channels dependency

  // Start/Stop animation loop
  useEffect(() => {
    if (isPlaying && analyser) {
      drawVisualizer();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, analyser, drawVisualizer]);

  // Canvas Resize
  useEffect(() => {
    const handleResize = () => {
      const parent =
        containerRef.current?.parentElement || containerRef.current;
      if (canvasRef.current && parent) {
        const dpr = window.devicePixelRatio || 1;
        const rect = parent.getBoundingClientRect();

        // Exact integer physical pixels
        canvasRef.current.width = Math.round(rect.width * dpr);
        canvasRef.current.height = Math.round(rect.height * dpr);

        // Enforce logical size via style to prevent browser stretching
        canvasRef.current.style.width = `${rect.width}px`;
        canvasRef.current.style.height = `${rect.height}px`;
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [isPlaying, analyser]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {/* SHAKE CONTAINER */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full will-change-transform"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* STATIC UI */}
      {showFps && (
        <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-green-400 font-mono text-xs px-2 py-1 rounded border border-green-500/30 z-50 pointer-events-none">
          FPS: {fps}
        </div>
      )}

      {/* Track Info */}
      {currentTrack && (
        <div
          ref={titleRef}
          className={`
          absolute left-0 right-0 text-center pointer-events-none 
          transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${
            visualizerStyle === "mirror" || visualizerStyle === "surround"
              ? "top-[calc(100%-8rem)]"
              : "top-24"
          }
        `}
        >
          <h2 className="text-3xl font-bold text-white text-glow mb-2">
            {currentTrack.title}
          </h2>
          <p className="text-xl text-cyan-400/80">{currentTrack.artist}</p>
        </div>
      )}
    </div>
  );
};

export default VisualizerView;
