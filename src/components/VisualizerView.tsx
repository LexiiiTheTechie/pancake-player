import React, { useRef, useEffect, useCallback } from "react";
import { Track, VisualizerStyle } from "../types";

interface VisualizerViewProps {
  analyser: AnalyserNode | null;
  channels?: AnalyserNode[]; // 0-7 for Surround
  visualizerStyle: VisualizerStyle;
  currentTrack: Track | null;
  isPlaying: boolean;
  showFps: boolean;
  enableShake: boolean;
}

const VisualizerView: React.FC<VisualizerViewProps> = ({
  analyser,
  channels,
  visualizerStyle,
  currentTrack,
  isPlaying,
  showFps,
  enableShake,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fpsRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const [fps, setFps] = React.useState(0);

  // Ref for live access inside animation loop without restarting it
  const enableShakeRef = useRef(enableShake);
  useEffect(() => {
    enableShakeRef.current = enableShake;
  }, [enableShake]);

  const drawVisualizer = useCallback(() => {
    // V2: Removed inner ring & refined side bars
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

    // Per-style settings
    const config = {
      standard: { sensitivity: 1.4, reactivity: 0.85 }, // Standard settings
      mirror: { sensitivity: 1, reactivity: 0.8 }, // Higher sensitivity for mirror
      surround: { sensitivity: 1.5, reactivity: 1.6 }, // Lower sensitivity for more stable surround
    };

    // State for smoothing (captured in closure)
    // We need to keep this persistent if possible, but inside useCallback it resets on deps change.
    // Ideally these should be refs, but for now closure is okay if deps don't change too often.
    // Actually, drawVisualizer changes when style changes, so state resets. This is good for per-style reset.

    const prevSurroundEnergies = new Float32Array(8); // C, L, R, SL, SR, BL, BR, LFE

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
      const dpr = window.devicePixelRatio || 1;
      // Use PHYSICAL pixels directly
      const width = canvas.width;
      const height = canvas.height;

      // Helper to scale generic values (radius, font size, linewidth)
      const scale = (v: number) => v * dpr;

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      // Reset transform just in case
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      analyser.getByteFrequencyData(dataArray);

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
          ctx.shadowBlur = scale(15);
          ctx.shadowColor = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.5)`;

          // Right Side
          const xRight = center + i * barWidth;
          const y = (height - barHeight) / 2;

          const gap = scale(2);
          const rad = scale(4);

          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(xRight + 1, y, barWidth - gap, barHeight, rad);
          } else {
            ctx.rect(xRight + 1, y, barWidth - gap, barHeight);
          }
          ctx.fill();

          // Left Side (Mirrored)
          const xLeft = center - (i + 1) * barWidth;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(xLeft + 1, y, barWidth - gap, barHeight, rad);
          } else {
            ctx.rect(xLeft + 1, y, barWidth - gap, barHeight);
          }
          ctx.fill();
        }
      } else if (visualizerStyle === "surround") {
        // --- 7.1 SURROUND STYLE (Hybrid) ---

        // We have 8 potential channels:
        // 0:L, 1:R, 2:C, 3:LFE, 4:SL, 5:SR, 6:BL, 7:BR
        const channelData: Uint8Array[] = [];

        // Fill data
        if (channels && channels.length >= 2) {
          channels.forEach((ch) => {
            const arr = new Uint8Array(bufferLength);
            ch.getByteFrequencyData(arr);
            channelData.push(arr);
          });
        } else {
          // Fallback to mono mixed if something fails
          channelData.push(dataArray); // 0 L (fake)
          channelData.push(dataArray); // 1 R (fake)
        }

        // Helper: Energy
        const getEnergy = (arr: Uint8Array, start: number, count: number) => {
          let total = 0;
          for (let k = 0; k < count; k++) {
            const idx = Math.min(start + k, bufferLength - 1);
            total += arr[idx] || 0;
          }
          return total / count;
        };

        // --- DETECT 7.1 discrete signal ---
        // Check Center/Surround channels for any significant life
        let isTrueSurround = false;
        if (channelData.length >= 6) {
          const checkCh = (idx: number) => getEnergy(channelData[idx], 0, 50);
          // If Center or Side Left has signal > 10 (noise floor)
          if (checkCh(2) > 10 || checkCh(4) > 10) {
            isTrueSurround = true;
          }
        }

        // Channel Maps (Shortcuts)
        const dL = channelData[0] || dataArray;
        const dR = channelData[1] || dataArray;
        // If true surround, use discrete channels. If not, maybe we can simulate?
        // Actually, if we use Channel 2 when silent, it's just silence.
        // So we fallback to MIXED data for center/sub if not discrete.
        const dC = isTrueSurround ? channelData[2] : dataArray; // Center
        const dLFE = isTrueSurround ? channelData[3] : dataArray; // Sub

        // For Simulated Surround (Stereo file):
        // Sides should use L/R but focus on Mids (200Hz - 2kHz)
        // Rears should use L/R but focus on Highs (2kHz+)
        // We can simulate this by reading different frequency ranges if we had access to raw bins.
        // Since getEnergy helps us pick ranges:
        // LFE: 0-60Hz (approx bins 0-10)
        // Center: Mids 250Hz-4kHz
        // Front L/R: Full range
        // Sides: Mids
        // Rears: Highs

        // If not True Surround, we rely on the energy functions to pick ranges below.
        // But for assigning arrays:
        const dSL = isTrueSurround ? channelData[4] : dL;
        const dSR = isTrueSurround ? channelData[5] : dR;
        const dBL = isTrueSurround ? channelData[6] : dL;
        const dBR = isTrueSurround ? channelData[7] : dR;

        const centerX = width / 2;
        const centerY = height / 2;
        const minDim = Math.min(width, height);

        // --- SMOOTHED ENERGIES ---
        const cfg = config.surround;

        // 1. Calculate Energies (Normalized 0-1)
        const norm = (v: number) => Math.pow(v / 255, 1.5) * cfg.sensitivity;

        // Raw targets (Refined for Simulation)
        // If simulated, we pick specific frequency ranges to create separation
        const rawE = [
          norm(getEnergy(dC, 5, 50)), // 0: C (Focus on Mids/Vocals)
          norm(getEnergy(dL, 0, 100)), // 1: L (Full)
          norm(getEnergy(dR, 0, 100)), // 2: R (Full)
          norm(getEnergy(dSL, 20, 40)), // 3: SL (Mids)
          norm(getEnergy(dSR, 20, 40)), // 4: SR (Mids)
          norm(getEnergy(dBL, 60, 40)), // 5: BL (Highs)
          norm(getEnergy(dBR, 60, 40)), // 6: BR (Highs)
          norm(getEnergy(dLFE, 0, 6)), // 7: LFE (Deep Bass only)
        ];

        // Apply Smoothing (Lerp)
        for (let i = 0; i < 8; i++) {
          prevSurroundEnergies[i] =
            prevSurroundEnergies[i] +
            (rawE[i] - prevSurroundEnergies[i]) * cfg.reactivity;
        }

        const eC = prevSurroundEnergies[0];
        const eL = prevSurroundEnergies[1];
        const eR = prevSurroundEnergies[2];
        const eSL = prevSurroundEnergies[3];
        const eSR = prevSurroundEnergies[4];
        const eBL = prevSurroundEnergies[5];
        const eBR = prevSurroundEnergies[6];
        const eLFE = prevSurroundEnergies[7];

        // --- SCREEN SHAKE LOGIC (Musically Aware) ---
        if (containerRef.current) {
          if (enableShakeRef.current) {
            // Kick detection (Deep bass/LFE) - Vertical punch
            const kickImpact = Math.max(0, eLFE - 0.15);

            // Snare/Clap detection (Center Mids) - Lateral shake
            const snareImpact = Math.max(0, eC - 0.25);

            // Hi-hat detection (Use high freq from L+R) - Micro vibration
            // We approximate hi-hats from the treble content
            const hihatImpact = Math.max(0, (eBL + eBR) / 2 - 0.2) * 0.5;

            const totalImpact =
              kickImpact + snareImpact * 0.7 + hihatImpact * 0.3;

            if (totalImpact > 0.05) {
              // Kick = mostly vertical (downward punch)
              const kickY = kickImpact * 12;
              // Snare = lateral shake
              const snareX = (Math.random() - 0.5) * snareImpact * 10;
              // Hi-hat = micro jitter
              const hihatJitter = (Math.random() - 0.5) * hihatImpact * 4;

              const dx = snareX + hihatJitter;
              const dy =
                kickY * (0.8 + Math.random() * 0.4) + hihatJitter * 0.5;
              const rot = (Math.random() - 0.5) * totalImpact * 1.5;

              containerRef.current.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
            } else {
              containerRef.current.style.transform = "none";
            }
          } else {
            containerRef.current.style.transform = "none";
          }
        }

        const degToRad = (d: number) => d * (Math.PI / 180);

        // Standard 7.1 Layout mapping to visual slots (0 deg = Right, CW):
        const activeSpeakersPoly = [
          { ang: 270, val: eC, label: "C" }, // Top
          { ang: 225, val: eL, label: "L" }, // Top Left
          { ang: 315, val: eR, label: "R" }, // Top Right
          { ang: 180, val: eSL, label: "Ls" }, // Left
          { ang: 0, val: eSR, label: "Rs" }, // Right
          { ang: 135, val: eBL, label: "Rls" }, // Rear Left
          { ang: 45, val: eBR, label: "Rrs" }, // Rear Right
        ];

        const rSize = minDim * 0.35; // Radar Radius

        // --- DRAW RADAR GRID ---
        ctx.strokeStyle = "rgba(0, 255, 255, 0.2)";
        ctx.lineWidth = scale(1);

        // Concentric Rings
        [0.33, 0.66, 1.0].forEach((s) => {
          ctx.beginPath();
          ctx.arc(centerX, centerY, rSize * s, 0, Math.PI * 2);
          ctx.stroke();
        });

        // Angle Lines
        activeSpeakersPoly.forEach((s) => {
          const rad = degToRad(s.ang);
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(
            centerX + Math.cos(rad) * rSize,
            centerY + Math.sin(rad) * rSize
          );
          ctx.stroke();

          // Draw Label
          const lX = centerX + Math.cos(rad) * (rSize * 1.15);
          const lY = centerY + Math.sin(rad) * (rSize * 1.15);
          ctx.fillStyle =
            s.val > 0.05
              ? "rgba(0, 255, 255, 0.9)"
              : "rgba(255, 255, 255, 0.3)";
          ctx.font = `bold ${scale(12)}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(s.label, lX, lY);

          // Draw Speaker Dot
          const dX = centerX + Math.cos(rad) * rSize;
          const dY = centerY + Math.sin(rad) * rSize;

          // Glow if active
          if (s.val > 0.1) {
            ctx.shadowBlur = scale(15);
            ctx.shadowColor = "cyan";
            ctx.fillStyle = "white";
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#333";
          }

          ctx.beginPath();
          ctx.arc(dX, dY, scale(4), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0; // reset
        });

        // --- DRAW VECTORSCOPE (Ozone Imager Style) ---

        // 1. Draw Grid (Polar Hemi-sphere/Circle)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = scale(1);

        // Arcs
        [0.25, 0.5, 0.75, 1.0].forEach((r) => {
          ctx.beginPath();
          ctx.arc(centerX, centerY, rSize * r, 0, Math.PI * 2);
          ctx.stroke();
        });

        // Angle lines (45 deg increments)
        for (let i = 0; i < 8; i++) {
          const rad = i * (Math.PI / 4);
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(
            centerX + Math.cos(rad) * rSize,
            centerY + Math.sin(rad) * rSize
          );
          ctx.stroke();
        }

        // 2. Draw Vector Shape
        // We need to construct a smooth polygon from the speaker energies.
        // Ozone uses a lot of points to make it "wiggly" but we can approximate with our 8 channels + interpolation.

        ctx.beginPath();

        // Collect points
        const points: { x: number; y: number }[] = [];

        // We act as if we are drawing a continuous loop around the circle.
        // We'll interpolate between speakers to get that "filled shape" look.
        const resolution = 220; // Steps for smoothness

        for (let i = 0; i <= resolution; i++) {
          const angle = (i / resolution) * Math.PI * 2;

          // Calculate Energy at this exact angle based on speakers (Inverse Distance Weighting)
          let totalVal = 0;

          activeSpeakersPoly.forEach((spk) => {
            const spkRad = degToRad(spk.ang);
            let diff = Math.abs(angle - spkRad);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;

            // Sharper focus = narrower blobs
            // Ozone shapes are quite spikey/defined.
            const influenceWidth = Math.PI / 4;
            if (diff < influenceWidth) {
              // Cosine window for smooth falloff
              const w = Math.pow(
                Math.cos((diff / influenceWidth) * (Math.PI / 2)),
                3
              );
              totalVal += spk.val * w;
            }
          });

          // Add LFE as a base "pump" to the radius (Kick Effect)
          // Boosted from 0.1 to 0.3 for visibility
          totalVal = Math.max(totalVal, eLFE * 0.5);

          // Clamp
          totalVal = Math.min(1.0, totalVal);

          const r = totalVal * rSize;
          const px = centerX + Math.cos(angle) * r;
          const py = centerY + Math.sin(angle) * r;

          points.push({ x: px, y: py });
        }

        // Draw Smooth Curve through points
        if (points.length > 2) {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length - 2; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
          }
          // Close the loop smoothly
          ctx.quadraticCurveTo(
            points[points.length - 2].x,
            points[points.length - 2].y,
            points[points.length - 1].x,
            points[points.length - 1].y
          );
        }

        ctx.closePath();

        // Style: Filled Cyan Blob with Pulse
        // Opacity reacts to Kick (Base 0.3 + LFE * 0.4)
        const fillOp = 0.3 + eLFE * 0.4;
        ctx.fillStyle = `rgba(0, 240, 255, ${fillOp})`;
        ctx.fill();

        // Stroke: Lighter Cyan Outline
        ctx.lineWidth = scale(2 + eLFE * 2); // Thicken on kick
        ctx.strokeStyle = "rgba(100, 255, 255, 0.9)";
        ctx.lineJoin = "round";
        ctx.stroke();

        // 3. Draw LFE Core (Stronger)
        if (eLFE > 0.05) {
          const lfeR = rSize * (0.15 + eLFE * 0.07); // Bigger core
          ctx.beginPath();
          ctx.arc(centerX, centerY, lfeR, 0, Math.PI * 2);
          // Red tint for Bass core
          ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + eLFE * 0.6})`;
          ctx.fill();

          ctx.font = `bold ${scale(10)}px Inter`;
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillText("LFE", centerX, centerY + scale(3));
        }
      } else {
        // --- STANDARD STYLE ---
        // Need to reset transform if switching from surround?
        // Better to do it in effect or safely here
        if (containerRef.current) {
          containerRef.current.style.transform = "none";
        }

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
          ctx.shadowBlur = scale(10);
          ctx.shadowColor = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.4)`;

          const x = i * barWidth;
          const y = height - barHeight;

          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x + 1, y, barWidth - scale(1), barHeight, scale(4));
          } else {
            ctx.rect(x + 1, y, barWidth - scale(1), barHeight);
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
