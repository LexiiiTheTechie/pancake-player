export interface Track {
  id: string;
  path: string;
  filename: string;
  duration: number;
  artist: string;
  title: string;
  album: string;
  metadataLoaded: boolean;
}

export interface RawMetadata {
  path: string;
  filename: string;
  duration: number;
  artist: string | null;
  title: string | null;
  album: string | null;
}

export interface Playlist {
  name: string;
  tracks: Track[];
  cover_image?: string;
}

export interface PlaylistSummary {
  name: string;
  track_count: number;
  cover_image?: string;
}

export interface AudioFileInfo {
  path: string;
  filename: string;
  size_bytes: number;
  duration: number;
  format: string;
  codec: string;
  bitrate: number | null;
  sample_rate: number | null;
  channels: number | null;
  bit_depth: number | null;
  artist: string | null;
  title: string | null;
  album: string | null;
}

export type RepeatMode = "none" | "all" | "one";
export type Tab = "queue" | "visualizer" | "home" | "playlist";
export type VisualizerStyle = "mirror" | "standard";
