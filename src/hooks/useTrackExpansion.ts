import { useState, useRef, useEffect, useCallback } from 'react';

interface ExpansionSequence {
    id: string;
    chromatogramData?: any;
}

interface UseTrackExpansionProps {
    availableSequences: ExpansionSequence[];
}

export function useTrackExpansion({ availableSequences }: UseTrackExpansionProps) {
    const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());

    // Auto-expand new sequences with chromatograms
    const processedIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const newIdsToExpand: string[] = [];
        availableSequences.forEach(seq => {
            if (seq.chromatogramData && !processedIdsRef.current.has(seq.id)) {
                newIdsToExpand.push(seq.id);
                processedIdsRef.current.add(seq.id);
            }
        });
        if (newIdsToExpand.length > 0) {
            setExpandedTracks(prev => {
                const next = new Set(prev);
                newIdsToExpand.forEach(id => next.add(id));
                return next;
            });
        }
    }, [availableSequences]);

    const toggleTrackExpansion = useCallback((id: string) => {
        setExpandedTracks(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    return {
        expandedTracks,
        toggleTrackExpansion
    };
}
