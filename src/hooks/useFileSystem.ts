import { invoke } from "@tauri-apps/api/core";
import { useState, useCallback, useEffect } from "react";
import { open } from '@tauri-apps/plugin-dialog';

export interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
}

export function useFolderContent(path: string | null) {
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!path) {
            setFiles([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const entries = await invoke<FileEntry[]>("list_files", { path });
            setFiles(entries);
        } catch (err) {
            setError(err as string);
            console.error(`Failed to list files for ${path}:`, err);
        } finally {
            setLoading(false);
        }
    }, [path]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { files, loading, error, refresh };
}

export function useFileSystem() {
    const [recentFolders, setRecentFolders] = useState<string[]>([]);

    const [currentPath, setCurrentPath] = useState<string>("");
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const listFiles = useCallback(async (path: string) => {
        setLoading(true);
        try {
            const entries = await invoke<FileEntry[]>("list_files", { path });
            setFiles(entries);
            setCurrentPath(path);

            // Update recent folders
            setRecentFolders(prev => {
                if (prev.includes(path)) return prev;
                const newRecent = [path, ...prev].slice(0, 10); // Increase limit
                localStorage.setItem("recentFolders", JSON.stringify(newRecent));
                return newRecent;
            });
            return entries; // Return for caller use
        } catch (err) {
            setError(err as string);
            console.error("Failed to list files:", err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const openFolderDialog = useCallback(async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                recursive: true,
            });

            if (selected && typeof selected === 'string') {
                await listFiles(selected);
                return selected;
            }
        } catch (err) {
            console.error("Failed to open folder dialog:", err);
        }
        return null;
    }, [listFiles]);

    const readFile = useCallback(async (path: string) => {
        try {
            // @ts-ignore
            if (typeof window !== 'undefined' && !window.__TAURI_INTERNALS__) {
                console.log("Browser mode: fetching", path);
                const res = await fetch(path);
                if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
                return await res.text();
            }
            return await invoke<string>("read_file_content", { path });
        } catch (err) {
            console.error("Failed to read file:", err);
            // Fallback for debugging
            try {
                const res = await fetch(path);
                if (res.ok) return await res.text();
            } catch (e) { /* ignore */ }
            throw err;
        }
    }, []);

    const init = useCallback(async () => {
        try {
            const savedRecent = localStorage.getItem("recentFolders");
            if (savedRecent) {
                setRecentFolders(JSON.parse(savedRecent));
            }
        } catch (err) {
            console.error("Failed to init file system:", err);
        }
    }, []);

    const removeRecentFolder = useCallback((pathToRemove: string) => {
        setRecentFolders(prev => {
            const newRecent = prev.filter(p => p !== pathToRemove);
            localStorage.setItem("recentFolders", JSON.stringify(newRecent));
            return newRecent;
        });
    }, []);

    return {
        recentFolders,
        openFolderDialog,
        readFile,
        removeRecentFolder,
        init,
        files,
        currentPath,
        listFiles,
        loading,
        error
    };
}
