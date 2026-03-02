import { useState, useEffect, useRef } from 'react';
import { ActiveFile } from '../lib/types';

/**
 * Public interface for the Extension System state.
 * 
 * @property activeExtensions - List of IDs of currently registered extensions
 */
export interface ExtensionSystem {
    activeExtensions: string[];
}

export interface ExtensionContext {
    activeFileId: string | null;
    openFiles: ActiveFile[];
    onOpenFile: (path: string) => void;
    onUpdateSequence?: (path: string, newContent: string) => void;
}

/**
 * Initializes and manages the global Extension API (`window.orfview`).
 * Allows external scripts to register/unregister functionality and themes.
 * 
 * @returns The current state of the extension system
 */
export function useExtensionSystem(context: ExtensionContext): ExtensionSystem {
    const [activeExtensions, setActiveExtensions] = useState<string[]>([]);

    const contextRef = useRef(context);
    useEffect(() => {
        contextRef.current = context;
    }, [context]);

    const cleanupMap = new Map<string, () => void>();

    useEffect(() => {
        // @ts-ignore
        window.orfview = {
            register: (id: string, cleanup: () => void) => {
                if (cleanupMap.has(id)) {
                    console.warn(`[OrfView] Extension ${id} already registered, replacing.`);
                }
                cleanupMap.set(id, cleanup);
                setActiveExtensions(prev => {
                    if (prev.includes(id)) return prev;
                    return [...prev, id];
                });
                console.log(`[OrfView] Extension registered: ${id}`);
            },
            uninstall: (id: string) => {
                const cleanup = cleanupMap.get(id);
                if (cleanup) {
                    try {
                        cleanup();
                        console.log(`[OrfView] Extension uninstalled: ${id}`);
                    } catch (e) {
                        console.error(`[OrfView] Error uninstalling extension ${id}:`, e);
                    }
                    cleanupMap.delete(id);
                    setActiveExtensions(prev => prev.filter(extId => extId !== id));
                }
            },
            theme: {
                setColors: (colors: Record<string, string>) => {
                    const root = document.documentElement;
                    Object.entries(colors).forEach(([key, value]) => {
                        if (key.startsWith('--')) {
                            root.style.setProperty(key, value);
                        } else {
                            root.style.setProperty(key, value);
                        }
                    });
                    console.log('[OrfView] applied theme colors:', colors);
                },
                resetColors: () => {
                    const root = document.documentElement;
                    const defaults = {
                        '--bg-sidebar': '#252526',
                        '--bg-activity-bar': '#333333',
                        '--bg-status-bar': '#007acc',
                        '--accent-color': '#007acc',
                        '--selection-bg': '#37373d'
                    };
                    Object.entries(defaults).forEach(([key, value]) => {
                        root.style.setProperty(key, value);
                    });
                    console.log('[OrfView] reset theme colors');
                }
            },
            dialogs: {
                showMessage: (message: string) => {
                    alert(message);
                },
                showError: (message: string) => {
                    alert(`Error: ${message}`);
                },
                confirm: async (message: string): Promise<boolean> => {
                    return window.confirm(message);
                }
            },
            files: {
                getActiveFile: () => {
                    const { activeFileId, openFiles } = contextRef.current;
                    if (!activeFileId) return null;
                    const file = openFiles.find(f => f.path === activeFileId);
                    if (!file) return null;

                    // Return a safe copy of the file data
                    if (file.type === 'text' || file.type === 'json') {
                        return { type: file.type, path: file.path, content: file.content };
                    } else if (file.type === 'fasta') {
                        return { type: file.type, path: file.path, sequences: file.data };
                    } else if (file.type === 'genbank') {
                        return { type: file.type, path: file.path, data: file.data };
                    } else {
                        // ab1, etc.
                        return { type: file.type, path: file.path };
                    }
                },
                onFileOpened: (callback: (file: { path: string }) => void) => {
                    const handler = (event: any) => {
                        if (event.detail && event.detail.path) {
                            callback({ path: event.detail.path });
                        }
                    };
                    window.addEventListener('orfview:file-opened', handler);
                    return () => window.removeEventListener('orfview:file-opened', handler);
                },
                onFileSaved: (callback: (file: { path: string }) => void) => {
                    const handler = (event: any) => {
                        if (event.detail && event.detail.path) {
                            callback({ path: event.detail.path });
                        }
                    };
                    window.addEventListener('orfview:file-saved', handler);
                    return () => window.removeEventListener('orfview:file-saved', handler);
                }
            },
            editor: {
                getSequence: () => {
                    const { activeFileId, openFiles } = contextRef.current;
                    if (!activeFileId) return null;
                    const file = openFiles.find(f => f.path === activeFileId);
                    if (!file) return null;

                    if (file.type === 'text') return file.content;
                    if (file.type === 'fasta' && file.data.length > 0) return file.data[0].sequence;
                    if (file.type === 'genbank') return file.data.sequence;
                    if (file.type === 'ab1') return file.data.sequence;

                    return null;
                },
                setSequence: (sequence: string) => {
                    const { activeFileId, onUpdateSequence } = contextRef.current;
                    if (!activeFileId || !onUpdateSequence) return false;

                    onUpdateSequence(activeFileId, sequence);
                    return true;
                }
            }
        };

        return () => {
            // Cleanup all extensions on unmount
            cleanupMap.forEach(cleanup => cleanup());
            cleanupMap.clear();
            // @ts-ignore
            delete window.orfview;
        };
    }, []);

    return {
        activeExtensions
    };
}
