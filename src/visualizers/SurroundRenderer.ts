import {
  IVisualizerRenderer,
  VisualizerDrawOptions,
} from "./IVisualizerRenderer";
import { VISUALIZER_CONFIG } from "../constants";

export class SurroundRenderer implements IVisualizerRenderer {
  // We need state for smoothing, which persists between frames.
  // In a class, we can just use instance properties.
  private prevSurroundEnergies = new Float32Array(8); // C, L, R, SL, SR, BL, BR, LFE
  private pointsX = new Float32Array(181);
  private pointsY = new Float32Array(181);

  // Static speaker layout for performance
  private static readonly SPEAKER_LAYOUT = [
    { ang: 270, label: "C" },
    { ang: 225, label: "L" },
    { ang: 315, label: "R" },
    { ang: 180, label: "Ls" },
    { ang: 0, label: "Rs" },
    { ang: 135, label: "Rls" },
    { ang: 45, label: "Rrs" },
  ];

  private static degToRad(d: number) {
    return d * (Math.PI / 180);
  }

  private static getEnergy(
    arr: Uint8Array,
    start: number,
    count: number,
    bufferLength: number
  ) {
    let total = 0;
    for (let k = 0; k < count; k++) {
      const idx = Math.min(start + k, bufferLength - 1);
      total += arr[idx] || 0;
    }
    return total / count;
  }

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

    // --- 7.1 SURROUND DATA PROCESSING ---
    const channelData: Uint8Array[] = [];
    if (channels && channels.length >= 2) {
      channels.forEach((ch) => {
        const arr = new Uint8Array(bufferLength);
        ch.getByteFrequencyData(arr as any);
        channelData.push(arr);
      });
    } else {
      channelData.push(dataArray);
      channelData.push(dataArray);
    }

    const getEnergy = (arr: Uint8Array, s: number, c: number) =>
      SurroundRenderer.getEnergy(arr, s, c, bufferLength);

    let isTrueSurround = false;
    if (channelData.length >= 6) {
      if (
        getEnergy(channelData[2], 0, 50) > 10 ||
        getEnergy(channelData[4], 0, 50) > 10
      )
        isTrueSurround = true;
    }

    const dL = channelData[0] || dataArray;
    const dR = channelData[1] || dataArray;
    const dC = isTrueSurround ? channelData[2] : dataArray;
    const dLFE = isTrueSurround ? channelData[3] : dataArray;
    const dSL = isTrueSurround ? channelData[4] : dL;
    const dSR = isTrueSurround ? channelData[5] : dR;
    const dBL = isTrueSurround ? channelData[6] : dL;
    const dBR = isTrueSurround ? channelData[7] : dR;

    const centerX = width / 2;
    const centerY = height / 2;
    const minDim = Math.min(width, height);

    // High frequency energy for ripples
    const highFreqL = getEnergy(dL, 150, 100) / 255;
    const highFreqR = getEnergy(dR, 150, 100) / 255;
    const treble = (highFreqL + highFreqR) / 2;

    const cfg = VISUALIZER_CONFIG.surround;
    const userSensitivity = settings?.visualizer.sensitivity || 1.0;
    const centerSens = settings?.visualizer.centerSensitivity ?? 1.0;
    const lfeSens = settings?.visualizer.lfeSensitivity ?? 1.0;

    // New Advanced Settings
    const lfeCoreSize = settings?.visualizer.lfeCoreSize ?? 0.5;
    const chromaticIntensity = settings?.visualizer.chromaticAberration ?? 1.0;
    const rippleIntensity = settings?.visualizer.rippleIntensity ?? 1.0;
    const showBlastWave = settings?.visualizer.showBlastWave ?? true;
    const showLabels = settings?.visualizer.showLabels ?? true;
    const useReactiveRGB = settings?.visualizer.useReactiveRGB ?? false;

    const userReactivity = settings?.visualizer.reactivity || 0.5;
    const finalReactivity = (1 - userReactivity) * 1.5;

    const norm = (v: number) =>
      Math.pow(v / 255, 1.5) * cfg.sensitivity * userSensitivity;

