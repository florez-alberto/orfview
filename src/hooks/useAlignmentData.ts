import { useState, useRef, useEffect } from 'react';
import { AlignmentResult, localAlign } from '../lib/analysis/alignment';
import { AlignableSequence } from '../lib/types';

interface UseAlignmentDataProps {
    referenceSequence: string;
    availableSequences: AlignableSequence[];
    selectedIds: string[];
}

/**
 * Manages the alignment data state, caching, and background computation.
 * 
 * @param props - Dependencies for alignment calculation
 * @returns Alignment state and refs required for editing
 */
export function useAlignmentData({
    referenceSequence,
    availableSequences,
    selectedIds
}: UseAlignmentDataProps) {
    const [alignments, setAlignments] = useState<Map<string, AlignmentResult>>(new Map());
    const alignmentCache = useRef<Map<string, AlignmentResult>>(new Map());
    const prevRefSeq = useRef(referenceSequence);
    const prevSelectedIdsJson = useRef<string>("");

    const manualOverrideIds = useRef<Set<string>>(new Set());
    const sequenceContentCache = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        let isMounted = true;

        if (prevRefSeq.current !== referenceSequence) {
            alignmentCache.current.clear();
            sequenceContentCache.current.clear();
            prevRefSeq.current = referenceSequence;
        }

        // Check for content changes in selected sequences
        selectedIds.forEach(id => {
            const seq = availableSequences.find(s => s.id === id);
            if (seq) {
                const cachedContent = sequenceContentCache.current.get(id);
                if (cachedContent !== undefined && cachedContent !== seq.sequence) {
                    alignmentCache.current.delete(id);
                    sequenceContentCache.current.delete(id);
                    manualOverrideIds.current.delete(id);
                }
            }
        });

        const currentIdsJson = JSON.stringify(selectedIds.sort());
        prevSelectedIdsJson.current = currentIdsJson;

        const computeNeeded = selectedIds.filter(id => !alignmentCache.current.has(id));
        const currentResults = new Map<string, AlignmentResult>();

        selectedIds.forEach(id => {
            if (alignmentCache.current.has(id)) {
                currentResults.set(id, alignmentCache.current.get(id)!);
            }
        });

        setAlignments(new Map(currentResults));

        if (computeNeeded.length > 0) {
            setTimeout(() => {
                if (!isMounted) return;

                computeNeeded.forEach(id => {
                    if (manualOverrideIds.current.has(id)) {
                        if (alignmentCache.current.has(id)) {
                            currentResults.set(id, alignmentCache.current.get(id)!);
                        }
                        return;
                    }

                    const seq = availableSequences.find(s => s.id === id);
                    if (seq) {
                        try {
                            const alignment = localAlign(referenceSequence, seq.sequence);
                            alignmentCache.current.set(id, alignment);
                            sequenceContentCache.current.set(id, seq.sequence);
                            currentResults.set(id, alignment);
                        } catch (e) {
                            console.error("Alignment error:", e);
                        }
                    }
                });

                if (isMounted) {
                    setAlignments(new Map(currentResults));
                }
            }, 0);
        }

        return () => { isMounted = false; };
    }, [referenceSequence, availableSequences, selectedIds, alignments.size]);

    const handleRealign = () => {
        manualOverrideIds.current.clear();
        alignmentCache.current.clear();
        prevRefSeq.current = "";
        setAlignments(new Map());
    };

    return {
        alignments,
        setAlignments,
        alignmentCache,
        manualOverrideIds,
        handleRealign
    };
}
