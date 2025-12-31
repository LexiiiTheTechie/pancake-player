import { convertFileSrc } from "@tauri-apps/api/core";

export class AudioEngine {
  private context: AudioContext;
  private gainNode: GainNode;
  private analyser: AnalyserNode; // Main mixed analyser
  // 7.1 Support: We need 8 discrete analysers
  private channelAnalysers: AnalyserNode[] = [];
  private splitter: ChannelSplitterNode;

  // Dual-Buffer System for Gapless Playback
  private players: HTMLAudioElement[] = [];
  private sources: MediaElementAudioSourceNode[] = [];
  private activeIndex: number = 0; // 0 or 1

  private _volume: number = 0.7;
  private _isMuted: boolean = false;

  private currentTrackPath: string | null = null;
  private nextTrackPath: string | null = null;

  private onEndedCallback: (() => void) | null = null;

  constructor() {
    console.log(
      "🎵 AudioEngine: Starting initialization (Dual-Buffer Mode)..."
    );
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    this.context = new AudioContextClass();
    console.log("🎵 AudioEngine: AudioContext created");

    this.gainNode = this.context.createGain();
    this.analyser = this.context.createAnalyser();

    // Create 8 analysers for 7.1 Surround
    for (let i = 0; i < 8; i++) {
      const node = this.context.createAnalyser();
      node.fftSize = 2048; // Reduced from 4096 for lower latency (46ms vs 92ms)
      node.smoothingTimeConstant = 0.3; // Reduced from 0.6 for snappier visuals
      node.minDecibels = -90;
      node.maxDecibels = -10;
      this.channelAnalysers.push(node);
    }

    // 8 Channel Splitter
    this.splitter = this.context.createChannelSplitter(8);

    // Configure Main Analyser
    this.analyser.fftSize = 2048; // Reduced latency
    this.analyser.smoothingTimeConstant = 0.3; // Snappier
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;

    // Initialize Players (Dual Buffer)
    for (let i = 0; i < 2; i++) {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload = "auto"; // Ensure it buffers

      const source = this.context.createMediaElementSource(audio);
      source.connect(this.gainNode); // Both connected to Graph

      // Events
      audio.addEventListener("ended", () => {
        // Only trigger if this is the active player
        if (this.activeIndex === i && this.onEndedCallback) {
          this.onEndedCallback();
        }
      });

      audio.addEventListener("play", () => {
        if (this.context.state === "suspended") {
          this.context.resume();
        }
      });

      audio.addEventListener("error", (e) => {
        if (this.activeIndex === i) console.error(`Player ${i} Error:`, e);
      });

      this.players.push(audio);
      this.sources.push(source);
    }

    // Path 1: Mixed Output
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.context.destination);

    // Path 2: 7.1 Split (Visualizer)
    this.gainNode.connect(this.splitter);
    for (let i = 0; i < 8; i++) {
      this.splitter.connect(this.channelAnalysers[i], i);
    }

