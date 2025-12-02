import { convertFileSrc } from "@tauri-apps/api/core";

export class AudioEngine {
  private context: AudioContext;
  private gainNode: GainNode;
  private analyser: AnalyserNode;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private nextBuffer: AudioBuffer | null = null;
  private currentTrackPath: string | null = null;
  private nextTrackPath: string | null = null;
  private loadingTrackPath: string | null = null;

  private nextSourceNode: AudioBufferSourceNode | null = null;
  private schedulerTimeout: any = null;

  private startTime: number = 0;
  private pauseOffset: number = 0;
  private isPlaying: boolean = false;
  private _volume: number = 0.7;
  private _isMuted: boolean = false;

  private onEndedCallback: (() => void) | null = null;

  constructor() {
    console.log("🎵 AudioEngine: Starting initialization...");
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    this.context = new AudioContextClass();
    console.log("🎵 AudioEngine: AudioContext created");

    this.gainNode = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    console.log("🎵 AudioEngine: Nodes created");

    // Configure Analyser
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0.7;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;

    // Connect graph: Source -> Gain -> Analyser -> Destination
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    console.log("🎵 AudioEngine: Nodes connected");

    this.setVolume(this._volume);
    console.log("🎵 AudioEngine: Initialization complete");
  }

  get analyserNode() {
    return this.analyser;
  }

  get duration() {
    return this.currentBuffer?.duration || 0;
  }

  get currentTime() {
    if (!this.isPlaying) return this.pauseOffset;
    const time = Math.min(
      this.context.currentTime - this.startTime,
      this.duration
    );
    return isNaN(time) ? 0 : time;
  }

  get activeTrackPath() {
    return this.currentTrackPath;
  }

  setOnEnded(callback: () => void) {
    this.onEndedCallback = callback;
  }

  private cancelScheduledTrack() {
    if (this.nextSourceNode) {
      try {
        this.nextSourceNode.stop();
      } catch (e) {
        // Ignore
      }
      this.nextSourceNode.disconnect();
      this.nextSourceNode = null;
    }
    if (this.schedulerTimeout) {
      clearTimeout(this.schedulerTimeout);
      this.schedulerTimeout = null;
    }
  }

  async loadTrack(path: string): Promise<boolean> {
    // Stop any current playback immediately AND cancel scheduled tracks
    this.stop();

    // Set the loading path to track this specific request
    this.loadingTrackPath = path;

    // Optimization: If we have already preloaded this track fully, use it!
    if (this.nextTrackPath === path && this.nextBuffer) {
      console.log("🚀 Using preloaded buffer for:", path);
      this.currentBuffer = this.nextBuffer;
      this.currentTrackPath = this.nextTrackPath;
      this.nextBuffer = null;
      this.nextTrackPath = null;
      this.pauseOffset = 0;
      this.startTime = 0;
      return true;
    }

    // Clear any stale preloaded track since we aren't using it
    this.nextBuffer = null;
    this.nextTrackPath = null;

    // Otherwise load from scratch
    try {
      const url = convertFileSrc(path);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

      // Check if we are still loading the same track
      if (this.loadingTrackPath !== path) {
        console.log("🚫 Load cancelled for:", path);
        return false;
      }

      this.currentBuffer = audioBuffer;
      this.currentTrackPath = path;
      this.pauseOffset = 0;
      this.startTime = 0;
      this.loadingTrackPath = null;
      return true;
    } catch (e) {
      // Only log error if we are still trying to load this track
      if (this.loadingTrackPath === path) {
        console.error("Failed to load track:", e);
        this.loadingTrackPath = null;
      }
      throw e;
    }
  }

  async preloadNextTrack(path: string): Promise<void> {
    if (this.nextTrackPath === path && this.nextBuffer) return; // Already preloaded

    try {
      this.nextTrackPath = path;
      const url = convertFileSrc(path);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

      // Only commit if the request hasn't changed
      if (this.nextTrackPath === path) {
        this.nextBuffer = audioBuffer;
        console.log("Preloaded next track successfully:", path);
        // Try to schedule it immediately if we are playing
        if (this.isPlaying) {
          // If we just updated the next track, we must cancel any existing schedule
          // because it would be using the OLD buffer/source.
          this.cancelScheduledTrack();
          this.scheduleNextTrack();
        }
      }
    } catch (e) {
      console.error("Failed to preload:", e);
    }
  }

