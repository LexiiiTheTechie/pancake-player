# Refactoring Plan: Applying SOLID Principles

This plan outlines the steps to refactor the Pancake Player application to adhere to SOLID principles, specifically **SRP (Single Responsibility Principle)** and **OCP (Open/Closed Principle)**.

## Phase 1: SRP - Decompose `App.tsx`

`App.tsx` currently acts as a "God Object," managing UI, Audio, Queue, and Shortcuts. We will extract this logic into custom hooks.

### 1. Extract Global Shortcuts

**File:** `src/hooks/useGlobalShortcuts.ts`

- **Responsibility:** Managing registration and unregistration of global media keys.
- **Input:** Functions to trigger (`playNext`, `playPrev`, `togglePlay`).
- **Goal:** Remove shortcut logic from `App.tsx`.

### 2. Extract Queue Management

**File:** `src/hooks/useQueue.ts`

- **Responsibility:** Managing the list of tracks, shuffle/repeat state, and navigation logic.
- **State:** `queue`, `currentTrackIndex`, `shuffle`, `repeat` (implied or passed).
- **Functions:** `addFiles`, `removeTrack`, `reorderQueue`, `getNextIndex`, `getPrevIndex`.
- **Goal:** Centralize playlist manipulation logic.

### 3. Extract Audio Engine Interface

**File:** `src/hooks/useAudioPlayer.ts`

- **Responsibility:** Interfacing with the `AudioEngine` class and managing playback state.
- **State:** `isPlaying`, `currentTime`, `duration`, `volume`, `isMuted`.
- **Goal:** Decouple the React UI from the raw `AudioEngine` class.

## Phase 2: OCP - Refactor Visualizer

`VisualizerView.tsx` uses a large `if/else` block to determine how to draw. We will use the **Strategy Pattern** to make this open for extension.

### 1. Define Renderer Interface

**File:** `src/visualizers/IVisualizerRenderer.ts`

- Define a common contract: `draw(ctx: CanvasRenderingContext2D, data: Uint8Array, dims: {width, height}, config: any): void`.

### 2. Implement Strategies

- **File:** `src/visualizers/StandardRenderer.ts`
- **File:** `src/visualizers/MirrorRenderer.ts`
- **File:** `src/visualizers/SurroundRenderer.ts`
- Move specific drawing logic into these classes.

### 3. Update Component

**File:** `src/components/VisualizerView.tsx`

- Replace `if/else` logic with a lookup map (e.g., `renderers[style].draw(...)`).

## Execution Order

1. Create `src/hooks` and `src/visualizers` directories.
2. Implement `useGlobalShortcuts` (Low Risk).
3. Implement `useQueue` (Medium Risk).
4. Implement `useAudioPlayer` (High Risk - touchy playback logic).
5. Refactor `VisualizerView` (Medium Risk - isolated).

Does this plan look good to you?
