import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import { VisualizerStyle } from "../types";

// Initial default settings
const DEFAULT_SETTINGS = {
  visualizer: {
    sensitivity: 1.0,
    reactivity: 0.5,
    enableShake: true,
    showFps: true,
    resolution: "native" as "native" | "efficient",
    useIndividualSettings: true,
    centerSensitivity: 1.0,
    lfeSensitivity: 1.0,
    perVisualizer: {
      standard: { sensitivity: 0.65, reactivity: 0.45, enableShake: true },
      mirror: { sensitivity: 0.9, reactivity: 0.6, enableShake: true },
      surround: {
        sensitivity: 1.05,
        reactivity: 0,
        enableShake: true,
        centerSensitivity: 1.1,
        lfeSensitivity: 0.95,
      },
    } as Record<
      VisualizerStyle,
      {
        sensitivity: number;
        reactivity: number;
        enableShake: boolean;
        centerSensitivity?: number;
        lfeSensitivity?: number;
      }
    >,
  },
  audio: {
    enableGapless: true,
  },
  theme: {
    accentColor: "#06b6d4", // cyan-500
  },
};

export type AppSettings = typeof DEFAULT_SETTINGS;

interface SettingsContextType {
  settings: AppSettings;
  currentStyle: VisualizerStyle;
  setCurrentStyle: (style: VisualizerStyle) => void;
  visualizerSettings: {
    sensitivity: number;
    reactivity: number;
    enableShake: boolean;
    centerSensitivity?: number;
    lfeSensitivity?: number;
  };
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  updateVisualizerSettings: (
    newVizSettings: Partial<AppSettings["visualizer"]>
  ) => void;
  updatePerVisualizerSettings: (
    style: VisualizerStyle,
    newSettings: Partial<
      AppSettings["visualizer"]["perVisualizer"][VisualizerStyle]
    >
  ) => void;
  toggleSetting: (category: keyof AppSettings, key: string) => void;
  resetCategory: (category: keyof AppSettings) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentStyle, setCurrentStyle] = useState<VisualizerStyle>("standard");

  // Load from localStorage or use default
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("pancake_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Deep merge logic
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          visualizer: {
            ...DEFAULT_SETTINGS.visualizer,
            ...parsed.visualizer,
            perVisualizer: {
              standard: {
                ...DEFAULT_SETTINGS.visualizer.perVisualizer.standard,
                ...(parsed.visualizer?.perVisualizer?.standard || {}),
              },
              mirror: {
                ...DEFAULT_SETTINGS.visualizer.perVisualizer.mirror,
                ...(parsed.visualizer?.perVisualizer?.mirror || {}),
              },
              surround: {
                ...DEFAULT_SETTINGS.visualizer.perVisualizer.surround,
                ...(parsed.visualizer?.perVisualizer?.surround || {}),
              },
            },
          },
          audio: { ...DEFAULT_SETTINGS.audio, ...parsed.audio },
          theme: { ...DEFAULT_SETTINGS.theme, ...parsed.theme },
        };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Computed visualizer settings based on global vs individual
  const visualizerSettings = useMemo(() => {
    if (settings.visualizer.useIndividualSettings && currentStyle) {
      return settings.visualizer.perVisualizer[currentStyle];
    }
    return {
      sensitivity: settings.visualizer.sensitivity,
      reactivity: settings.visualizer.reactivity,
      enableShake: settings.visualizer.enableShake,
      centerSensitivity: settings.visualizer.centerSensitivity,
      lfeSensitivity: settings.visualizer.lfeSensitivity,
    };
  }, [settings.visualizer, currentStyle]);

  // Save to localStorage whenever settings change
  useEffect(() => {
    localStorage.setItem("pancake_settings", JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const updatePerVisualizerSettings = (
    style: VisualizerStyle,
    newSettings: Partial<
      AppSettings["visualizer"]["perVisualizer"][VisualizerStyle]
    >
  ) => {
    setSettings((prev) => ({
      ...prev,
      visualizer: {
        ...prev.visualizer,
        perVisualizer: {
          ...prev.visualizer.perVisualizer,
          [style]: { ...prev.visualizer.perVisualizer[style], ...newSettings },
        },
      },
    }));
  };

  const updateVisualizerSettings = (
    newVizSettings: Partial<AppSettings["visualizer"]>
  ) => {
    setSettings((prev) => {
      const isIndividual = prev.visualizer.useIndividualSettings;

      if (isIndividual) {
        // Update per-visualizer settings if they are specific ones
        const currentPer = prev.visualizer.perVisualizer[currentStyle];
        const updatedPer = { ...currentPer };

        if (newVizSettings.sensitivity !== undefined)
          updatedPer.sensitivity = newVizSettings.sensitivity;
        if (newVizSettings.reactivity !== undefined)
          updatedPer.reactivity = newVizSettings.reactivity;
        if (newVizSettings.enableShake !== undefined)
          updatedPer.enableShake = newVizSettings.enableShake;

        return {
          ...prev,
          visualizer: {
            ...prev.visualizer,
            ...newVizSettings, // still update non-individual settings like resolution/showFps
            perVisualizer: {
              ...prev.visualizer.perVisualizer,
              [currentStyle]: updatedPer,
            },
          },
        };
      }

      // Global update
      return {
        ...prev,
        visualizer: { ...prev.visualizer, ...newVizSettings },
      };
    });
  };

  const toggleSetting = (category: keyof AppSettings, key: string) => {
    if (
      category === "visualizer" &&
      key === "enableShake" &&
      settings.visualizer.useIndividualSettings
    ) {
      updateVisualizerSettings({
        enableShake: !visualizerSettings.enableShake,
      });
      return;
    }

    setSettings((prev) => {
      const cat = prev[category] as any;
      return {
        ...prev,
        [category]: {
          ...cat,
          [key]: !cat[key],
        },
      };
    });
  };

  const resetCategory = (category: keyof AppSettings) => {
    setSettings((prev) => ({
      ...prev,
      [category]: { ...DEFAULT_SETTINGS[category] },
    }));
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        currentStyle,
        setCurrentStyle,
        visualizerSettings,
        updateSettings,
        updateVisualizerSettings,
        updatePerVisualizerSettings,
        toggleSetting,
        resetCategory,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
