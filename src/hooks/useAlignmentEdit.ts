import { useState, useRef, useEffect, useCallback } from 'react';
import { AlignmentResult } from '../lib/analysis/alignment';
import { patchAlignment } from '../lib/analysis/alignment-patch';
import { AlignableSequence } from '../lib/types';

interface UseAlignmentEditProps {
    referenceId?: string;
    referenceSequence: string;
    availableSequences: AlignableSequence[];
    onUpdateSequence?: (id: string, newSequence: string) => void;
    alignments: Map<string, AlignmentResult>;
    setAlignments: React.Dispatch<React.SetStateAction<Map<string, AlignmentResult>>>;
    alignmentCache: React.MutableRefObject<Map<string, AlignmentResult>>;
    manualOverrideIds: React.MutableRefObject<Set<string>>;
}

/**
 * Manages editing state and operations for the Alignment View.
 * Handles cursors, selections, keyboard input, and clipboard operations.
 * 
 * @param props - Dependencies for editing logic
 * @returns Editing state and handlers
 */
export function useAlignmentEdit({
    referenceId,
    referenceSequence,
    availableSequences,
    onUpdateSequence,
    alignments,
    setAlignments,
    alignmentCache,
    manualOverrideIds
}: UseAlignmentEditProps) {
    // Selection State
    const [editCursor, setEditCursor] = useState<{ sequenceId: string, pos: number } | null>(null);
    const [editSelection, setEditSelection] = useState<{ sequenceId: string, start: number, end: number } | null>(null);
    const selectionAnchor = useRef<number | null>(null);

    // Dialog State
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        mode: 'insert' | 'replace' | 'delete';
        newText: string;
        originalText?: string;
        pos: number;
        length?: number;
        sequenceId: string;
    }>({ isOpen: false, mode: 'insert', newText: '', pos: 0, sequenceId: '' });

    const [dontAskDelete, setDontAskDelete] = useState(false);

    // Dispatch selection info to StatusBar (count bases excluding gaps)
    useEffect(() => {
        if (!editSelection) {
            window.dispatchEvent(new CustomEvent('alignment:selection', { detail: null }));
            return;
        }

        const alignment = alignments.get(editSelection.sequenceId);
        const seq = availableSequences.find(s => s.id === editSelection.sequenceId);
        const sequenceName = seq?.name;

        // Count actual bases in selection (not gaps)
        let baseCount = 0;
        if (alignment) {
            // Use alignment positions to count non-gap bases in the selected range
            for (const pos of alignment.positions) {
                const viewPos = pos.refPos !== -1 ? pos.refPos : -1;
                if (viewPos >= editSelection.start && viewPos < editSelection.end && pos.queryBase !== '-') {
                    baseCount++;
                }
            }
            if (baseCount === 0) {
                baseCount = editSelection.end - editSelection.start;
            }
        } else {
            baseCount = editSelection.end - editSelection.start;
        }

        window.dispatchEvent(new CustomEvent('alignment:selection', {
            detail: { count: baseCount, sequenceName }
        }));

        return () => {
            window.dispatchEvent(new CustomEvent('alignment:selection', { detail: null }));
        };
    }, [editSelection, alignments, availableSequences]);

    const confirmEdit = useCallback((dontAsk?: boolean, editedText?: string) => {
        if (!onUpdateSequence) return;
        const { sequenceId, pos, length, newText, mode } = dialogState;
        const textToUse = (editedText !== undefined) ? editedText : newText;

        if (dontAsk) {
            setDontAskDelete(true);
        }
        const seq = availableSequences.find(s => s.id === sequenceId);
        const currentSeqStr = (sequenceId === referenceId) ? referenceSequence : (seq?.sequence);

        if (!currentSeqStr && sequenceId !== referenceId) return;
        const baseSeq = currentSeqStr || "";

        let updatedSeq = baseSeq;
        if (mode === 'insert') {
            updatedSeq = updatedSeq.slice(0, pos) + textToUse + updatedSeq.slice(pos);
        } else if (mode === 'replace') {
            updatedSeq = updatedSeq.slice(0, pos) + textToUse + updatedSeq.slice(pos + (length || 0));
        } else if (mode === 'delete') {
            updatedSeq = updatedSeq.slice(0, pos) + updatedSeq.slice(pos + (length || 0));
        }

        onUpdateSequence(sequenceId, updatedSeq);
        setDialogState(prev => ({ ...prev, isOpen: false }));
        setEditCursor(null);
        setEditSelection(null);

        const currentAlign = alignments.get(sequenceId);
        if (currentAlign) {
            manualOverrideIds.current.add(sequenceId);

            let patchType: 'insert' | 'delete' | 'replace' = 'replace';
            if (mode === 'insert') patchType = 'insert';
            else if (mode === 'delete') patchType = 'delete';

            const patched = patchAlignment(currentAlign, {
                type: patchType,
                queryIndex: pos,
                newBase: textToUse
            });

            alignmentCache.current.set(sequenceId, patched);
            setAlignments(prev => {
                const next = new Map(prev);
                next.set(sequenceId, patched);
                return next;
            });
        }
    }, [dialogState, onUpdateSequence, availableSequences, referenceId, referenceSequence, alignments, alignmentCache, manualOverrideIds, setAlignments]);

    const getCurrentSequence = (id: string): { text: string; offset: number } | null => {
        const passedAlignment = alignments.get(id);
        if (passedAlignment) {
            return {
                text: passedAlignment.alignedQuery.replace(/-/g, ''),
                offset: passedAlignment.queryStart
            };
        }

        if (id === referenceId) return { text: referenceSequence, offset: 0 };
        const seq = availableSequences.find(s => s.id === id);
        return seq ? { text: seq.sequence, offset: 0 } : null;
    };

    // Keyboard Handlers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!onUpdateSequence) return;
            if (!editCursor && !editSelection) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const isDeleteKey = e.key === 'Delete' || e.key === 'Backspace';

            if (e.key.length === 1 || isDeleteKey) {
                const targetId = editCursor ? editCursor.sequenceId : editSelection!.sequenceId;
                const currentData = getCurrentSequence(targetId);
                if (!currentData) return;
                const { text: targetSeqString, offset } = currentData;

                if (isDeleteKey) {
                    if (editSelection) {
                        const start = editSelection.start - offset;
                        const end = editSelection.end - offset;

                        if (start < 0 || end > targetSeqString.length) return;

                        const targetString = targetSeqString.slice(start, end);

                        if (dontAskDelete) {
                            let updatedSeq = targetSeqString.slice(0, start) + targetSeqString.slice(end);
                            onUpdateSequence(targetId, updatedSeq);
                            setEditCursor(null);
                            setEditSelection(null);
                        } else {
                            setDialogState({
                                isOpen: true,
                                mode: 'delete',
                                newText: '',
                                originalText: targetString,
                                pos: editSelection.start, // Keep absolute pos for updates
                                length: editSelection.end - editSelection.start,
                                sequenceId: targetId
                            });
                        }
                    }
                    return;
                }

                if (editSelection) {
                    const start = editSelection.start - offset;
                    const end = editSelection.end - offset;

                    if (start < 0 || end > targetSeqString.length) return;

                    setDialogState({
                        isOpen: true,
                        mode: 'replace',
                        newText: e.key.toUpperCase(),
                        originalText: targetSeqString.slice(start, end),
                        pos: editSelection.start,
                        length: editSelection.end - editSelection.start,
                        sequenceId: targetId
                    });
                } else {
                    setDialogState({
                        isOpen: true,
                        mode: 'insert',
                        newText: e.key.toUpperCase(),
                        pos: editCursor!.pos,
                        sequenceId: targetId
                    });
                }
            }
        };

        const handlePasteLogic = async (text: string) => {
            if (!onUpdateSequence) return;
            if (!text) return;

            const targetId = editCursor ? editCursor.sequenceId : (editSelection ? editSelection.sequenceId : null);
            if (!targetId) return;

            const currentData = getCurrentSequence(targetId);
            if (!currentData) return;
            const { text: targetSeqString, offset } = currentData;

            if (editSelection) {
                const start = editSelection.start - offset;
                const end = editSelection.end - offset;

                if (start < 0 || end > targetSeqString.length) return;

                setDialogState({
                    isOpen: true,
                    mode: 'replace',
                    newText: text.toUpperCase(),
                    originalText: targetSeqString.slice(start, end),
                    pos: editSelection.start,
                    length: editSelection.end - editSelection.start,
                    sequenceId: targetId
                });
            } else if (editCursor) {
                setDialogState({
                    isOpen: true,
                    mode: 'insert',
                    newText: text.toUpperCase(),
                    pos: editCursor.pos,
                    sequenceId: targetId
                });
            }
        };

        const handlePasteNative = (e: ClipboardEvent) => {
            if (!editCursor && !editSelection) return;
            e.preventDefault();
            const text = e.clipboardData?.getData('text/plain') || '';
            handlePasteLogic(text);
        };

        const handlePasteCustom = async () => {
            const text = await navigator.clipboard.readText();
            handlePasteLogic(text);
        };

        const handleCutCustom = async () => {
            if (!onUpdateSequence || !editSelection) return;
            const targetId = editSelection.sequenceId;
            const currentData = getCurrentSequence(targetId);
            if (!currentData) return;
            const { text: targetSeqString, offset } = currentData;

            const start = editSelection.start - offset;
            const end = editSelection.end - offset;

            if (start < 0 || end > targetSeqString.length) return;

            const textToCopy = targetSeqString.slice(start, end);
            await navigator.clipboard.writeText(textToCopy);

            if (dontAskDelete) {
                const updatedSeq = targetSeqString.slice(0, start) + targetSeqString.slice(end);
                onUpdateSequence(targetId, updatedSeq);
                setEditCursor({ sequenceId: targetId, pos: editSelection.start });
                setEditSelection(null);
            } else {
                setDialogState({
                    isOpen: true,
                    mode: 'delete',
                    newText: '',
                    originalText: textToCopy,
                    pos: editSelection.start,
                    length: editSelection.end - editSelection.start,
                    sequenceId: targetId
                });
            }
        };

        const handleGlobalMouseUp = () => {
            selectionAnchor.current = null;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('paste', handlePasteNative);
        window.addEventListener('app:paste', handlePasteCustom);
        window.addEventListener('app:cut', handleCutCustom);
        window.addEventListener('mouseup', handleGlobalMouseUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('paste', handlePasteNative);
            window.removeEventListener('app:paste', handlePasteCustom);
            window.removeEventListener('app:cut', handleCutCustom);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [editCursor, editSelection, availableSequences, onUpdateSequence, referenceId, dontAskDelete, referenceSequence, alignments]);

    // Copy Handler
    useEffect(() => {
        const handleCopyLogic = () => {
            if (!editSelection) return false;

            const targetId = editSelection.sequenceId;
            const currentData = getCurrentSequence(targetId);
            if (!currentData) return false;
            const { text: targetSeqString, offset } = currentData;

            const start = editSelection.start - offset;
            const end = editSelection.end - offset;

            if (start < 0 || end > targetSeqString.length) return false;

            const textToCopy = targetSeqString.slice(start, end);

            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy);
                console.log('Copied to clipboard:', textToCopy);
                return true;
            }
            return false;
        };

        const handleCopyNative = (e: ClipboardEvent) => {
            if (handleCopyLogic()) e.preventDefault();
        };

        window.addEventListener('copy', handleCopyNative);
        window.addEventListener('app:copy', handleCopyLogic);
        return () => {
            window.removeEventListener('copy', handleCopyNative);
            window.removeEventListener('app:copy', handleCopyLogic);
        };
    }, [editSelection, referenceId, referenceSequence, availableSequences, alignments]);

    return {
        editCursor,
        setEditCursor,
        editSelection,
        setEditSelection,
        selectionAnchor,
        dialogState,
        setDialogState,
        dontAskDelete,
        setDontAskDelete,
        confirmEdit
    };
}
