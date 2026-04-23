import React from "react";
import { Shield, Scale, Library, Info, ChevronLeft, Github, Globe, ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

interface LegalViewProps {
  onBack: () => void;
}

const LegalView: React.FC<LegalViewProps> = ({ onBack }) => {
  const sections = [
    {
      id: "privacy",
      title: "Privacy Policy",
      icon: Shield,
      content: [
        "Pancake is designed with absolute privacy in mind. Unlike modern streaming services, Pancake is an offline-first application.",
        "Local Processing: All audio processing, metadata extraction, and visual effects happen entirely on your local machine.",
        "Zero Collection: We do not collect, store, or transmit any person data, listening habits, or library information.",
        "Third-Party Services: Pancake does not communicate with external analytics or tracking services. Your music library remains yours alone.",
        "Discord RPC: If enabled in settings, the application sends basic track info (title, artist) to your local Discord client for Rich Presence display."
      ]
    },
    {
      id: "terms",
      title: "Terms of Service",
      icon: Scale,
      content: [
        "License: Pancake is provided under the MIT License. You are free to use, copy, and modify the software.",
        "Disclaimer: The software is provided 'as is', without warranty of any kind, express or implied.",
        "Liability: In no event shall the authors be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise.",
        "Compliance: Users are responsible for ensuring they have the legal right to play and manage the audio files imported into the application."
      ]
    },
    {
      id: "libraries",
      title: "Open Source Libraries",
      icon: Library,
      isLinkSection: true,
      libraries: [
        { name: "Tauri", license: "Apache-2.0 / MIT", url: "https://tauri.app", description: "Robust desktop application framework for Rust and Web technologies." },
        { name: "Rust", license: "MIT / Apache-2.0", url: "https://www.rust-lang.org", description: "The core systems language providing safety and performance." },
        { name: "React", license: "MIT", url: "https://react.dev", description: "The library for building the dynamic user interface." },
        { name: "Vite", license: "MIT", url: "https://vitejs.dev", description: "The next generation frontend tooling for lightning-fast builds." },
        { name: "Symphonia", license: "MPL-2.0", url: "https://github.com/pdeljanov/Symphonia", description: "Advanced audio decoding and format detection in pure Rust." },
        { name: "Lofty", license: "Apache-2.0 / MIT", url: "https://github.com/Serial-ATA/lofty-rs", description: "Clean and efficient audio metadata/tagging library." },
        { name: "Lucide React", license: "ISC", url: "https://lucide.dev", description: "Beautiful and consistent open-source iconography." },
        { name: "TailwindCSS", license: "MIT", url: "https://tailwindcss.com", description: "The utility-first design system powering the modern UI." }
      ]
    },
    {
      id: "about",
      title: "About Pancake",
      icon: Info,
      content: [
        "Version: 4.0 (Eclipse)",
        "Build: 2026.Q2.Production",
        "Aesthetics: Inspired by Google's design language and the modern 'Pancake' design.",
        "Goal: To provide a premium, offline-first music player that feels smooth, fast, and visually stunning. Performance, aesthetics and overall remake of how audio players are meant to be."
      ]
    }
  ];

  return (
    <div className="h-full flex flex-col bg-gray-950 text-gray-200">
      {/* Header */}
      <div className="h-20 flex items-center px-8 border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-20">
        <button
          onClick={onBack}
          className="p-2 -ml-2 mr-4 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-all"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Legal & Information
          </h1>
          <p className="text-sm text-gray-500 font-medium tracking-wide">License, Privacy, and Credits</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-12">
        <div className="max-w-4xl mx-auto space-y-12 pb-20">
          {sections.map((section) => (
            <section key={section.id} className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg shadow-black/50">
                  <section.icon size={20} className="text-cyan-400" />
                </div>
                <h2 className="text-xl font-bold text-white">{section.title}</h2>
              </div>
              
              <div className="grid gap-4 pl-14">
                {section.id === "libraries" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                    {section.libraries?.map((lib, i) => (
                      <button
                        key={i}
                        onClick={() => openUrl(lib.url)}
                        className="group/lib flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/30 hover:bg-white/10 transition-all shadow-sm text-left"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white group-hover/lib:text-cyan-400 transition-colors">
                              {lib.name}
                            </p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-500 font-mono border border-white/5">
                              {lib.license}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 font-medium leading-relaxed max-w-sm">
                            {lib.description}
                          </p>
                        </div>
                        <ExternalLink size={14} className="text-gray-600 group-hover/lib:text-gray-400" />
                      </button>
                    ))}
                  </div>
                ) : (
                  section.content?.map((item, i) => (
                    <div key={i} className="group relative">
                      <div className="absolute -left-6 top-2.5 w-1.5 h-1.5 rounded-full bg-gray-700 group-hover:bg-cyan-500 transition-colors" />
                      <p className="text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
                        {item}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}

          {/* Footer Branding */}
          <div className="pt-8 mt-12 border-t border-white/5 flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => openUrl("https://github.com")}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all shadow-sm"
              >
                <Github size={20} />
              </button>
              <button 
                onClick={() => openUrl("https://pancake.live")}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all shadow-sm"
              >
                <Globe size={20} />
              </button>
            </div>
            <div className="text-center space-y-1">
              <p className="text-[15px] text-gray-600 uppercase tracking-[0.2em] font-bold">
                Developed by Lexi :3
              </p>
              <p className="text-[12.5px] text-gray-700 font-mono">
                Google Gemini and Anthropic's Claude and Opus was used to assist with development.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalView;
