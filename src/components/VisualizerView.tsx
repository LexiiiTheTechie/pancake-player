import React, { useRef, useEffect, useCallback } from "react";
import { Track, VisualizerStyle } from "../types";

interface VisualizerViewProps {
  analyser: AnalyserNode | null;
  visualizerStyle: VisualizerStyle;
  currentTrack: Track | null;
  isPlaying: boolean;
  showFps: boolean;
}

const VisualizerView: React.FC<VisualizerViewProps> = ({
  analyser,
  visualizerStyle,
  currentTrack,
  isPlaying,
  showFps,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fpsRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const [fps, setFps] = React.useState(0);

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

      const width = canvas.width;
      const height = canvas.height;

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      if (visualizerStyle === "mirror") {
        // --- MIRRORED STYLE ---
        const barCount = 120;
        const barWidth = width / barCount;
        const center = width / 2;

        for (let i = 0; i < barCount / 2; i++) {
          const index = Math.floor(
            Math.pow(i / (barCount / 2), 1.5) * (bufferLength / 3)
          );
          const value = dataArray[index];

          const percent = value / 255;
          const barHeight = Math.pow(percent, 1.2) * (height * 0.6);

          const hue = 260 - (i / (barCount / 2)) * 60;
          const saturation = 80 + percent * 20;
          const lightness = 50 + percent * 30;

          ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.8)`;
          ctx.shadowBlur = 15;
          ctx.shadowColor = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.5)`;

          // Right Side
          const xRight = center + i * barWidth;
          const y = (height - barHeight) / 2;

          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(xRight + 1, y, barWidth - 2, barHeight, 4);
          } else {
            ctx.rect(xRight + 1, y, barWidth - 2, barHeight);
          }
          ctx.fill();

          // Left Side (Mirrored)
          const xLeft = center - (i + 1) * barWidth;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(xLeft + 1, y, barWidth - 2, barHeight, 4);
          } else {
            ctx.rect(xLeft + 1, y, barWidth - 2, barHeight);
          }
          ctx.fill();
        }
      } else {
        // --- STANDARD STYLE ---
        const barCount = 180;
        const barWidth = width / barCount;

        for (let i = 0; i < barCount; i++) {
          const index = Math.floor(
            Math.pow(i / barCount, 1.7) * (bufferLength / 2.5)
          );
          const value = dataArray[index];

          const percent = value / 255;
          const barHeight = Math.pow(percent, 1.4) * (height * 0.85);

          const hue = 280 - (i / barCount) * 280;
          const saturation = 85;
          const lightness = 50 + percent * 20;

          ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.8)`;
          ctx.shadowBlur = 10;
          ctx.shadowColor = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.4)`;

          const x = i * barWidth;
          const y = height - barHeight;

          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x + 1, y, barWidth - 1, barHeight, 4);
          } else {
            ctx.rect(x + 1, y, barWidth - 1, barHeight);
          }
          ctx.fill();
        }
      }

      ctx.shadowBlur = 0;
    };

    draw();
  }, [analyser, visualizerStyle, isPlaying]);

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
      if (canvasRef.current && canvasRef.current.parentElement) {
        canvasRef.current.width = canvasRef.current.parentElement.clientWidth;
        canvasRef.current.height = canvasRef.current.parentElement.clientHeight;
        // Redraw immediately after resize if playing
        if (isPlaying && analyser) {
          // The loop will handle it, but we might want to ensure context is valid
        }
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [isPlaying, analyser]); // Re-run if these change just to be safe, though mostly for window resize

  return (
    <div className="absolute inset-0 w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* FPS Counter */}
      {showFps && (
        <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-green-400 font-mono text-xs px-2 py-1 rounded border border-green-500/30 z-50">
          FPS: {fps}
        </div>
      )}

      {/* Track Info Overlay in Visualizer */}
      {currentTrack && (
        <div
          className={`
          absolute left-0 right-0 text-center pointer-events-none 
          transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${visualizerStyle === "mirror" ? "top-[calc(100%-8rem)]" : "top-24"}
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