  play() {
    if (this.isPlaying || !this.currentBuffer) return;

    if (this.context.state === "suspended") {
      this.context.resume();
    }

    this.currentSource = this.context.createBufferSource();
    this.currentSource.buffer = this.currentBuffer;
    this.currentSource.connect(this.gainNode);

    this.currentSource.onended = () => {
      if (this.isPlaying) {
        // Natural end of track
        // Try to play next track immediately if available
        if (this.nextBuffer) {
          this.playNext(this.nextTrackPath || "");
          // Notify UI to update index (async)
          if (this.onEndedCallback) this.onEndedCallback();
        } else {
          this.isPlaying = false;
          this.pauseOffset = 0;
          if (this.onEndedCallback) this.onEndedCallback();
        }
      }
    };

    this.startTime = this.context.currentTime - this.pauseOffset;
    this.currentSource.start(0, this.pauseOffset);
    this.isPlaying = true;

    // If we have a next track ready, schedule it now!
    if (this.nextBuffer) {
      this.scheduleNextTrack();
    }
  }

  pause() {
    if (!this.isPlaying || !this.currentSource) return;

    this.isPlaying = false;

    // Calculate where we stopped so we can resume later
    this.pauseOffset = this.context.currentTime - this.startTime;

    if (this.currentSource) {
      this.currentSource.onended = null; // Prevent old source from triggering end event
      try {
        this.currentSource.stop();
      } catch (e) {
        // Ignore
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }

    // Cancel any scheduled next track
    this.cancelScheduledTrack();
  }

  stop() {
    // Stop and reset to beginning
    if (this.currentSource) {
      this.currentSource.onended = null; // Prevent old source from triggering end event
      try {
        this.currentSource.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }

    // Cancel any scheduled next track
    this.cancelScheduledTrack();

    this.isPlaying = false;
    this.pauseOffset = 0;
    this.startTime = 0;
  }

  reset() {
    this.stop();
    this.nextBuffer = null;
    this.nextTrackPath = null;
    this.currentBuffer = null;
    this.currentTrackPath = null;
  }

  seek(time: number) {
    if (!this.currentBuffer) return;

    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }

    this.pauseOffset = Math.max(0, Math.min(time, this.duration));

    if (wasPlaying) {
      this.play();
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

  // Helper to play the preloaded buffer immediately
  playNext(expectedPath: string): boolean {
    if (this.nextBuffer && this.nextTrackPath === expectedPath) {
      // If we are already playing this track (via scheduled playback), just update state
      if (this.currentTrackPath === expectedPath && this.isPlaying) {
        console.log("✅ Track already playing via schedule:", expectedPath);
        return true;
      }

      console.log("🎵 Playing preloaded next track:", expectedPath);
      const wasPlaying = this.isPlaying;

      this.stop();
      this.currentBuffer = this.nextBuffer;
      this.currentTrackPath = this.nextTrackPath;
      this.nextBuffer = null;
      this.nextTrackPath = null;

      if (wasPlaying) {
        this.play();
      }
      return true;
    }
    return false;
  }

  scheduleNextTrack() {
    if (!this.nextBuffer || !this.isPlaying || !this.currentSource) return;

    // Prevent double-scheduling
    if (this.nextSourceNode || this.schedulerTimeout) {
      console.log("⚠️ Next track already scheduled, skipping");
      return;
    }

    console.log("⏰ Scheduling next track for gapless playback");

    // Calculate when the current track will end
    const timeRemaining = this.duration - this.currentTime;
    const endTime = this.context.currentTime + timeRemaining;

    // Create source for next track
    const nextSource = this.context.createBufferSource();
    nextSource.buffer = this.nextBuffer;
    nextSource.connect(this.gainNode);

    // Schedule it to start exactly at endTime
    nextSource.start(endTime);
    this.nextSourceNode = nextSource;

    // Disable onended for current source to prevent double-trigger
    this.currentSource.onended = null;

    // Update state when the switch happens (approximately)
    // We use a timeout to swap the buffers in our class state
    const timeoutMs = timeRemaining * 1000;

    // Store the next track info locally before clearing it
    const nextBuffer = this.nextBuffer;
    const nextPath = this.nextTrackPath;

    this.schedulerTimeout = setTimeout(() => {
      console.log("🔄 Scheduled track switch executing");
      // Swap buffers
      this.currentSource = nextSource;
      this.currentBuffer = nextBuffer;
      this.currentTrackPath = nextPath;
      this.nextBuffer = null;
      this.nextTrackPath = null;
      this.nextSourceNode = null;
      this.schedulerTimeout = null;

      // The new track started at `endTime`.
      // So effectively, our new startTime (relative to context time) is `endTime`.
      this.startTime = endTime;
      this.pauseOffset = 0;

      // Setup onended for the NEW track
      nextSource.onended = () => {
        if (this.isPlaying) {
          if (this.nextBuffer) {
            this.playNext(this.nextTrackPath || "");
            if (this.onEndedCallback) this.onEndedCallback();
          } else {
            this.isPlaying = false;
            this.pauseOffset = 0;
            if (this.onEndedCallback) this.onEndedCallback();
          }
        }
      };

      // Notify UI that track changed
      if (this.onEndedCallback) this.onEndedCallback();
    }, timeoutMs);
  }
}
