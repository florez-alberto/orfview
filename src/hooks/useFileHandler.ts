import { useState, useEffect } from 'react';
import { useFileSystem } from './useFileSystem';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { loadAB1File } from '../lib/parsers/ab1Parser';
import { parseGenBank, serializeGenBank, genBankToSeqVizAnnotations } from '../lib/parsers/genbankParser';
import { parseFasta } from '../lib/parsers/fastaParser';
import { ActiveFile } from '../lib/types';
import { useWorkspaceState } from './useWorkspaceState';
import { settingsManager } from '../lib/settings/settingsManager';

// Helper for sequence data extraction (moved from App.tsx)
export const getSequenceData = (file: ActiveFile | null) => {
    if (!file) return { sequence: undefined, annotations: undefined };

    if (file.type === 'genbank') {
        return {
            sequence: file.data.sequence,
            annotations: genBankToSeqVizAnnotations(file.data.features)
        };
    }
    if (file.type === 'fasta') {
        return {
            sequence: file.data[0]?.sequence,
            annotations: undefined
        };
    }
    if (file.type === 'text') {
        return { sequence: file.content, annotations: undefined };
    }
    if (file.type === 'json' as any) {
        return { sequence: (file as any).content, annotations: undefined };
    }
    return { sequence: undefined, annotations: undefined };
};

