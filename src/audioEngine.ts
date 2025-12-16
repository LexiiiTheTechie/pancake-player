import { convertFileSrc } from "@tauri-apps/api/core";

export class AudioEngine {
  private context: AudioContext;
  private gainNode: GainNode;
  private analyser: AnalyserNode;
  private audioElement: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode;

  private isPlaying: boolean = false;
  private _volume: number = 0.7;
  private _isMuted: boolean = false;

  private currentTrackPath: string | null = null;
  private nextTrackPath: string | null = null;

  private onEndedCallback: (() => void) | null = null;

  constructor() {
    console.log("🎵 AudioEngine: Starting initialization...");
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    this.context = new AudioContextClass();
    console.log("🎵 AudioEngine: AudioContext created");

    this.gainNode = this.context.createGain();
    this.analyser = this.context.createAnalyser();

    // Configure Analyser
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0.7;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;

    // Create Audio Element
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = "anonymous";

    // Create MediaElementSource
    // Note: This takes the audio out of the normal browser output and into our graph
    this.sourceNode = this.context.createMediaElementSource(this.audioElement);

    // Connect graph: Source -> Gain -> Analyser -> Destination
    this.sourceNode.connect(this.gainNode);
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.context.destination);

    console.log("🎵 AudioEngine: Nodes connected");

    // Setup Event Listeners
    this.audioElement.addEventListener("ended", () => {
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    });

    this.audioElement.addEventListener("play", () => {
      this.isPlaying = true;
      if (this.context.state === "suspended") {
        this.context.resume();
      }
    });

    this.audioElement.addEventListener("pause", () => {
      this.isPlaying = false;
    });

    this.audioElement.addEventListener("error", (e) => {
      console.error("Audio Element Error:", e);
      this.isPlaying = false;
    });

    this.setVolume(this._volume);
    console.log("🎵 AudioEngine: Initialization complete");
  }

  get analyserNode() {
    return this.analyser;
  }

  get duration() {
    return this.audioElement.duration || 0;
  }

  get currentTime() {
    return this.audioElement.currentTime || 0;
  }

  get activeTrackPath() {
    return this.currentTrackPath;
  }

  setOnEnded(callback: () => void) {
    this.onEndedCallback = callback;
  }

  async loadTrack(path: string): Promise<boolean> {
    try {
      this.currentTrackPath = path;
      const url = convertFileSrc(path);

      console.log("🔄 Loading track:", path);
      this.audioElement.src = url;
      this.audioElement.load();

      return true;
    } catch (e) {
      console.error("❌ Failed to load track:", e);
      return false;
    }
  }

  async preloadNextTrack(path: string): Promise<void> {
    // With HTMLAudioElement, true preloading is harder without a second element.
    // For now, we just store the path.
    // We could create a temporary Audio object to cache the request, but browsers are smart.
    this.nextTrackPath = path;
    // Optional: Warm up cache
    // const url = convertFileSrc(path);
    // fetch(url, { method: 'HEAD' }).catch(() => {});
  }

  play() {
    if (this.context.state === "suspended") {
      this.context.resume();
    }
    this.audioElement.play().catch((e) => {
      console.error("Play failed:", e);
    });
  }

  pause() {
    this.audioElement.pause();
  }

  stop() {
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    // We don't clear src here to allow re-play, but if needed we could.
  }

  reset() {
    this.stop();
    this.currentTrackPath = null;
    this.nextTrackPath = null;
    this.audioElement.removeAttribute("src");
    this.audioElement.load();
  }

  seek(time: number) {
    if (Number.isFinite(time)) {
      this.audioElement.currentTime = time;
    }
  }

  setVolume(val: number) {
    this._volume = Math.max(0, Math.min(1, val));
    if (!this._isMuted) {
      this.gainNode.gain.value = this._volume;
    }
  }

  setMute(muted: boolean) {
    this._isMuted = muted;
    this.gainNode.gain.value = muted ? 0 : this._volume;
  }

  // Legacy method support for compatibility, though simplified
  playNext(expectedPath: string): boolean {
    // Since we don't have a preloaded buffer, we just load and play
    if (this.nextTrackPath === expectedPath) {
      this.loadTrack(expectedPath).then(() => this.play());
      return true;
    }
    return false;
  }
}