    const rawE = [
      norm(getEnergy(dC, 5, 50)) * centerSens,
      norm(getEnergy(dL, 0, 100)),
      norm(getEnergy(dR, 0, 100)),
      norm(getEnergy(dSL, 20, 40)),
      norm(getEnergy(dSR, 20, 40)),
      norm(getEnergy(dBL, 60, 40)),
      norm(getEnergy(dBR, 60, 40)),
      norm(getEnergy(dLFE, 0, 6)) * lfeSens,
    ];

    for (let i = 0; i < 8; i++) {
      this.prevSurroundEnergies[i] =
        this.prevSurroundEnergies[i] +
        (rawE[i] - this.prevSurroundEnergies[i]) *
          Math.min(0.99, finalReactivity);
    }

    const eC = this.prevSurroundEnergies[0];
    const eBL = this.prevSurroundEnergies[5];
    const eBR = this.prevSurroundEnergies[6];
    const eLFE = this.prevSurroundEnergies[7];

    // --- COLOR LOGIC ---
    let hue = 180; // Default Cyan
    let secHue = 320; // Default Pink/Magenta

    if (useReactiveRGB) {
      // Cycle speed based on time, kicked by bass
      const time = Date.now() / 20;
      hue = (time + eLFE * 50) % 360;
      secHue = (hue + 180) % 360; // Complementary
    }

    const colPrimary = (a: number) => `hsla(${hue}, 100%, 50%, ${a})`;
    const colSecondary = (a: number) => `hsla(${secHue}, 100%, 50%, ${a})`;
    const colWhite = (a: number) => `rgba(255, 255, 255, ${a})`;

    // Shake logic
    if (enableShake && onShake) {
      const kickImpact = Math.max(0, eLFE - 0.15);
      const snareImpact = Math.max(0, eC - 0.25);
      const hihatImpact = Math.max(0, (eBL + eBR) / 2 - 0.2) * 0.5;
      const totalImpact = kickImpact + snareImpact * 0.7 + hihatImpact * 0.3;

      if (totalImpact > 0.05) {
        onShake(
          (Math.random() - 0.5) * snareImpact * 10,
          kickImpact * 12 + (Math.random() - 0.5) * hihatImpact * 4,
          (Math.random() - 0.5) * totalImpact * 1.5
        );
      } else {
        onShake(0, 0, 0);
      }
    }

    const activeSpeakersPoly = SurroundRenderer.SPEAKER_LAYOUT.map(
      (s, idx) => ({
        ...s,
        val: this.prevSurroundEnergies[idx],
      })
    );

    const rSize = minDim * 0.35;

    // --- DRAW RADAR GRID (Enhanced) ---
    const gridPulse = 1.0 + eLFE * 0.05;
    ctx.strokeStyle = colPrimary(0.1 + eLFE * 0.2);
    ctx.lineWidth = scale(1);

