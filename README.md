# 🥞 Pancake Player

An extremely performant, modern audio player built with Tauri, React, and Rust. Pancake Player combines the speed and efficiency of Rust with a beautiful, responsive React interface to deliver a premium music listening experience.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)

## ✨ Features

### 🎵 Audio Playback

- **High-Performance Audio Engine**: Leverages Rust's Symphonia library for efficient audio decoding
- **Multiple Format Support**: Plays MP3, FLAC, WAV, OGG, M4A, and more
- **Gapless Playback**: Seamless transitions between tracks
- **Advanced Audio Controls**: Play, pause, skip, seek, shuffle, and repeat modes

### 🎨 User Interface

- **Modern Design**: Clean, intuitive interface built with React and Tailwind CSS
- **Custom Window**: Frameless window with custom title bar and controls
- **Drag & Drop**: Easy file management - just drag and drop your music files
- **Queue Management**: Full control over your playback queue with search and reordering
- **Audio Visualizer**: Real-time 3D audio visualization using Three.js

### 📚 Library Management

- **Playlist Support**: Create, edit, and manage custom playlists
- **Metadata Editing**: Edit track information (title, artist, album) directly in the app
- **File Information**: View detailed audio file properties and codec information
- **Custom Playlist Covers**: Personalize your playlists with custom cover images

### ⌨️ Keyboard Shortcuts

- **Global Media Keys**: Control playback even when the app is not in focus
- **Play/Pause**: Media play/pause key
- **Next/Previous Track**: Media next/previous keys
- Works system-wide on Windows

### 🔧 Technical Features

- **Native Performance**: Built on Tauri for minimal resource usage
- **Multi-threaded**: Efficient audio processing and UI rendering
- **Cross-platform Ready**: Currently optimized for Windows, with potential for macOS and Linux

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **Rust** (latest stable version)
- **npm** or **yarn**

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/LexiiiTheTechie/pancake-player.git
   cd pancake-player
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run tauri dev
   ```

### Building for Production

Build the application as an executable:

```bash
npm run tauri build
```

This will create installers in `src-tauri/target/release/bundle/`:

- **NSIS Installer**: `.exe` installer
- **MSI Installer**: `.msi` Windows installer

## 🛠️ Tech Stack

### Frontend

- **React 19** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool and dev server
- **Three.js** - 3D audio visualization
- **Lucide React** - Beautiful icon set
- **@dnd-kit** - Drag and drop functionality

### Backend

- **Tauri 2** - Native application framework
- **Rust** - Systems programming language
- **Symphonia** - Audio decoding library
- **ID3** - MP3 metadata handling
- **Lofty** - Multi-format metadata library
- **mp4ameta** - M4A/MP4 metadata support

## 📁 Project Structure

```
pancake-player/
├── src/                      # React frontend source
│   ├── components/          # React components
│   │   ├── Home.tsx        # Main library view
│   │   ├── QueueView.tsx   # Queue management
│   │   ├── PlayerBar.tsx   # Playback controls
│   │   ├── TopBar.tsx      # Navigation
│   │   └── ...
│   ├── audioEngine.ts      # Audio playback engine
│   ├── App.tsx             # Main app component
│   └── types.ts            # TypeScript definitions
├── src-tauri/               # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Main library entry
│   │   ├── media_player.rs # Audio player logic
│   │   ├── playlist.rs     # Playlist management
│   │   └── metadata.rs     # Metadata handling
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
└── package.json            # Node.js dependencies
```

## 🎯 Usage

### Adding Music

1. Click the **"Add Music"** button or drag and drop audio files into the window
2. Files are automatically added to your queue
3. Playback starts immediately

### Managing Playlists

1. Click **"Save as Playlist"** to create a new playlist from your current queue
2. View all playlists in the **Playlists** tab
3. Click on a playlist to view and play its contents
4. Right-click for options like rename, delete, or change cover

### Editing Metadata

1. Right-click any track in the queue
2. Select **"Edit Metadata"**
3. Modify title, artist, or album information
4. Changes are saved directly to the audio file

### Keyboard Controls

- **Space**: Play/Pause
- **Media Play/Pause**: Play/Pause (global)
- **Media Next**: Next track (global)
- **Media Previous**: Previous track (global)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/)
- Audio decoding powered by [Symphonia](https://github.com/pdeljanov/Symphonia)
- Icons from [Lucide](https://lucide.dev/)
- Visualization with [Three.js](https://threejs.org/)

## 📧 Contact

Project Link: [https://github.com/LexiiiTheTechie/pancake-player](https://github.com/LexiiiTheTechie/pancake-player)

---

Made with ❤️ and 🥞
