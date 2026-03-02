import { useState, useEffect } from 'react';
import { useFileSystem } from './useFileSystem';
import { ActiveFile, FileViewState, HistoryState } from '../lib/types';
import { settingsManager } from '../lib/settings/settingsManager';

export function useWorkspaceState() {
    const { openFolderDialog, recentFolders, removeRecentFolder, init } = useFileSystem();

    // State
    const [openFolders, setOpenFolders] = useState<string[]>([]);
    const [openFiles, setOpenFiles] = useState<ActiveFile[]>([]);
    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [visibleTabs, setVisibleTabs] = useState<Set<string>>(new Set());
    const [alignmentPool, setAlignmentPool] = useState<Record<string, string[]>>({});
    const [fileViewStates, setFileViewStates] = useState<Record<string, FileViewState>>({});
    const [loading, setLoading] = useState(false);
    const [modifiedFiles, setModifiedFiles] = useState<Set<string>>(new Set());
    const [fileHistory, setFileHistory] = useState<Record<string, HistoryState>>({});

    useEffect(() => {
        init();
    }, [init]);

    const getFileViewState = (fileId: string): FileViewState => {
        if (!fileViewStates[fileId]) {
            const settings = settingsManager.getAll();
            const showEnzymes = settings['enzymes.showOnLoad'] ?? false;

            return {
                viewMode: 'alignment',
                selectedAlignmentIds: [],
                showMap: true,
                showSequence: true,
                showEnzymes: showEnzymes,
                showORFs: false
            };
        }
        return fileViewStates[fileId];
    };

    const updateFileViewState = (fileId: string, updates: Partial<FileViewState>) => {
        setFileViewStates(prev => {
            const current = prev[fileId];
            const base = current || {
                viewMode: 'viewer',
                selectedAlignmentIds: [],
                showMap: true,
                showSequence: true,
                showEnzymes: false,
                showORFs: false
            };
            return { ...prev, [fileId]: { ...base, ...updates } };
        });
    };

    return {
        // State
        openFolders, setOpenFolders,
        recentFolders, removeRecentFolder,
        openFolderDialog,
        openFiles, setOpenFiles,
        activeFileId, setActiveFileId,
        visibleTabs, setVisibleTabs,
        alignmentPool, setAlignmentPool,
        fileViewStates, setFileViewStates,
        getFileViewState, updateFileViewState,
        loading, setLoading,
        modifiedFiles, setModifiedFiles,
        fileHistory, setFileHistory
    };
}
