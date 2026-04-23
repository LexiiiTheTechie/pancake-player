import { AppSettings } from "../contexts/SettingsContext";

export interface VisualizerDrawOptions {
  channels?: AnalyserNode[];
  enableShake?: boolean;
  onShake?: (dx: number, dy: number, rot: number) => void;
  settings?: AppSettings;
}

export interface IVisualizerRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    analyser: AnalyserNode,
    dataArray: Uint8Array,
    dims: { width: number; height: number; dpr: number },
    options?: VisualizerDrawOptions
  ): void;
}
