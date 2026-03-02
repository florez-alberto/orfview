export interface AppSettings {
    [key: string]: any;
}

const SETTINGS_KEY = 'appSettings';

const DEFAULT_SETTINGS: AppSettings = {
    // Add default settings here if needed
    "editor.fontSize": 14,
    "editor.fontFamily": "Menlo, Monaco, 'Courier New', monospace",
    "editor.wordWrap": "off",

    "ui.theme": "dark",
    "ui.sidebarVisible": true,

    // Analysis Defaults
    "orf.minLength": 75,
    "enzymes.maxCuts": 1,
    "enzymes.showOnLoad": false,

    // Viewer Defaults
    "viewer.showFeatures": true
};

export const settingsManager = {
    getAll: (): AppSettings => {
        try {
            const stored = localStorage.getItem(SETTINGS_KEY);
            if (stored) {
                // Strip comments before parsing
                const stripped = stored.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
                return { ...DEFAULT_SETTINGS, ...JSON.parse(stripped) };
            }
        } catch (e) {
            console.error("Failed to load settings:", e);
        }
        return DEFAULT_SETTINGS;
    },

    get: (key: string): any => {
        const settings = settingsManager.getAll();
        return settings[key];
    },

    save: (settings: AppSettings) => {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings, null, 4));
        } catch (e) {
            console.error("Failed to save settings:", e);
        }
    },

    saveContent: (jsonContent: string) => {
        try {
            localStorage.setItem(SETTINGS_KEY, jsonContent);
            return true;
        } catch (e) {
            console.error("Failed to save settings content (invalid JSON):", e);
            throw e;
        }
    },

    getAsString: (): string => {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored && stored.trim().length > 0) return stored;

        // Return default with comments
        return `{
    // Editor Settings
    "editor.fontSize": 14,
    "editor.fontFamily": "Menlo, Monaco, 'Courier New', monospace",
    "editor.wordWrap": "off", // "off" | "on"

    // UI Settings
    // Options: "dark" (only dark theme is currently supported)
    "ui.theme": "dark",
    "ui.sidebarVisible": true, // Show sidebar on load

    // Analysis Defaults
    "orf.minLength": 75,
    "enzymes.maxCuts": 1,
    "enzymes.showOnLoad": false,

    // Viewer Defaults
    "viewer.showFeatures": true
}`;
    },

    restoreDefaults: (): string => {
        const defaultSettings = `{
    // Editor Settings
    "editor.fontSize": 14,
    "editor.fontFamily": "Menlo, Monaco, 'Courier New', monospace",
    "editor.wordWrap": "off", // "off" | "on"

    // UI Settings
    // Options: "dark" (only dark theme is currently supported)
    "ui.theme": "dark",
    "ui.sidebarVisible": true,

    // Analysis Defaults
    "orf.minLength": 75,
    "enzymes.maxCuts": 1,
    "enzymes.showOnLoad": false,

    // Viewer Defaults
    "viewer.showFeatures": true
}`;
        localStorage.setItem(SETTINGS_KEY, defaultSettings);
        return defaultSettings;
    }
};
