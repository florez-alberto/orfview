import { useState, useEffect, DragEvent } from 'react';

interface UseAlignmentDragDropProps {
    onDropFile?: (path: string) => void;
}

/**
 * Hook for managing file drag-and-drop in the alignment view
 * Handles both Tauri OS drag-drop events and HTML5 drag-drop
 */
export function useAlignmentDragDrop({ onDropFile }: UseAlignmentDragDropProps) {
    const [isDragOver, setIsDragOver] = useState(false);

    useEffect(() => {
        let unlisten: (() => void) | undefined;
        const setupListener = async () => {
            try {
                if (typeof window !== 'undefined' && 'isTauri' in window) {
                    const webview = await import('@tauri-apps/api/webview');
                    if (webview && webview.getCurrentWebview) {
                        unlisten = await webview.getCurrentWebview().onDragDropEvent((event) => {
                            if (event.payload.type === 'over') {
                                setIsDragOver(true);
                            } else if (event.payload.type === 'drop') {
                                const paths = event.payload.paths;
                                if (paths && paths.length > 0 && onDropFile) {
                                    paths.forEach(p => {
                                        const ext = p.toLowerCase().split('.').pop();
                                        if (['ab1', 'abi', 'fasta', 'fa', 'gb', 'gbk'].includes(ext || '')) {
                                            onDropFile(p);
                                        }
                                    });
                                }
                                setIsDragOver(false);
                            } else {
                                setIsDragOver(false);
                            }
                        });
                    }
                }
            } catch (e) {
                console.error("Failed to setup drag drop listener", e);
            }
        };
        setupListener();
        return () => { if (unlisten) unlisten(); };
    }, [onDropFile]);

    // HTML5 Drag-Drop handlers
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragOver(false);
        }
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        let filePath = e.dataTransfer.getData('text/plain');
        if (!filePath && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            // @ts-ignore
            if (file.path) filePath = file.path;
        }

        if (filePath && onDropFile) {
            const ext = filePath.toLowerCase().split('.').pop();
            if (['ab1', 'abi', 'fasta', 'fa', 'gb', 'gbk'].includes(ext || '')) {
                onDropFile(filePath);
            }
        }
    };

    return {
        isDragOver,
        handleDragOver,
        handleDragLeave,
        handleDrop
    };
}
