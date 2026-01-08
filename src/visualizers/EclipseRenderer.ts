import {
  IVisualizerRenderer,
  VisualizerDrawOptions,
} from "./IVisualizerRenderer";
import { VISUALIZER_CONFIG } from "../constants";

export class EclipseRenderer implements IVisualizerRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    analyser: AnalyserNode,
    dataArray: Uint8Array,
    dims: { width: number; height: number; dpr: number },
    options?: VisualizerDrawOptions
  ) {
    const { width, height, dpr } = dims;
    const { settings } = options || {};
    const bufferLength = analyser.frequencyBinCount;
    const scale = (v: number) => v * dpr;

    analyser.getByteFrequencyData(dataArray as any);

    const centerX = width / 2;
    const centerY = height * 0.6; // Shifted down slightly (was height / 2)
    const minDim = Math.min(width, height);

    // Config
    const baseConfig = VISUALIZER_CONFIG.eclipse;
    const userSensitivity = settings?.visualizer.sensitivity || 1.0;
    const finalSensitivity = baseConfig.sensitivity * userSensitivity;

    // --- Metrics ---
    // Calculate average bass for "pulse"
    let bassTotal = 0;
    const bassCount = Math.floor(bufferLength * 0.1);
    if (bassCount > 0) {
      for (let i = 0; i < bassCount; i++) {
        bassTotal += dataArray[i] || 0;
      }
    }
    const bassAvg = bassCount > 0 ? bassTotal / bassCount / 255 : 0;

    // Core size pulses with bass
    const baseRadius = minDim * 0.15;
    const eclipseRadius =
      baseRadius + bassAvg * minDim * 0.05 * finalSensitivity;

    // --- Draw Rays (Corona) ---
    const rayCount = 120;
    const angleStep = (Math.PI * 2) / rayCount;

    // We want the rays to be symmetrical or continuous around the circle.
    // We'll map the frequency spectrum around the circle.
    // 0 -> PI (Left side), PI -> 2PI (Right side mirrored) gives a nice symmetry.

    ctx.lineCap = "round";

    for (let i = 0; i < rayCount; i++) {
      // Map ray index to frequency index
      // Use a logarithmic mapping for better visuals (focus on lows/mids)
      // Mirror: 0 to rayCount/2, then reverse
      const mirrorIndex = i > rayCount / 2 ? rayCount - i : i;
      const normalizedIndex = mirrorIndex / (rayCount / 2);

      // Logarithmic lookup in dataArray
      // index = floor( (normalizedIndex^1.5) * (bufferLength * 0.7) )
      // Clamp index to be safe
      let dataIndex = Math.floor(
        Math.pow(normalizedIndex, 1.5) * (bufferLength * 0.7)
      );
      if (dataIndex >= bufferLength) dataIndex = bufferLength - 1;

      const val = dataArray[dataIndex] || 0;

      const percent = (val / 255) * finalSensitivity;

      // Ray parameters
      const angle = i * angleStep - Math.PI / 2; // Start top
      const rayLen = minDim * 0.1 + percent * minDim * 0.4;

      const startX = centerX + Math.cos(angle) * (eclipseRadius - scale(2)); // Slight overlap
      const startY = centerY + Math.sin(angle) * (eclipseRadius - scale(2));
      let endX = centerX + Math.cos(angle) * (eclipseRadius + rayLen);
      let endY = centerY + Math.sin(angle) * (eclipseRadius + rayLen);

      // --- Hard Cap for Title Text ---
      // Prevent rays from overlapping the title text at the top (~160px)
      const safeTopY = scale(160);
      if (endY < safeTopY) {
        // Linear interpolation to find x at the safe Y limit
        // We only clip if the start point is below the safe zone (which it should be)
        if (startY > safeTopY) {
          const ratio = (safeTopY - startY) / (endY - startY);
          endX = startX + (endX - startX) * ratio;
          endY = safeTopY;
        } else {
          // If the circle itself is above the text (very small window),
          // we might just not draw or let it be.
          // But usually startY > safeTopY.
        }
      }

      // Color
      // Bass = Cyan, Mids = Blue/Purple, Highs = White
      const hue = 180 + percent * 60 + normalizedIndex * 40; // Cyan -> Blue -> Purple
      const sat = 100;
      const lit = 50 + percent * 40;
      const alpha = 0.4 + percent * 0.6;

      ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${alpha})`;
      ctx.lineWidth = scale(4 + percent * 4);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    // --- Outer Glow Ring ---
    const glowIntensity = bassAvg * finalSensitivity;
    if (glowIntensity > 0.01) {
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        eclipseRadius,
        centerX,
        centerY,
        eclipseRadius + minDim * 0.3
      );
      glowGrad.addColorStop(0, `rgba(0, 255, 255, ${0.4 * glowIntensity})`);
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, eclipseRadius + minDim * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- The Black Void (Eclipse) ---
    ctx.fillStyle = "#000000"; // Pure black
    ctx.shadowBlur = scale(20 * bassAvg);
    ctx.shadowColor = "rgba(0, 255, 255, 0.5)"; // Cyan shadow

    ctx.beginPath();
    ctx.arc(centerX, centerY, eclipseRadius, 0, Math.PI * 2);
    ctx.fill();

    // Rim Light (thin bright circle around the void)
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + bassAvg * 0.7})`;
    ctx.lineWidth = scale(2);
    ctx.shadowBlur = scale(10);
    ctx.shadowColor = "white";
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset
  }
}