export function useFileHandler(workspace: ReturnType<typeof useWorkspaceState>) {
    const { readFile } = useFileSystem();

    // Unpack workspace dependencies
    const {
        openFiles, setOpenFiles,
        activeFileId, setActiveFileId,
        visibleTabs, setVisibleTabs, setLoading,
        alignmentPool, setAlignmentPool,
        setModifiedFiles, setFileHistory, fileHistory,
        getFileViewState, updateFileViewState
    } = workspace;

    const [lastEditedFileId, setLastEditedFileId] = useState<string | null>(null);

    useEffect(() => {
        if (activeFileId) {
            setLastEditedFileId(activeFileId);
        }
    }, [activeFileId]);

    const handleOpenFile = async (path: string) => {
        const existing = openFiles.find(f => f.path === path);
        if (existing) {
            setActiveFileId(path);
            setVisibleTabs(prev => new Set(prev).add(path));
            return;
        }

        setLoading(true);
        try {
            const ext = path.toLowerCase().split('.').pop();
            let newFile: ActiveFile;

            // Intercept settings.json
            if (path === 'settings.json') {
                const content = settingsManager.getAsString();
                newFile = { type: 'json' as any, path: 'settings.json', content };

                setOpenFiles(prev => {
                    const existingIndex = prev.findIndex(f => f.path === 'settings.json');
                    if (existingIndex >= 0) {
                        const newFiles = [...prev];
                        newFiles[existingIndex] = newFile;
                        return newFiles;
                    }
                    return [...prev, newFile];
                });
                setActiveFileId('settings.json');
                setVisibleTabs(prev => new Set(prev).add('settings.json'));
                setLoading(false);
                return;
            }

            if (ext === 'ab1' || ext === 'abi') {
                const data = await loadAB1File(path);
                newFile = { type: 'ab1', path, data };
            } else if (ext === 'gb' || ext === 'gbk' || ext === 'genbank') {
                const content = await readFile(path);
                const data = parseGenBank(content);
                newFile = { type: 'genbank', path, data };
            } else if (ext === 'fasta' || ext === 'fa') {
                const content = await readFile(path);
                const data = parseFasta(content);
                newFile = { type: 'fasta', path, data };
            } else if (ext === 'dna' || ext === 'seq' || ext === 'ape' || ext === 'plas') {
                setLoading(false);
                alert(`File format '.${ext}' is not currently supported.`);
                return;
            } else {
                // Default to text
                const content = await readFile(path);
                newFile = { type: 'text', path, content };
            }

            setOpenFiles(prev => {
                if (prev.some(f => f.path === newFile.path)) return prev;
                return [...prev, newFile];
            });
            setActiveFileId(path);
            setVisibleTabs(prev => new Set(prev).add(path));
            window.dispatchEvent(new CustomEvent('orfview:file-opened', { detail: { path } }));
        } catch (e) {
            console.error("Failed to open file", e);
            alert(`Failed to open file: ${e instanceof Error ? e.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleAddToAlignment = async (path: string) => {
        if (!activeFileId) return;
        const existing = openFiles.find(f => f.path === path);

        try {
            const ext = path.toLowerCase().split('.').pop();
            let newFile: ActiveFile | null = null;
            let sequenceIds: string[] = [];

            if (!existing) {
                if (ext === 'ab1' || ext === 'abi') {
                    const data = await loadAB1File(path);
                    newFile = { type: 'ab1', path, data };
                    sequenceIds = [path];
                } else if (ext === 'fasta' || ext === 'fa') {
                    const content = await readFile(path);
                    const data = parseFasta(content);
                    newFile = { type: 'fasta', path, data };
                    sequenceIds = data.map((_, idx) => `${path}#${idx}`);
                } else if (ext === 'gb' || ext === 'gbk') {
                    const content = await readFile(path);
                    const data = parseGenBank(content);
                    newFile = { type: 'genbank', path, data };
                    sequenceIds = [path]; // Treat as single sequence like AB1
                } else {
                    return;
                }

                setOpenFiles(prev => {
                    if (prev.some(f => f.path === newFile!.path)) return prev;
                    return [...prev, newFile!];
                });
            } else {
                if (existing.type === 'ab1') {
                    sequenceIds = [path];
                } else if (existing.type === 'fasta') {
                    sequenceIds = existing.data.map((_, idx) => `${path}#${idx}`);
                } else if (existing.type === 'genbank') {
                    sequenceIds = [path]; // Treat as single sequence like AB1
                }
            }

            const currentPool = alignmentPool[activeFileId] || [];
            const newIds = sequenceIds.filter(id => !currentPool.includes(id));

            if (newIds.length > 0) {
                setAlignmentPool(prev => {
                    const current = prev[activeFileId] || [];
                    const uniqueNew = newIds.filter(id => !current.includes(id));
                    if (uniqueNew.length === 0) return prev;
                    return { ...prev, [activeFileId]: [...current, ...uniqueNew] };
                });

                updateFileViewState(activeFileId, { viewMode: 'alignment' });
                const currentState = getFileViewState(activeFileId);
                const currentSelected = new Set(currentState.selectedAlignmentIds);
                newIds.forEach(id => currentSelected.add(id));
                updateFileViewState(activeFileId, { selectedAlignmentIds: Array.from(currentSelected) });
            }
        } catch (e) {
            console.error("Failed to add file to alignment", e);
        }
    };

    const handleRemoveFromAlignment = (idsToRemove: string[]) => {
        if (!activeFileId) return;
        setAlignmentPool(prev => {
            const currentPool = prev[activeFileId] || [];
            const newPool = currentPool.filter(id => !idsToRemove.includes(id));
            return { ...prev, [activeFileId]: newPool };
        });

        const currentState = getFileViewState(activeFileId);
        const newSelection = currentState.selectedAlignmentIds.filter(id => !idsToRemove.includes(id));
        updateFileViewState(activeFileId, { selectedAlignmentIds: newSelection });
    };

    const updateFileContent = (path: string, newContent: string, recordHistory = true) => {
        setLastEditedFileId(path); // Update last edited context

        if (recordHistory) {
            setFileHistory(prev => {
                const file = openFiles.find(f => f.path === path);
                if (!file) return prev;

                let oldContent = '';
                if (file.type === 'text') oldContent = file.content;
                else if (file.type === 'ab1') oldContent = file.data.sequence;
                else if (file.type === 'genbank') oldContent = file.data.sequence;
                else if (file.type === 'fasta' && file.data.length > 0) oldContent = file.data[0].sequence;
                else if (file.type === 'json') oldContent = file.content;

                if (oldContent === newContent) return prev;

                const hist = prev[path] || { past: [], future: [] };
                const newPast = [...hist.past, oldContent].slice(-50);
                return { ...prev, [path]: { past: newPast, future: [] } };
            });
        }

        setOpenFiles(prev => prev.map(f => {
            if (f.path === path) {
                if (f.type === 'ab1') return { ...f, data: { ...f.data, sequence: newContent } };
                else if (f.type === 'text') return { ...f, content: newContent };
                else if (f.type === 'json') return { ...f, content: newContent };
                else if (f.type === 'genbank') return { ...f, data: { ...f.data, sequence: newContent } };
                else if (f.type === 'fasta' && f.data.length > 0) {
                    const newData = [...f.data];
                    newData[0] = { ...newData[0], sequence: newContent };
                    return { ...f, data: newData };
                }
            }
            if (f.type === 'fasta' && path.startsWith(f.path + '#')) {
                const idxStr = path.split('#').pop();
                const idx = idxStr ? parseInt(idxStr) : -1;
                if (idx >= 0 && idx < f.data.length) {
                    const newData = [...f.data];
                    newData[idx] = { ...newData[idx], sequence: newContent };
                    return { ...f, data: newData };
                }
            }
            return f;
        }));
        setModifiedFiles(prev => new Set(prev).add(path));
    };

    const handleCloseTab = (pathId: string) => {
        setVisibleTabs(prev => {
            const newSet = new Set(prev);
            newSet.delete(pathId);
            return newSet;
        });

        const isInAlignment = Object.values(alignmentPool).some(pool =>
            pool.some(id => id === pathId || id.startsWith(pathId + '#'))
        );

        if (!isInAlignment) {
            setOpenFiles(prev => prev.filter(f => f.path !== pathId));
            setAlignmentPool(prev => {
                const newPool = { ...prev };
                delete newPool[pathId];
                return newPool;
            });
        }

        if (pathId === activeFileId) {
            const tabsArray = Array.from(visibleTabs);
            const closeIndex = tabsArray.indexOf(pathId);

            if (closeIndex >= 0) {
                let nextTabId: string | null = null;
                // Try to go to the left (previous tab)
                if (closeIndex > 0) nextTabId = tabsArray[closeIndex - 1];
                // If we were the first tab, try to go to the right
                else if (tabsArray.length > 1) nextTabId = tabsArray[closeIndex + 1];
                setActiveFileId(nextTabId);
            } else {
                setActiveFileId(null);
            }
        }
    };

    const handleSaveAs = async () => {
        if (!activeFileId) return;
        const file = openFiles.find(f => f.path === activeFileId);
        if (!file) return;

        try {
            const path = await save({ defaultPath: file.path.split(/[\\/]/).pop() });
            if (!path) return;

            let content = '';
            if (file.type === 'text') content = file.content;
            else if (file.type === 'json') content = file.content;
            else if (file.type === 'ab1') content = file.data.sequence;
            else if (file.type === 'genbank') content = serializeGenBank(file.data);
            else if (file.type === 'fasta') content = file.data.map(s => `>${s.id}\n${s.sequence}`).join('\n\n');

            await invoke('write_file_content', { path, content });
            setOpenFiles(prev => prev.map(f => f.path === activeFileId ? { ...f, path } : f));
            setActiveFileId(path);
            setModifiedFiles(prev => { const n = new Set(prev); n.delete(activeFileId); return n; });
        } catch (e) {
            console.error('Save As failed:', e);
        }
    };

    const handleSave = async () => {
        if (!activeFileId) return;
        const file = openFiles.find(f => f.path === activeFileId);
        if (!file) return;

        if (file.type === 'ab1') {
            handleSaveAs();
            return;
        }

        try {
            if (file.path === 'settings.json') {
                const content = file.type === 'text' ? file.content : (file as any).content;
                settingsManager.saveContent(content);
                setModifiedFiles(prev => { const n = new Set(prev); n.delete(activeFileId); return n; });
                return;
            }

            let content = '';
            if (file.type === 'text') content = file.content;
            else if (file.type === 'json') content = file.content; // Handle JSON save
            else if (file.type === 'genbank') content = serializeGenBank(file.data);
            else if (file.type === 'fasta') content = file.data.map(s => `>${s.id}\n${s.sequence}`).join('\n\n');

            await invoke('write_file_content', { path: file.path, content });
            setModifiedFiles(prev => { const n = new Set(prev); n.delete(activeFileId); return n; });
            window.dispatchEvent(new CustomEvent('orfview:file-saved', { detail: { path: file.path } }));
        } catch (e) {
            console.error('Save failed:', e);
        }
    };

    const handleUndo = () => {
        const targetId = lastEditedFileId || activeFileId;
        if (!targetId) return;

        const hist = fileHistory[targetId];
        if (!hist || hist.past.length === 0) return;

        const previous = hist.past[hist.past.length - 1];
        const newPast = hist.past.slice(0, -1);
        const currentFile = openFiles.find(f => f.path === targetId);
        if (!currentFile) return;

        let currentContent = '';
        if (currentFile.type === 'text') currentContent = currentFile.content;
        else if (currentFile.type === 'json') currentContent = currentFile.content;
        else if (currentFile.type === 'ab1') currentContent = currentFile.data.sequence;
        else if (currentFile.type === 'genbank') currentContent = currentFile.data.sequence;
        else if (currentFile.type === 'fasta' && currentFile.data.length > 0) currentContent = currentFile.data[0].sequence;
        else return;

        setFileHistory(prev => ({
            ...prev,
            [targetId]: {
                past: newPast,
                future: [currentContent, ...hist.future]
            }
        }));
        updateFileContent(targetId, previous, false);
    };

    const handleRedo = () => {
        const targetId = lastEditedFileId || activeFileId;
        if (!targetId) return;

        const hist = fileHistory[targetId];
        if (!hist || hist.future.length === 0) return;

        const next = hist.future[0];
        const newFuture = hist.future.slice(1);
        const currentFile = openFiles.find(f => f.path === targetId);
        if (!currentFile) return;

        let currentContent = '';
        if (currentFile.type === 'text') currentContent = currentFile.content;
        else if (currentFile.type === 'json') currentContent = currentFile.content;
        else if (currentFile.type === 'ab1') currentContent = currentFile.data.sequence;
        else if (currentFile.type === 'genbank') currentContent = currentFile.data.sequence;
        else if (currentFile.type === 'fasta' && currentFile.data.length > 0) currentContent = currentFile.data[0].sequence;
        else return;

        setFileHistory(prev => ({
            ...prev,
            [targetId]: {
                past: [...hist.past, currentContent],
                future: newFuture
            }
        }));
        updateFileContent(targetId, next, false);
    };

    return {
        handleOpenFile,
        handleAddToAlignment,
        handleRemoveFromAlignment,
        updateFileContent,
        handleCloseTab,
        handleSave,
        handleSaveAs,
        handleUndo,
        handleRedo,
        canUndo: (lastEditedFileId || activeFileId) ? ((fileHistory[lastEditedFileId || activeFileId!]?.past.length || 0) > 0) : false,
        canRedo: (lastEditedFileId || activeFileId) ? ((fileHistory[lastEditedFileId || activeFileId!]?.future.length || 0) > 0) : false
    };
}
