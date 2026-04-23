import {
  IVisualizerRenderer,
  VisualizerDrawOptions,
} from "./IVisualizerRenderer";
import { VISUALIZER_CONFIG } from "../constants";

export class MirrorRenderer implements IVisualizerRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    analyser: AnalyserNode,
    dataArray: Uint8Array,
    dims: { width: number; height: number; dpr: number },
    options?: VisualizerDrawOptions
  ) {
    const { width, height, dpr } = dims;
    const bufferLength = analyser.frequencyBinCount;

    analyser.getByteFrequencyData(dataArray as any);

    const barCount = 120;
    const barWidth = width / barCount;
    const center = width / 2;
    const scale = (v: number) => v * dpr;

    // Get Settings
    const baseConfig = VISUALIZER_CONFIG.mirror;
    const userSensitivity = options?.settings?.visualizer.sensitivity || 1.0;
    const finalSensitivity = baseConfig.sensitivity * userSensitivity;

    for (let i = 0; i < barCount / 2; i++) {
      const index = Math.floor(
        Math.pow(i / (barCount / 2), 1.5) * (bufferLength / 3)
      );
      const value = dataArray[index] || 0;

      const percent = (value / 255) * finalSensitivity;
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
  }
}
