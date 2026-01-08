import {
  IVisualizerRenderer,
  VisualizerDrawOptions,
} from "./IVisualizerRenderer";
import { VISUALIZER_CONFIG } from "../constants";

interface Shard {
  angle: number; // Polar angle
  dist: number; // Initial distance from center
  size: number;
  rotationOffset: number;
  color: string;
  speed: number; // Rotation speed multiplier
  points: number[]; // Polygon vertices relative to shard center
}

export class ShatterRenderer implements IVisualizerRenderer {
  private shards: Shard[] = [];
  private time: number = 0;

  constructor() {
    this.initShards();
  }

  private initShards() {
    this.shards = [];
    const count = 40;

    for (let i = 0; i < count; i++) {
      // Random polygon (triangle or quad)
      const points = [];
      const validPoints = 3 + Math.floor(Math.random() * 2); // 3 or 4 points
      for (let p = 0; p < validPoints; p++) {
        const a = (p / validPoints) * Math.PI * 2 + Math.random() * 0.5;
        const r = 0.5 + Math.random() * 0.5; // Normalized radius
        points.push(Math.cos(a) * r);
        points.push(Math.sin(a) * r);
      }

      this.shards.push({
        angle: Math.random() * Math.PI * 2,
        dist: 0.15 + Math.random() * 0.3, // 15% to 45% of screen radius (was 0.2 + 0.4)
        size: 0.02 + Math.random() * 0.06, // Smaller shards (was 0.05 + 0.1)
        rotationOffset: Math.random() * Math.PI * 2,
        color: Math.random() > 0.5 ? "cyan" : "white",
        speed: (Math.random() - 0.5) * 0.05,
        points: points,
      });
    }
  }

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

    const minDim = Math.min(width, height);
    const centerX = width / 2;
    const centerY = height / 2;

    // Config
    const baseConfig = VISUALIZER_CONFIG.shatter;
    const userSensitivity = settings?.visualizer.sensitivity || 1.0;
    const finalSensitivity = baseConfig.sensitivity * userSensitivity;

    // --- Analysis ---
    // --- Analysis ---
    // Bass (0-50hz area) - Controls Expansion
    let bass = 0;
    const bassCount = 10;
    for (let i = 0; i < bassCount; i++) bass += dataArray[i] || 0;
    bass = bass / bassCount / 255; // 0-1

    // Mids (Vocals/Snare) - Controls Spin/Jitter
    let mids = 0;
    const midsStart = 20;
    const midsEnd = 100;
    const midsCount = midsEnd - midsStart;

    for (let i = midsStart; i < midsEnd; i++) mids += dataArray[i] || 0;
    mids = mids / midsCount / 255;

    // Highs - Controls Glow/Brightness
    let highs = 0;
    const highsStart = 200;
    const highsEnd = 500;
    const highsCount = highsEnd - highsStart;

    for (let i = highsStart; i < highsEnd; i++) highs += dataArray[i] || 0;
    highs = highs / highsCount / 255; // Normalizing might be tricky if buffer is small, but ok.

    const expansion = bass * finalSensitivity;

    this.time += 0.01 + mids * 0.05; // Speed up with energy

    // Draw Shards
    this.shards.forEach((shard, idx) => {
      // Calculate dynamic position
      // Shards fly OUT from center based on bass
      const currentDist =
        shard.dist * minDim + expansion * minDim * 0.5 * shard.dist;

      // Shards rotate around the center slowly
      const orbitAngle = shard.angle + this.time * shard.speed;

      const shardX = centerX + Math.cos(orbitAngle) * currentDist;
      const shardY = centerY + Math.sin(orbitAngle) * currentDist;

      // Individual Shard Rotation
      // Spin faster on beat
      const shardRot =
        shard.rotationOffset +
        this.time * (shard.speed > 0 ? 1 : -1) * 5 +
        expansion * Math.PI * 0.2;

      // Size Pulse
      const size = shard.size * minDim * (1 + highs * 0.5);

      ctx.save();
      ctx.translate(shardX, shardY);
      ctx.rotate(shardRot); // Rotate shard itself

      ctx.beginPath();
      for (let i = 0; i < shard.points.length; i += 2) {
        const px = shard.points[i] * size;
        const py = shard.points[i + 1] * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      // Style
      const alpha = 0.3 + bass * 0.7;
      const intense = bass > 0.6; // Beat hit?

      ctx.fillStyle = intense
        ? "white"
        : shard.color === "cyan"
        ? `rgba(0, 255, 255, ${alpha})`
        : `rgba(100, 100, 255, ${alpha})`;

      ctx.shadowBlur = intense ? scale(20) : scale(5);
      ctx.shadowColor = shard.color === "cyan" ? "cyan" : "violet";

      ctx.fill();
      ctx.restore();
    });

    // Center pulse ring
    if (bass > 0.1) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, minDim * 0.1 * bass, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${bass * 0.5})`;
      ctx.lineWidth = scale(2);
      ctx.stroke();
    }
  }
}
