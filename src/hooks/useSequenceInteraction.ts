import { useState, useEffect, useRef } from 'react';

interface UseSequenceInteractionProps {
    sequence: string;
    onUpdateSequence?: (newSeq: string) => void;
}

export function useSequenceInteraction({ sequence, onUpdateSequence }: UseSequenceInteractionProps) {
    const [cursor, setCursor] = useState<number | null>(null);
    const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
    const [dontAskDelete, setDontAskDelete] = useState(false);
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        mode: 'insert' | 'replace' | 'delete';
        newText: string;
        originalText?: string;
        pos: number;
        length?: number;
    }>({
        isOpen: false,
        mode: 'insert',
        newText: '',
        pos: 0
    });

    const selectionAnchor = useRef<number | null>(null);

    // Handle Selection (MouseDown)
    const handleSelection = (index: number, isShift: boolean) => {
        index = Math.max(0, Math.min(sequence.length, index));

        if (isShift) {
            const anchor = selectionAnchor.current !== null ? selectionAnchor.current : (cursor !== null ? cursor : 0);
            const start = Math.min(anchor, index);
            const end = Math.max(anchor, index);
            setSelection({ start, end });
            setCursor(null);
            selectionAnchor.current = anchor;
        } else {
            setCursor(index);
            setSelection(null);
            selectionAnchor.current = index;
        }
    };

    // Handle Drag (MouseMove)
    const handleDrag = (index: number) => {
        if (selectionAnchor.current === null) return;

        index = Math.max(0, Math.min(sequence.length, index));
        const anchor = selectionAnchor.current;
        const start = Math.min(anchor, index);
        const end = Math.max(anchor, index);

        setSelection({ start, end });
        setCursor(null);
    };

    // Handle Range Select (e.g. from features)
    const handleSelectRange = (start: number, end: number) => {
        setSelection({ start, end });
        setCursor(null);
        selectionAnchor.current = null;
    };

    // Handle Keyboard Input
    const handleKeyDown = (e: React.KeyboardEvent | KeyboardEvent) => {
        if (!onUpdateSequence) return;

        if (cursor === null && selection === null) return;

        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            let start = 0, end = 0;

            if (selection) {
                start = selection.start;
                end = selection.end;
            } else if (cursor !== null) {
                if (e.key === 'Backspace' && cursor > 0) {
                    start = cursor - 1;
                    end = cursor;
                } else if (e.key === 'Delete' && cursor < sequence.length) {
                    start = cursor;
                    end = cursor + 1;
                } else {
                    return;
                }
            }

            const targetString = sequence.slice(start, end);

            if (dontAskDelete) {
                const newSeq = sequence.slice(0, start) + sequence.slice(end);
                onUpdateSequence(newSeq);
                setCursor(start);
                setSelection(null);
            } else {
                setDialogState({
                    isOpen: true,
                    mode: 'delete',
                    newText: '',
                    originalText: targetString,
                    pos: start,
                    length: end - start
                });
            }
        } else if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
            e.preventDefault();
            const char = e.key.toUpperCase();
            // Valid DNA?
            if (!['A', 'T', 'C', 'G', 'U', 'N', 'R', 'Y', 'K', 'M', 'S', 'W', 'B', 'D', 'H', 'V'].includes(char)) return;

            if (selection) {
                // Replace mode
                setDialogState({
                    isOpen: true,
                    mode: 'replace',
                    newText: char,
                    originalText: sequence.slice(selection.start, selection.end),
                    pos: selection.start,
                    length: selection.end - selection.start
                });
            } else if (cursor !== null) {
                // Insert mode
                setDialogState({
                    isOpen: true,
                    mode: 'insert',
                    newText: char,
                    pos: cursor
                });
            }
        }
    };

    useEffect(() => {
        const handleCopy = async () => {
            if (selection) {
                const start = Math.min(selection.start, selection.end);
                const end = Math.max(selection.start, selection.end);
                const text = sequence.slice(start, end);
                await navigator.clipboard.writeText(text);
            }
        };

        const handleCut = async () => {
            if (!onUpdateSequence) return;
            if (selection) {
                const start = Math.min(selection.start, selection.end);
                const end = Math.max(selection.start, selection.end);
                const text = sequence.slice(start, end);
                await navigator.clipboard.writeText(text);

                const newSeq = sequence.slice(0, start) + sequence.slice(end);
                onUpdateSequence(newSeq);
                setSelection(null);
                setCursor(start);
            }
        };

        const handlePaste = async () => {
            if (!onUpdateSequence) return;
            try {
                const text = await navigator.clipboard.readText();
                if (!text) return;

                let newSeq = sequence;
                let newCursor = 0;

                if (selection) {
                    const start = Math.min(selection.start, selection.end);
                    const end = Math.max(selection.start, selection.end);
                    newSeq = sequence.slice(0, start) + text + sequence.slice(end);
                    newCursor = start + text.length;
                } else if (cursor !== null) {
                    newSeq = sequence.slice(0, cursor) + text + sequence.slice(cursor);
                    newCursor = cursor + text.length;
                } else {
                    return;
                }

                onUpdateSequence(newSeq);
                setSelection(null);
                setCursor(newCursor);
            } catch (e) {
                console.error('Paste failed', e);
            }
        };

        const onCopyEvent = () => handleCopy();
        const onCutEvent = () => handleCut();
        const onPasteEvent = () => handlePaste();

        window.addEventListener('app:copy', onCopyEvent);
        window.addEventListener('app:cut', onCutEvent);
        window.addEventListener('app:paste', onPasteEvent);

        return () => {
            window.removeEventListener('app:copy', onCopyEvent);
            window.removeEventListener('app:cut', onCutEvent);
            window.removeEventListener('app:paste', onPasteEvent);
        };
    }, [selection, cursor, sequence, onUpdateSequence]);

    const handleConfirmEdit = (dontAsk?: boolean) => {
        if (!onUpdateSequence) return;
        const { pos, length, newText, mode } = dialogState;

        if (dontAsk) {
            setDontAskDelete(true);
        }

        let updatedSeq = sequence;
        if (mode === 'insert') {
            updatedSeq = updatedSeq.slice(0, pos) + newText + updatedSeq.slice(pos);
        } else if (mode === 'replace') {
            updatedSeq = updatedSeq.slice(0, pos) + newText + updatedSeq.slice(pos + (length || 0));
        } else if (mode === 'delete') {
            updatedSeq = updatedSeq.slice(0, pos) + updatedSeq.slice(pos + (length || 0));
        }

        onUpdateSequence(updatedSeq);
        setDialogState(prev => ({ ...prev, isOpen: false }));
        setSelection(null);
        setCursor(pos + (mode === 'delete' ? 0 : newText.length));
    };

    return {
        cursor, setCursor,
        selection, setSelection,
        dialogState, setDialogState,
        handleSelection,
        handleDrag,
        handleSelectRange,
        handleConfirmEdit,
        handleKeyDown,
        hasSelectionAnchor: selectionAnchor.current !== null
    };
}
