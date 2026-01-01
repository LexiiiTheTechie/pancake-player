import {
  IVisualizerRenderer,
  VisualizerDrawOptions,
} from "./IVisualizerRenderer";
import { VISUALIZER_CONFIG } from "../constants";

export class SurroundRenderer implements IVisualizerRenderer {
  // We need state for smoothing, which persists between frames.
  // In a class, we can just use instance properties.
  private prevSurroundEnergies = new Float32Array(8); // C, L, R, SL, SR, BL, BR, LFE

  draw(
    ctx: CanvasRenderingContext2D,
    analyser: AnalyserNode,
    dataArray: Uint8Array,
    dims: { width: number; height: number; dpr: number },
    options?: VisualizerDrawOptions
  ) {
    const { width, height, dpr } = dims;
    const { channels, enableShake, onShake, settings } = options || {};
    const bufferLength = analyser.frequencyBinCount;
    const scale = (v: number) => v * dpr;

    analyser.getByteFrequencyData(dataArray as any);

    // --- 7.1 SURROUND STYLE (Hybrid) ---

    // We have 8 potential channels:
    // 0:L, 1:R, 2:C, 3:LFE, 4:SL, 5:SR, 6:BL, 7:BR
    const channelData: Uint8Array[] = [];

    // Fill data
    if (channels && channels.length >= 2) {
      channels.forEach((ch) => {
        const arr = new Uint8Array(bufferLength);
        ch.getByteFrequencyData(arr as any);
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

    // Fallback logic
    const dC = isTrueSurround ? channelData[2] : dataArray; // Center
    const dLFE = isTrueSurround ? channelData[3] : dataArray; // Sub
    const dSL = isTrueSurround ? channelData[4] : dL;
    const dSR = isTrueSurround ? channelData[5] : dR;
    const dBL = isTrueSurround ? channelData[6] : dL;
    const dBR = isTrueSurround ? channelData[7] : dR;

    const centerX = width / 2;
    const centerY = height / 2;
    const minDim = Math.min(width, height);

    // --- SMOOTHED ENERGIES ---
    const cfg = VISUALIZER_CONFIG.surround;
    const userSensitivity = settings?.visualizer.sensitivity || 1.0;
    const centerSens = settings?.visualizer.centerSensitivity ?? 1.0;
    const lfeSens = settings?.visualizer.lfeSensitivity ?? 1.0;
    const userReactivity = settings?.visualizer.reactivity || 0.5;
    const finalReactivity = (1 - userReactivity) * 1.5;

    // 1. Calculate Energies (Normalized 0-1)
    const norm = (v: number) =>
      Math.pow(v / 255, 1.5) * cfg.sensitivity * userSensitivity;

    // Raw targets (Refined for Simulation)
    const rawE = [
      norm(getEnergy(dC, 5, 50)) * centerSens, // 0: C (Focus on Mids/Vocals)
      norm(getEnergy(dL, 0, 100)), // 1: L (Full)
      norm(getEnergy(dR, 0, 100)), // 2: R (Full)
      norm(getEnergy(dSL, 20, 40)), // 3: SL (Mids)
      norm(getEnergy(dSR, 20, 40)), // 4: SR (Mids)
      norm(getEnergy(dBL, 60, 40)), // 5: BL (Highs)
      norm(getEnergy(dBR, 60, 40)), // 6: BR (Highs)
      norm(getEnergy(dLFE, 0, 6)) * lfeSens, // 7: LFE (Deep Bass only)
    ];

    // Apply Smoothing (Lerp)
    for (let i = 0; i < 8; i++) {
      this.prevSurroundEnergies[i] =
        this.prevSurroundEnergies[i] +
        (rawE[i] - this.prevSurroundEnergies[i]) *
          Math.min(0.99, finalReactivity);
    }

    const [eC, eL, eR, eSL, eSR, eBL, eBR, eLFE] = this.prevSurroundEnergies;

    // --- SCREEN SHAKE LOGIC ---
    if (enableShake && onShake) {
      // Kick detection (Deep bass/LFE) - Vertical punch
      const kickImpact = Math.max(0, eLFE - 0.15);
      // Snare/Clap detection (Center Mids) - Lateral shake
      const snareImpact = Math.max(0, eC - 0.25);
      // Hi-hat detection (Use high freq from L+R) - Micro vibration
      const hihatImpact = Math.max(0, (eBL + eBR) / 2 - 0.2) * 0.5;

      const totalImpact = kickImpact + snareImpact * 0.7 + hihatImpact * 0.3;

      if (totalImpact > 0.05) {
        const kickY = kickImpact * 12;
        const snareX = (Math.random() - 0.5) * snareImpact * 10;
        const hihatJitter = (Math.random() - 0.5) * hihatImpact * 4;

        const dx = snareX + hihatJitter;
        const dy = kickY * (0.8 + Math.random() * 0.4) + hihatJitter * 0.5;
        const rot = (Math.random() - 0.5) * totalImpact * 1.5;

        onShake(dx, dy, rot);
      } else {
        onShake(0, 0, 0);
      }
    } else if (onShake) {
      onShake(0, 0, 0);
    }

    const degToRad = (d: number) => d * (Math.PI / 180);

    // Standard 7.1 Layout mapping
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
        s.val > 0.05 ? "rgba(0, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.3)";
      ctx.font = `bold ${scale(12)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.label, lX, lY);

      // Draw Speaker Dot
      const dX = centerX + Math.cos(rad) * rSize;
      const dY = centerY + Math.sin(rad) * rSize;

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

    // --- DRAW VECTORSCOPE ---
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = scale(1);

    // Grid
    [0.25, 0.5, 0.75, 1.0].forEach((r) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, rSize * r, 0, Math.PI * 2);
      ctx.stroke();
    });

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

    // Blob Shape
    ctx.beginPath();
    const points: { x: number; y: number }[] = [];
    const resolution = 220;

    for (let i = 0; i <= resolution; i++) {
      const angle = (i / resolution) * Math.PI * 2;
      let totalVal = 0;

      activeSpeakersPoly.forEach((spk) => {
        const spkRad = degToRad(spk.ang);
        let diff = Math.abs(angle - spkRad);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;

        const influenceWidth = Math.PI / 4;
        if (diff < influenceWidth) {
          const w = Math.pow(
            Math.cos((diff / influenceWidth) * (Math.PI / 2)),
            3
          );
          totalVal += spk.val * w;
        }
      });

      totalVal = Math.max(totalVal, eLFE * 0.5);
      totalVal = Math.min(1.0, totalVal);

      const r = totalVal * rSize;
      const px = centerX + Math.cos(angle) * r;
      const py = centerY + Math.sin(angle) * r;

      points.push({ x: px, y: py });
    }

    if (points.length > 2) {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 2; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.quadraticCurveTo(
        points[points.length - 2].x,
        points[points.length - 2].y,
        points[points.length - 1].x,
        points[points.length - 1].y
      );
    }

    ctx.closePath();
    const fillOp = 0.3 + eLFE * 0.4;
    ctx.fillStyle = `rgba(0, 240, 255, ${fillOp})`;
    ctx.fill();

    ctx.lineWidth = scale(2 + eLFE * 2);
    ctx.strokeStyle = "rgba(100, 255, 255, 0.9)";
    ctx.lineJoin = "round";
    ctx.stroke();

    // LFE Core
    if (eLFE > 0.05) {
      const lfeR = rSize * (0.15 + eLFE * 0.07);
      ctx.beginPath();
      ctx.arc(centerX, centerY, lfeR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + eLFE * 0.6})`;
      ctx.fill();

      ctx.font = `bold ${scale(10)}px Inter`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillText("LFE", centerX, centerY + scale(3));
    }
  }
}
