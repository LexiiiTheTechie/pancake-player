### **Release v3 Notes**

This marks the 3rd release of **Pancake Player**.
v3 focuses on precision control, high-performance metadata handling, and deeper customisation for the Surround visualiser.

### **Pancake Player v3 Updates:**

- **Precision Volume Input** - You can now click the volume percentage and type an exact value (0-100%). It includes smart validation and auto-commit on "Enter" for perfect volume accuracy.
- **On-Demand Album Art** - High-quality artwork is now displayed in the Metadata Editor and File Info windows. This is intelligently fetched only when the modal is open, ensuring zero impact on pre-scanning and playback memory.
- **Surround Channel Gains** - Added independent control over **Center Channel Gain** and **Subwoofer (LFE) Gain** in the Surround visualiser. Perfect for balancing vocals and bass impact.
- **Smart Mode Confirmation** - Added a "Switch Mode?" confirmation dialog when toggling between Global and Individual visualiser settings to prevent accidental physics resets.
- **Interactive Tuning Guides** - Added new tooltips and "Sparkle" recommendations for Sensitivity and Smoothing settings to help you find the best response for each visualiser style.

### **Pancake Player v3 Bug Fixes:**

- **Sticky Visualiser Shake** - Fixed a bug where the screen would remain tilted or "stuck" when switching away from the Surround visualiser or toggling Shake Mode.
- **Settings Persistence** - Implemented deep property merging in the settings provider, so new tuning features are automatically added for existing users without resetting their library.
- **Visualiser State Sync** - Resolved issues where reactivity and smoothing updates weren't applying instantly in certain modes.

### **Notes**

Enjoy v3! This update makes the player feel much more professional and high-precision. I hope you all enjoy it :3

Also, Happy New Year :3

**Full Changelog**: https://github.com/LexiiiTheTechie/pancake-player/commits/v3
