export const SUPPORTED_AUDIO_EXTENSIONS_DOT = [
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".aac",
  ".m4a",
];
export const SUPPORTED_AUDIO_EXTENSIONS_NO_DOT = [
  "mp3",
  "wav",
  "ogg",
  "flac",
  "aac",
  "m4a",
];

export const VISUALIZER_CONFIG = {
  standard: { sensitivity: 1.4, reactivity: 0.85 }, // Standard settings
  mirror: { sensitivity: 1, reactivity: 0.8 }, // Higher sensitivity for mirror
  surround: { sensitivity: 1.5, reactivity: 1.6 }, // Lower sensitivity for more stable surround
};
