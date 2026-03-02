import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { Activity, FileText, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { AlignmentResult } from '../../lib/analysis/alignment';
import { AlignableSequence } from './AlignmentView';
import { ChromatogramTrack } from './ChromatogramTrack';

interface AlignmentRowProps {
    seq: AlignableSequence;
    alignment: AlignmentResult;
    zoom: number;
    isExpanded: boolean;
    hasChromatogram: boolean;
    onToggleExpand: () => void;
    onToggleSelect: () => void;
    isSelected: boolean;
    refLength: number;
    sidebarWidth: number;
    consensusMap: Int32Array | null;
    visibleRange: { start: number; end: number };
    cursorPos: number | null;
    selectionRange: { start: number; end: number } | null;
    onSetCursor: (pos: number | null) => void;
    onSetSelection: (range: { start: number; end: number } | null) => void;
    orfAnnotations: any[];
}

export const AlignmentRow = memo(function AlignmentRow({
    seq,
    alignment,
    zoom,
    isExpanded,
    hasChromatogram,
    onToggleExpand,
    onToggleSelect,
    isSelected,
    refLength,
    sidebarWidth,
    consensusMap,
    visibleRange,
    cursorPos,
    selectionRange,
    onSetCursor,
    onSetSelection,
    orfAnnotations
}: AlignmentRowProps) {
    const rowRef = useRef<HTMLDivElement>(null);
    const [gain] = useState(1.0); // setGain unused
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);

    // Find scroll container (parent with overflow)
    useEffect(() => {
        let el = rowRef.current?.parentElement;
        while (el) {
            const style = window.getComputedStyle(el);
            if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
                scrollContainerRef.current = el as HTMLDivElement;
                break;
            }
            el = el.parentElement;
        }
    }, []);

    // Cycle through ORFs
    const [orfIndex, setOrfIndex] = useState(0);

    const handleJumpToORF = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!orfAnnotations || orfAnnotations.length === 0) return;

        // Safety check
        if (orfIndex >= orfAnnotations.length) {
            setOrfIndex(0);
            return;
        }

        // Get current target
        const orf = orfAnnotations[orfIndex];

        // Advance index for next click
        setOrfIndex((prev) => (prev + 1) % orfAnnotations.length);

        if (!scrollContainerRef.current || !consensusMap) return;

        // Jump logic
        const startView = consensusMap[orf?.start];
        if (startView !== undefined) {
            const targetScrollLeft = startView * zoom + sidebarWidth - 100;
            scrollContainerRef.current.scrollLeft = Math.max(0, targetScrollLeft);
        }
    };

    // Build linear array for aligned bases mapped to View Coordinates
    const alignedBases = useMemo(() => {
        const bases: Array<{ base: string; type: string; queryIndex: number } | null> = new Array(refLength).fill(null);
        if (!consensusMap) return bases;

        let currentRefAnchor = -1;
        let insertionCount = 0;

        // Handle initial anchor if alignment starts late
        if (alignment.positions.length > 0) {
            const first = alignment.positions[0];
            if (first.refPos !== -1) {
                currentRefAnchor = first.refPos - 1;
            } else {
                currentRefAnchor = alignment.refStart - 1;
            }
        }

        for (const pos of alignment.positions) {
            let viewPos = -1;

            if (pos.refPos !== -1) {
                // Match/Mismatch/GapQuery -> Anchored to Ref
                currentRefAnchor = pos.refPos;
                insertionCount = 0;
                viewPos = consensusMap[pos.refPos]; // Array Access O(1)
                if (viewPos === undefined) viewPos = -1;
            } else {
                // Insertion (GapRef) -> Anchored to previous ref + offset
                let anchorView = -1;
                if (currentRefAnchor === -1) {
                    // Before start of ref
                    anchorView = -1;
                } else {
                    anchorView = consensusMap[currentRefAnchor];
                    if (anchorView === undefined) anchorView = -1;
                }
                viewPos = anchorView + 1 + insertionCount;
                insertionCount++;
            }

            if (viewPos >= 0 && viewPos < refLength) {
                bases[viewPos] = {
                    base: pos.queryBase,
                    type: pos.type,
                    queryIndex: pos.queryPos
                };
            }
        }
        return bases;
    }, [alignment, refLength, consensusMap]);

    const getBaseStyle = (info: { base: string; type: string; queryIndex: number } | null) => {
        let bgColor = 'transparent';
        let textColor = '#666';
        let base = '-';
        let borderLeft = 'none';

        if (info) {
            base = info.base;
            if (info.type === 'gap_query') {
                base = '-';
                textColor = '#444';
            } else if (info.type === 'match') {
                textColor = '#e0e0e0';
                if (base === 'G') textColor = '#c0c0c0'; // Slightly dimmer G
            } else if (info.type === 'mismatch') {
                bgColor = 'rgba(255, 0, 0, 0.2)'; // Soft red background
                textColor = '#ff5252';
            } else if (info.type === 'gap_ref') {
                bgColor = 'rgba(255, 165, 0, 0.15)'; // Soft orange
                textColor = '#ffb74d';
            }
        } else {
            // No data mapped here (gap before/after alignment)
            base = ' ';
        }

        return { bgColor, textColor, base, borderLeft };
    };

    return (
        <div
            ref={rowRef}
            style={{
                display: 'flex',
                borderBottom: '1px solid #333',
                backgroundColor: isSelected ? '#2a2a2a' : '#1e1e1e',
                flexDirection: 'column'
            }}
        >
            <div style={{ display: 'flex' }}>
                {/* Fixed Sidebar */}
                <div
                    style={{
                        flex: `0 0 ${sidebarWidth}px`,
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        borderRight: '1px solid #333',
                        position: 'sticky',
                        left: 0,
                        zIndex: 20,
                        backgroundColor: isSelected ? '#2a2a2a' : '#1e1e1e'
                    }}
                >
                    <div
                        onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        {isExpanded ? <ChevronDown size={14} color="#888" /> : <ChevronRight size={14} color="#888" />}
                    </div >

                    <div
                        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}
                    >
                        <div style={{
                            width: 14,
                            height: 14,
                            border: isSelected ? '1px solid #4fc3f7' : '1px solid #666',
                            borderRadius: 3,
                            backgroundColor: isSelected ? 'rgba(79, 195, 247, 0.2)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {isSelected && <Check size={10} color="#4fc3f7" />}
                        </div>
                        {hasChromatogram ? <Activity size={12} color="#4fc3f7" /> : <FileText size={12} color="#aaa" />}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                            <span style={{ color: isSelected ? '#fff' : '#ccc', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {seq.name}
                            </span>
                            <span style={{ color: '#666', fontSize: 10 }}>
                                {seq.sequence.length} bp • {alignment ? `${alignment.score.toFixed(0)} score` : 'Aligning...'}
                            </span>
                        </div>
                    </div>
                    {/* ORF Jump Button */}
                    <button
                        onClick={handleJumpToORF}
                        title={`Jump to next ORF (${orfAnnotations.length})`}
                        style={{
                            backgroundColor: 'transparent',
                            border: '1px solid #444',
                            borderRadius: 3,
                            color: '#888',
                            fontSize: 9,
                            padding: '2px 4px',
                            cursor: 'pointer'
                        }}
                    >
                        ORFs
                    </button>
                </div>

                {/* Sequence Viewer */}
                <div style={{ flex: 1, position: 'relative', height: 22, padding: '8px 0', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-block', width: visibleRange.start * zoom }} />
                    {alignedBases.slice(visibleRange.start, visibleRange.end).map((info, i) => {
                        const idx = visibleRange.start + i;
                        const { bgColor, textColor, base } = getBaseStyle(info);
                        const isCursor = cursorPos === idx;
                        const isRangeSelected = selectionRange && idx >= selectionRange.start && idx < selectionRange.end;

                        return (
                            <span
                                key={idx}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    // Handle selection / cursor
                                    if (e.shiftKey) {
                                        // If we had a selection logic passed down.. 
                                        // The parent passes onSetSelection.
                                        // We need an anchor from parent?
                                        // Simplification: Just notify parent of click details?
                                        // Parent handles the logic. 
                                        // But here we are emitting events.
                                        // Let's implement basics:
                                        // onSetCursor(idx);
                                    } else {
                                        onSetCursor(idx);
                                        onSetSelection(null);
                                    }
                                }}
                                style={{
                                    display: 'inline-block',
                                    width: zoom,
                                    backgroundColor: isRangeSelected ? 'rgba(79, 195, 247, 0.4)' : bgColor,
                                    color: isRangeSelected ? '#fff' : textColor,
                                    fontFamily: 'monospace',
                                    fontSize: 12,
                                    textAlign: 'center',
                                    borderLeft: isCursor ? '2px solid #4fc3f7' : 'none',
                                    boxSizing: 'border-box',
                                    cursor: 'text'
                                }}
                            >
                                {base}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Expanded Content (Chromatogram) */}
            {isExpanded && hasChromatogram && seq.chromatogramData && (
                <div style={{
                    marginLeft: sidebarWidth,
                    borderTop: '1px solid #333',
                    backgroundColor: '#111',
                    position: 'relative',
                    height: 100
                }}>
                    <ChromatogramTrack
                        seq={seq}
                        alignment={alignment}
                        zoom={zoom}
                        visibleRange={visibleRange}
                        consensusMap={consensusMap}
                        gain={gain}
                        refLength={refLength}
                        isExpanded={isExpanded}
                    />
                </div>
            )}
        </div>
    );
});
