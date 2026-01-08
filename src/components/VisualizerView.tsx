import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { Track, VisualizerStyle } from "../types";

import { IVisualizerRenderer } from "../visualizers/IVisualizerRenderer";
import { StandardRenderer } from "../visualizers/StandardRenderer";
import { MirrorRenderer } from "../visualizers/MirrorRenderer";
import { SurroundRenderer } from "../visualizers/SurroundRenderer";
import { EclipseRenderer } from "../visualizers/EclipseRenderer";
import { ShatterRenderer } from "../visualizers/ShatterRenderer";
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

  // --- Initialize Renderer ---
  // We recreate the renderer whenever the style changes to reset its internal state (animations, etc.)
  const renderer = useMemo<IVisualizerRenderer | null>(() => {
    switch (visualizerStyle) {
      case "standard":
        return new StandardRenderer();
      case "mirror":
        return new MirrorRenderer();
      case "surround":
        return new SurroundRenderer();
      case "eclipse":
        return new EclipseRenderer();
      case "shatter":
        return new ShatterRenderer();
      default:
        return null;
    }
  }, [visualizerStyle]);

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

      if (renderer) {
        // Create a "patched" settings object with effective visualizer values
        const effectiveSettings = {
          ...currentSettings,
          visualizer: {
            ...currentSettings.visualizer,
            ...visualizerSettingsRef.current,
          },
        };

        try {
          renderer.draw(
            ctx,
            analyser,
            dataArray,
            { width, height, dpr },
            {
              channels: channels || [],
              enableShake: visualizerSettingsRef.current.enableShake,
              settings: effectiveSettings, // Pass patched settings
              onShake: (dx, dy, rot) => {
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
        } catch (e) {
          console.error(e);
        }
      } else {
        // Fallback if somehow style is invalid, reset transform
        if (containerRef.current) {
          containerRef.current.style.transform = "none";
        }
      }
    };

    draw();
  }, [analyser, visualizerStyle, isPlaying, renderer, channels]);

  // Start/Stop animation loop
  useEffect(() => {
    if (isPlaying && analyser) {
      drawVisualizer();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Draw Inactive Frame (Zero Energy)
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        // Instantiate a fresh renderer to ensure no smoothing state persists (force zero state)
        let renderer = null;
        switch (visualizerStyle) {
          case "standard":
            renderer = new StandardRenderer();
            break;
          case "mirror":
            renderer = new MirrorRenderer();
            break;
          case "surround":
            renderer = new SurroundRenderer();
            break;
          case "eclipse":
            renderer = new EclipseRenderer();
            break;
          case "shatter":
            renderer = new ShatterRenderer();
            break;
        }

        if (renderer) {
          // Clear and Reset
          const width = canvas.width;
          const height = canvas.height;
          const dpr =
            settingsRef.current.visualizer.resolution === "native"
              ? window.devicePixelRatio || 1
              : 1;

          ctx.clearRect(0, 0, width, height);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          if (containerRef.current)
            containerRef.current.style.transform = "none";

          // Force use of a Mock Analyser to ensure we draw a purely "idle" state
          // We ignore the real analyser to prevent accessing the AudioContext while it might be suspending,
          // and to guarantee the renderer receives exactly zeroed data for the idle look.
          const mockAnalyser = {
            frequencyBinCount: analyser ? analyser.frequencyBinCount : 2048,
            getByteFrequencyData: (arr: Uint8Array) => {
              // Explicitly zero out the data to guarantee idle state
              arr.fill(0);
            },
          } as AnalyserNode;

          // Draw with Zero Data
          const zeroData = new Uint8Array(mockAnalyser.frequencyBinCount);
          mockAnalyser.getByteFrequencyData(zeroData); // Ensure it's zeroed

          const effectiveSettings = {
            ...settingsRef.current,
            visualizer: {
              ...settingsRef.current.visualizer,
              ...visualizerSettingsRef.current,
            },
          };

          try {
            renderer.draw(
              ctx,
              mockAnalyser,
              zeroData,
              { width, height, dpr },
              {
                channels: [], // Force empty channels to use zeroData
                enableShake: false,
                settings: effectiveSettings,
                onShake: () => {},
              }
            );
            console.log("Visualizer: Drew inactive frame");
          } catch (e) {
            console.error("Visualizer: Failed to draw inactive frame", e);
          }
        }
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, analyser, drawVisualizer, visualizerStyle, channels]);

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
              : visualizerStyle === "eclipse"
              ? "top-12"
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