    this.setVolume(this._volume);
    console.log("🎵 AudioEngine: Initialization complete");
  }

  get activePlayer() {
    return this.players[this.activeIndex];
  }

  get secondaryPlayer() {
    return this.players[this.activeIndex === 0 ? 1 : 0];
  }

  get analyserNode() {
    return this.analyser;
  }

  get channels() {
    return this.channelAnalysers;
  }

  get duration() {
    return this.activePlayer.duration || 0;
  }

  get currentTime() {
    return this.activePlayer.currentTime || 0;
  }

  get activeTrackPath() {
    return this.currentTrackPath;
  }

  setOnEnded(callback: () => void) {
    this.onEndedCallback = callback;
  }

  async loadTrack(path: string): Promise<boolean> {
    try {
      // Force load into current active player (Stop & Replace)
      this.stop();

      this.currentTrackPath = path;
      const url = convertFileSrc(path);

      console.log(`🔄 Loading track on Player ${this.activeIndex}:`, path);
      this.activePlayer.src = url;
      this.activePlayer.load();

      return true;
    } catch (e) {
      console.error("❌ Failed to load track:", e);
      return false;
    }
  }

  async preloadNextTrack(path: string): Promise<void> {
    // Load into the SECONDARY player
    if (this.nextTrackPath === path) return; // Already preloaded/preloading

    this.nextTrackPath = path;
    const url = convertFileSrc(path);

    const nextIdx = this.activeIndex === 0 ? 1 : 0;
    console.log(`🔄 Preloading track on Player ${nextIdx}:`, path);

    const player = this.players[nextIdx];
    player.src = url;
    player.load(); // Start buffering
  }

  play() {
    if (this.context.state === "suspended") {
      this.context.resume();
    }
    this.activePlayer.play().catch((e) => {
      console.error("Play failed:", e);
    });
  }

  pause() {
    this.activePlayer.pause();
  }

  stop() {
    this.activePlayer.pause();
    this.activePlayer.currentTime = 0;
  }

  reset() {
    this.stop();
    this.currentTrackPath = null;
    this.nextTrackPath = null;
    this.activePlayer.removeAttribute("src");
    this.activePlayer.load();
    this.secondaryPlayer.removeAttribute("src");
    this.secondaryPlayer.load();
  }

  seek(time: number) {
    if (Number.isFinite(time)) {
      this.activePlayer.currentTime = time;
    }
  }

  // Check if we're approaching end of track (for gapless pre-switching)
  getTimeUntilEnd(): number {
    const remaining =
      this.activePlayer.duration - this.activePlayer.currentTime;
    return Number.isFinite(remaining) ? remaining : Infinity;
  }

  // Start next track immediately (for pre-end gapless)
  startNextTrackNow(): boolean {
    const nextIdx = this.activeIndex === 0 ? 1 : 0;
    const secondary = this.players[nextIdx];

    if (!this.nextTrackPath || !secondary.src) {
      return false;
    }

    console.log(`⚡ Pre-end Seamless Switch to Player ${nextIdx}`);

    // Start new track
    secondary.play().catch((e) => console.error("Pre-end play failed:", e));

    // Let current track finish naturally (will be at very end)
    // We don't stop it - it will end itself in ~50ms

    // Swap Index
    this.activeIndex = nextIdx;
    this.currentTrackPath = this.nextTrackPath;
    this.nextTrackPath = null;

    return true;
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

  // Called when UI wants to play the "next" track
  playNext(expectedPath: string): boolean {
    // Check if Secondary player has this track ready
    const nextIdx = this.activeIndex === 0 ? 1 : 0;
    const secondary = this.players[nextIdx];

    // Simple check: does the preloaded path match?
    // We assume if src matches, it's the right one.
    // Note: src will be the full URL (asset://...), so comparing paths is tricky.
    // But we rely on this.nextTrackPath state.

    if (this.currentTrackPath === expectedPath) {
      console.log("✅ Already playing expected track (Gapless Handled)");
      return true;
    }

    if (this.nextTrackPath === expectedPath) {
      console.log(`⚡ Seamless Switch to Player ${nextIdx}`);

      // 1. Start new track
      secondary
        .play()
        .then(() => {
          // Success?
        })
        .catch((e) => console.error("Seamless play failed:", e));

      // 2. Stop old track
      this.activePlayer.pause();
      this.activePlayer.currentTime = 0;
      // Optional cleanup of old track?
      // this.activePlayer.removeAttribute("src");

      // 3. Swap Index
      this.activeIndex = nextIdx;
      this.currentTrackPath = expectedPath;
      this.nextTrackPath = null; // Consumed

      return true;
    }

    // Fallback: Buffer wasn't ready or path didn't match
    console.warn("⚠️ Gapless miss - falling back to standard load");
    this.loadTrack(expectedPath).then(() => this.play());
    return true; // We handled it, just not gracefully
  }
}