    [0.33, 0.66, 1.0].forEach((s) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, rSize * s * gridPulse, 0, Math.PI * 2);
      ctx.stroke();
    });

    activeSpeakersPoly.forEach((s) => {
      const rad = SurroundRenderer.degToRad(s.ang);
      const startDist = rSize * 0.1;
      const endDist = rSize * gridPulse;

      ctx.beginPath();
      ctx.moveTo(
        centerX + Math.cos(rad) * startDist,
        centerY + Math.sin(rad) * startDist
      );
      ctx.lineTo(
        centerX + Math.cos(rad) * endDist,
        centerY + Math.sin(rad) * endDist
      );
      ctx.stroke();

      // Speaker Dots
      const dX = centerX + Math.cos(rad) * endDist;
      const dY = centerY + Math.sin(rad) * endDist;

      const dotEase = Math.pow(s.val, 0.5);
      ctx.shadowBlur = scale(10 * dotEase);
      ctx.shadowColor = colPrimary(1);
      ctx.fillStyle = s.val > 0.1 ? colWhite(0.5 + dotEase * 0.5) : "#333";
      ctx.beginPath();
      ctx.arc(dX, dY, scale(3 + dotEase * 2), 0, Math.PI * 2);
      ctx.fill();

      // Speaker Labels
      if (showLabels) {
        ctx.shadowBlur = 0;
        const lX_fixed = centerX + Math.cos(rad) * (rSize * 1.15); // Simplified offset
        const lY_fixed = centerY + Math.sin(rad) * (rSize * 1.15);

        ctx.fillStyle =
          s.val > 0.05 ? colPrimary(0.9) : "rgba(255, 255, 255, 0.3)";
        ctx.font = `bold ${scale(10)}px Inter`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(s.label, lX_fixed, lY_fixed);
      }
    });
    ctx.shadowBlur = 0;

    // --- DRAW BLOB SHAPE (Advanced Fidelity) ---
    const resolution = 180;

    for (let i = 0; i <= resolution; i++) {
      const angle = (i / resolution) * Math.PI * 2;
      let totalVal = 0;

      activeSpeakersPoly.forEach((spk) => {
        const spkRad = SurroundRenderer.degToRad(spk.ang);
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

      // Add high-frequency jitter/ripples
      const ripple =
        Math.sin(angle * 40 + Date.now() * 0.01) *
        treble *
        0.03 *
        rippleIntensity;
      const noise = (Math.random() - 0.5) * treble * 0.01 * rippleIntensity;

      totalVal = Math.max(totalVal, eLFE * 0.4) + ripple + noise;
      totalVal = Math.min(1.2, totalVal);

      const r = totalVal * rSize;
      this.pointsX[i] = centerX + Math.cos(angle) * r;
      this.pointsY[i] = centerY + Math.sin(angle) * r;
    }

    // Gradient Fill
    const grad = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      rSize * (1 + eLFE)
    );
    // Use HSLA for gradient
    grad.addColorStop(0, colPrimary(0.1 + eLFE * 0.2));
    grad.addColorStop(0.5, colPrimary(0.2 + eLFE * 0.3));
    grad.addColorStop(1, colPrimary(0));

    const drawPath = (offset: number = 0) => {
      ctx.beginPath();
      ctx.moveTo(this.pointsX[0] + offset, this.pointsY[0]);
      for (let i = 1; i < resolution - 2; i++) {
        const xc = (this.pointsX[i] + this.pointsX[i + 1]) / 2;
        const yc = (this.pointsY[i] + this.pointsY[i + 1]) / 2;
        ctx.quadraticCurveTo(
          this.pointsX[i] + offset,
          this.pointsY[i],
          xc + offset,
          yc
        );
      }
      ctx.closePath();
    };

    // Fill
    drawPath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Chromatic Aberration Outline
    const t = 1.0 + eLFE * 2;
    ctx.lineJoin = "round";

    // Layer 1 (Primary / Cyan-ish)
    ctx.strokeStyle = colPrimary(0.8);
    ctx.lineWidth = scale(t);
    drawPath(scale(-1 * eLFE * chromaticIntensity));
    ctx.stroke();

    // Layer 2 (Secondary / Pink-ish)
    ctx.strokeStyle = colSecondary(0.6);
    ctx.lineWidth = scale(t);
    drawPath(scale(1 * eLFE * chromaticIntensity));
    ctx.stroke();

    // Main White Glow Layer
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = scale(t * 0.5);
    ctx.shadowBlur = scale(15 * eLFE);
    ctx.shadowColor = colPrimary(1);
    drawPath(0);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // --- BLAST WAVE (On Peek LFE) ---
    if (showBlastWave && eLFE > 0.7) {
      const blastR = rSize * (1.0 + (eLFE - 0.7) * 2);
      ctx.beginPath();
      ctx.arc(centerX, centerY, blastR, 0, Math.PI * 2);
      ctx.strokeStyle = colPrimary((0.8 - eLFE) * 0.5);
      ctx.lineWidth = scale(1);
      ctx.stroke();
    }

    // --- LFE CORE (Enhanced) ---
    if (eLFE > 0.02) {
      const lfePulse = 0.15 + eLFE * 0.1;
      const coreR = rSize * lfePulse;

      // Core Glow
      const coreGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        coreR
      );
      coreGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      coreGrad.addColorStop(0.4, colPrimary(0.4));
      coreGrad.addColorStop(1, colPrimary(0));

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreR * 2, 0, Math.PI * 2);
      ctx.fill();

      // Solid Core
      ctx.fillStyle = "white";
      ctx.shadowBlur = scale(20 * eLFE);
      ctx.shadowColor = "white";
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreR * lfeCoreSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.font = `900 ${scale(8 + eLFE * 4)}px Inter`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("LFE", centerX, centerY);
    }
  }
}
