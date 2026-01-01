# Pancake Player - Update Summary

## 🛠️ Performance & Memory Optimizations

- **On-Demand Album Art Extraction**: Image data is no longer pre-extracted or stored in the global track queue. Artwork is now fetched lazily only when you open a Metadata or File Info window, keeping the app lean and fast for gapless playback.
- **Deep Settings Merging**: Updated the settings provider to perform deep property merging, ensuring new feature settings (like channel gains) are automatically injected for existing users without losing their old configuration.

## 🔊 Audio & Control Enhancements

- **Precision Volume Control**:
  - Replaced the static percentage label with a **Click-to-Edit** input field (0-100%).
  - Added support for `Enter` to commit changes and auto-clamping for values outside the safe range.
  - Slimmed down the volume input UI for a tighter, professional look.
- **Premium Slider Aesthetics**: Added glowing cyan tracks, better hover states for the mute button, and smooth transitions to the player bar.
- **Surround Channel Tuning**:
  - Added **Center Channel Gain** and **Subwoofer (LFE) Gain** sliders for the Surround visualizer.
  - Allows independent control over vocal/lead clarity and bass impact without affecting side-channel physics.

## 🎨 UI & UX Improvements

- **Album Art Integration**:
  - Added high-quality album art display to the **Metadata Editor** and **File Info** windows.
  - Implemented stylized placeholders and loading spinners for a polished "premium" feel.
- **Toggle Confirmation**: Added a two-step confirmation dialog ("Switch Mode?") when toggling between Individual and Global visualizer settings to prevent accidental physics resets.
- **Visualizer Instructions**: Integrated interactive tooltips (`Info` icon) and Sparkle recommendations for sensitivity and smoothing settings to help users find the "sweet spot" for each style.

## 🐛 Bug Fixes

- **Sticky Shake Fix**: Resolved an issue where the screen transform would "stick" and leave the window tilted after switching away from the Surround visualizer.
- **Visualizer State Sync**: Ensured that sensitivity and reactivity updates are applied instantly across all rendering modes.
