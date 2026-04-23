# Pancake Music Player - Technical Documentation

## 1. Introduction

**Pancake** is a modern, high-performance desktop music player built with **Tauri**, **React**, and **Rust**. It is designed to provide a seamless listening experience with gapless playback, a responsive UI, and a real-time audio visualizer.

This documentation serves as a comprehensive guide to understanding the architecture, codebase, and usage of the application. It is intended for developers, contributors, and curious users who want to understand the "magic" under the hood.

---

## 2. Architecture Overview

Pancake follows a hybrid architecture typical of Tauri applications:

- **Frontend (UI):** Built with **React** (TypeScript) and **Tailwind CSS**. It handles the user interface, state management, and audio visualization.
- **Backend (Core):** Built with **Rust**. It handles system-level operations such as file system access, metadata extraction, and playlist management.
- **Bridge:** The **Tauri IPC (Inter-Process Communication)** layer connects the frontend and backend, allowing them to exchange data securely and efficiently.

### Key Technologies

- **Tauri:** The application framework. It provides a lightweight webview for the UI and a Rust backend for system operations.
- **React:** The UI library used for building components and managing application state.
- **Web Audio API:** The browser-native API used for high-performance audio playback, scheduling, and analysis (visualizer).
- **Rust:** The systems programming language used for the backend to ensure speed and safety.

---

## 3. The Audio Engine (`src/audioEngine.ts`)

The heart of Pancake is its custom **AudioEngine**. Unlike simple HTML5 `<audio>` tags, this engine uses the **Web Audio API** to provide advanced features like gapless playback and real-time frequency analysis.

### Core Concepts

1.  **AudioContext:** The main container for all audio operations. It represents the audio graph.
2.  **AudioBuffer:** The raw audio data loaded into memory. We decode audio files into these buffers for instant playback.
3.  **SourceNode:** A node that plays an `AudioBuffer`.
4.  **GainNode:** Controls the volume.
5.  **AnalyserNode:** Provides real-time frequency data for the visualizer.

### How Gapless Playback Works

Gapless playback is achieved through **scheduling**.

1.  **Preloading:** When a track is playing, the engine automatically loads the _next_ track into a "next buffer" in the background (`preloadNextTrack`).
2.  **Scheduling:** Instead of waiting for the current track to finish (which causes a delay), the engine calculates exactly when the current track _will_ end.
3.  **Precise Start:** It tells the browser to start playing the _next_ track's buffer at that exact timestamp (`nextSource.start(endTime)`).
4.  **State Swap:** A timer runs in the background to swap the internal state (current track becomes previous, next becomes current) exactly when the transition happens, ensuring the UI stays in sync.

### Key Methods

- `loadTrack(path)`: Stops playback, fetches the file, decodes it into an `AudioBuffer`, and prepares it for playback.
- `play()`: Creates a source node for the current buffer and starts it.
- `scheduleNextTrack()`: The "magic" function that queues up the next song to start seamlessly.
- `seek(time)`: Jumps to a specific timestamp. Since buffers can't be "seeked", it actually stops the current source and starts a new one at the desired offset.

---

## 4. User Interface (Frontend)

The UI is built with React components, styled with Tailwind CSS for a modern, dark-themed aesthetic.

### Main Components

- **`App.tsx`**: The root component. It holds the global state (queue, current track, volume, etc.) and orchestrates the interaction between the UI and the `AudioEngine`.
- **`Home.tsx`**: The landing page. It displays your playlists and a greeting. It uses a `PlaylistSummary` to load playlist metadata efficiently without fetching every single track.
- **`QueueView.tsx`**: Displays the current list of songs. It supports drag-and-drop reordering and adding new files.
- **`VisualizerView.tsx`**: Renders the real-time audio visualizer. It draws to an HTML5 `<canvas>` using data from the `AudioEngine`'s `AnalyserNode`. It includes an FPS counter and two modes: "Mirror" and "Standard".
- **`PlayerBar.tsx`**: The persistent control bar at the bottom (Play/Pause, Next/Prev, Volume, Seek).

### State Management

We use React's `useState` and `useEffect` hooks.

- **`queue`**: An array of `Track` objects representing the current playlist.
- **`currentTrackIndex`**: The index of the currently playing song in the queue.
- **`activeTab`**: Controls which view is visible (Home, Queue, Visualizer, Playlist).

---

## 5. Backend (Rust)

The Rust backend (`src-tauri/src/lib.rs`, `playlist.rs`, `media_player.rs`) handles tasks that the browser cannot do securely or efficiently.

### Modules

- **`media_player.rs`**: Handles metadata extraction. It reads ID3 tags (Artist, Title, Album, Duration) from music files using the `id3` and `mp4ameta` crates.
- **`playlist.rs`**: Manages playlist files. Playlists are saved as JSON files in the user's app data directory.
  - `save_playlist`: Writes the current queue to a JSON file.
  - `get_playlists`: Scans the directory and returns a list of `PlaylistSummary` objects (name, track count, cover image).
  - `load_playlist`: Reads a specific JSON file and returns the full list of tracks.

### Commands

These are the functions exposed to the frontend via `invoke()`:

- `get_audio_metadata(filePath)`: Returns metadata for a file.
- `update_metadata(...)`: Writes new tags to a file.
- `save_playlist(...)`: Saves a playlist.
- `get_playlists()`: Lists all playlists.
- `delete_playlist(name)`: Deletes a playlist.

---

## 6. How to Use Pancake

### Getting Started

1.  **Add Music:** Click the **"Add Music"** button in the top right or simply **drag and drop** audio files anywhere onto the window.
2.  **Play:** Click on any track in the queue to start playing.
3.  **Controls:** Use the bottom bar to pause, skip, shuffle, repeat, or change volume.
4.  **Visualizer:** Click the **"Visualizer"** tab to see your music come to life. You can toggle between "Mirror" and "Standard" modes.
5.  **Playlists:**
    - **Save:** Click the "Save Playlist" button in the Queue tab to save your current queue.
    - **Load:** Go to the **Home** tab and click on a playlist card to play it.

### Keyboard Shortcuts

- **Space:** Play/Pause
- **Left Arrow:** Previous Track
- **Right Arrow:** Next Track

---

## 7. Performance Optimizations

- **Gapless Playback:** As described above, using `scheduleNextTrack` eliminates delays.
- **Optimized Visualizer:** The visualizer loop is carefully managed to ensure only one animation frame is requested at a time, preventing FPS drops.
- **Playlist Summaries:** The Home screen loads lightweight "summaries" of playlists instead of full data, ensuring instant load times even with large libraries.
- **Lazy Metadata:** Metadata for tracks in the queue is loaded asynchronously, so the UI remains responsive even when adding hundreds of files.

---

## 8. Conclusion

Pancake is a testament to the power of modern web technologies combined with system-level performance. By leveraging the Web Audio API and Rust, it delivers a premium audio experience wrapped in a beautiful, customizable interface.

Enjoy your music! 🥞
