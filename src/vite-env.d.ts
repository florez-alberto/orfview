/// <reference types="vite/client" />

interface Window {
    orfview: {
        register: (id: string, cleanup: () => void) => void;
        uninstall: (id: string) => void;
        theme: {
            setColors: (colors: Record<string, string>) => void;
            resetColors: () => void;
        };
        dialogs: {
            showMessage: (msg: string) => void;
            showError: (msg: string) => void;
            confirm: (msg: string) => Promise<boolean>;
        };
        files: {
            getActiveFile: () => { type: string, path: string, content?: string, data?: any, sequences?: any } | null;
            onFileOpened: (callback: (file: { path: string }) => void) => () => void;
            onFileSaved: (callback: (file: { path: string }) => void) => () => void;
        };
        editor: {
            getSequence: () => string | null;
            setSequence: (seq: string) => boolean;
        };
    }
}
