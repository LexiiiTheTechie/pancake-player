import {
  IVisualizerRenderer,
  VisualizerDrawOptions,
} from "./IVisualizerRenderer";
import { VISUALIZER_CONFIG } from "../constants";

export class StandardRenderer implements IVisualizerRenderer {
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

    const barCount = 180;
    const barWidth = width / barCount;

    // Scale helper
    const scale = (v: number) => v * dpr;

    // Get Settings
    const baseConfig = VISUALIZER_CONFIG.standard;
    const sensitivity = options?.settings?.visualizer.sensitivity || 1.0;
    // We combine the base config hardcoded multiplier with the user setting
    const finalSensitivity = baseConfig.sensitivity * sensitivity;

    for (let i = 0; i < barCount; i++) {
      const index = Math.floor(
        Math.pow(i / barCount, 1.7) * (bufferLength / 2.5)
      );
      const value = dataArray[index] || 0;

      const percent = (value / 255) * finalSensitivity;
      // Clamp max height to screen height - 230px (for top title text) or 80% whichever is smaller
      const maxBarHeight = Math.min(height * 0.8, height - 230);

      // Use higher power (e.g. 2.5) to give it more dynamic range and prevent "wall of bricks" look
      // This suppresses low noise and makes peaks punchy
      let barHeight = Math.pow(percent, 2.5) * maxBarHeight;

      if (barHeight > maxBarHeight) barHeight = maxBarHeight;

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

    ctx.shadowBlur = 0;
  }
}
