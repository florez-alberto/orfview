import React, { memo, useRef, useEffect, useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Check, Activity, FileText } from 'lucide-react';
import { AlignmentResult } from '../../lib/analysis/alignment';
import { ChromatogramTrack } from './ChromatogramTrack';
import type { AlignableSequence } from './AlignmentView';

interface Annotation {
    name: string;
    start: number;
    end: number;
    direction?: 1 | -1;
    color?: string;
    type?: string;
}

interface AlignedSequenceRowProps {
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
    consensusMap: Int32Array;
    visibleRange: { start: number; end: number };
    // Editing
    cursorPos: number | null;
    selectionRange: { start: number, end: number } | null;
    onSetCursor: (pos: number | null) => void;
    onSetSelection: (range: { start: number, end: number } | null) => void;
    // isReference prop was removed in source
    orfAnnotations: Annotation[];
}

export const AlignedSequenceRow = memo(function AlignedSequenceRow({
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
}: AlignedSequenceRowProps) {
    const rowRef = useRef<HTMLDivElement>(null);
    const [gain, setGain] = useState(1.0);
    const draggingRef = useRef<{ start: number } | null>(null);
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

    // Jump to first aligned position
    const handleJumpToAlignment = (e: React.MouseEvent) => {
        e.stopPropagation(); // Don't trigger expand/collapse

        if (!scrollContainerRef.current) return;

        // Find first non-gap position
        const firstAlignedPos = alignment.positions.find(pos => pos.queryPos !== -1);
        if (!firstAlignedPos || firstAlignedPos.refPos === -1) return;

        // Get view position
        const viewPos = consensusMap[firstAlignedPos.refPos];
        if (viewPos === undefined) return;

        // Scroll to position with some padding
        const targetScrollLeft = viewPos * zoom + sidebarWidth - 100;
        scrollContainerRef.current.scrollLeft = Math.max(0, targetScrollLeft);
    };

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
                // Only store if it corresponds to a real base (not a deletion in query i.e. GapQuery)
                // pos.queryPos is -1 for GapQuery (deletion from sequence)
                // We show it as '-'
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
            if (info.type === 'match') textColor = '#e0e0e0';
            else if (info.type === 'mismatch') {
                bgColor = 'rgba(255, 80, 80, 0.5)';
                textColor = '#ff6666';
            } else if (info.type === 'gap_query') {
                textColor = '#888';
            }

            // Selection Logic
            if (info.queryIndex !== -1 && selectionRange) {
                if (info.queryIndex >= selectionRange.start && info.queryIndex < selectionRange.end) {
                    bgColor = 'rgba(79, 195, 247, 0.4)'; // Selection Blue
                    textColor = '#fff';
                }
            }

            // Cursor Logic
            if (info.queryIndex !== -1 && cursorPos === info.queryIndex) {
                borderLeft = '2px solid #4fc3f7';
            }
        }

        return { bgColor, textColor, base, borderLeft };
    };

    return (
        <div
            ref={rowRef}
            onClick={(e) => e.stopPropagation()}
            onMouseUp={() => { draggingRef.current = null; }}
            style={{ display: 'flex', borderBottom: '1px solid #333', backgroundColor: '#1e1e1e' }}
        >
            {/* Sidebar - checkbox and name */}
            <div
                style={{
                    flex: `0 0 ${sidebarWidth}px`,
                    padding: '8px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    borderRight: '1px solid #333',
                    cursor: 'pointer',
                    backgroundColor: '#252526',
                    position: 'sticky',
                    left: 0,
                    zIndex: 20
                }}
                onClick={onToggleExpand}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {hasChromatogram ? (
                        isExpanded ? <ChevronDown size={14} color="#858585" /> : <ChevronRight size={14} color="#858585" />
                    ) : (
                        <div style={{ width: 14 }} />
                    )}
                    <div
                        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
                        style={{
                            width: 16,
                            height: 16,
                            border: `1px solid ${isSelected ? '#4fc3f7' : '#666'}`,
                            borderRadius: 3,
                            backgroundColor: isSelected ? '#4fc3f7' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        {isSelected && <Check size={12} color="#1e1e1e" />}
                    </div>
                    {hasChromatogram ? <Activity size={12} color="#4fc3f7" /> : <FileText size={12} color="#888" />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 4, marginLeft: 22 }}>
                    <span style={{ fontSize: 11, color: isSelected ? '#fff' : '#888', fontWeight: isSelected ? 600 : 400 }}>
                        {seq.name}
                    </span>


                    {/* Controls Column */}
                    <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {/* ORF Button */}
                        {orfAnnotations.length > 0 && (
                            <button
                                onClick={handleJumpToORF}
                                title={`Jump to ${orfAnnotations[orfIndex]?.name || 'ORF'} (${orfIndex + 1}/${orfAnnotations.length})`}
                                style={{
                                    padding: '2px 6px',
                                    fontSize: 9,
                                    backgroundColor: '#2d2d2d',
                                    color: '#4fc3f7',
                                    border: '1px solid #4fc3f7',
                                    borderRadius: 3,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 2,
                                    width: 60
                                }}
                            >
                                <ChevronRight size={10} />
                                ORF
                            </button>
                        )}

                        {/* Jump to Alignment Button */}
                        <button
                            onClick={handleJumpToAlignment}
                            title="Jump to alignment start"
                            style={{
                                padding: '2px 6px',
                                fontSize: 9,
                                backgroundColor: '#4fc3f7',
                                color: '#000',
                                border: 'none',
                                borderRadius: 3,
                                cursor: 'pointer',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 2,
                                width: 60
                            }}
                        >
                            <ChevronRight size={10} />
                            Jump
                        </button>
                    </div>
                </div>
                <div style={{ color: '#666', fontSize: 10, marginLeft: 22 }}>
                    {seq.metadata?.bases} bp • {seq.metadata?.date || ''}
                </div>
                <div style={{ color: '#888', fontSize: 9, marginLeft: 22 }}>
                    {alignment.refStart + 1}-{alignment.refEnd} aligned
                    {alignment.isReverseComplement && (
                        <span style={{ color: '#ff9800', marginLeft: 4 }}>← reverse</span>
                    )}
                </div>
                <div style={{ color: '#888', fontSize: 9, marginLeft: 22 }}>
                    {alignment.mismatches} mismatches
                    {(alignment.gapsInRef + alignment.gapsInQuery > 0) && ` • ${alignment.gapsInRef + alignment.gapsInQuery} gaps`}
                </div>
            </div>

            {/* Sequence content */}
            <div style={{ flex: 1, flexDirection: 'column', display: 'flex', position: 'relative' }}>
                {/* Aligned sequence */}
                <div style={{ whiteSpace: 'nowrap', padding: '8px 0', height: 28, position: 'relative' }}>
                    {/* Spacer for virtualisation */}
                    <div style={{ display: 'inline-block', width: visibleRange.start * zoom }} />

                    {alignedBases.slice(visibleRange.start, visibleRange.end).map((info, i) => {
                        const { bgColor, textColor, base, borderLeft } = getBaseStyle(info);
                        const globalViewIdx = visibleRange.start + i;
                        const queryIdx = info?.queryIndex ?? -1;

                        const handleMouseDown = (e: React.MouseEvent) => {
                            if (queryIdx === -1) return;
                            e.stopPropagation();
                            // Left Click
                            if (e.button === 0) {
                                draggingRef.current = { start: queryIdx };

                                if (e.shiftKey && selectionRange) {
                                    // Extend selection
                                    const start = Math.min(selectionRange.start, queryIdx);
                                    const end = Math.max(selectionRange.start, queryIdx) + 1; // +1 to capture current base
                                    onSetSelection({ start, end });
                                    onSetCursor(null);
                                } else {
                                    // Set Cursor
                                    onSetCursor(queryIdx);
                                    onSetSelection(null);
                                }
                            }
                        };

                        const handleMouseEnter = (e: React.MouseEvent) => {
                            if (queryIdx === -1) return;
                            if (e.buttons === 1 && draggingRef.current) {
                                // Dragging
                                const start = Math.min(draggingRef.current.start, queryIdx);
                                const end = Math.max(draggingRef.current.start, queryIdx) + 1; // +1 to capture current base
                                onSetSelection({ start, end });
                                onSetCursor(null);
                            }
                        };

                        return (
                            <span
                                key={globalViewIdx}
                                onMouseDown={handleMouseDown}
                                onMouseEnter={handleMouseEnter}
                                style={{
                                    display: 'inline-block',
                                    width: zoom,
                                    textAlign: 'center',
                                    backgroundColor: bgColor,
                                    color: textColor,
                                    fontFamily: 'monospace',
                                    fontSize: 12,
                                    cursor: 'text',
                                    borderLeft: borderLeft,
                                    boxSizing: 'border-box' // Important for border not to shift width
                                }}
                            >
                                {base}
                            </span>
                        );
                    })}
                </div>

                {/* Chromatogram with Gain Slider */}
                {isExpanded && hasChromatogram && (
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', position: 'relative' }}>
                        <ChromatogramTrack
                            seq={seq}
                            alignment={alignment}
                            zoom={zoom}
                            consensusMap={consensusMap}
                            visibleRange={visibleRange}
                            refLength={refLength}
                            isExpanded={isExpanded}
                            gain={gain}
                        />

                        {/* Gain Slider - Sticky Right */}
                        <div style={{
                            width: 30,
                            height: 80,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#1a1a1a',
                            borderLeft: '1px solid #333',
                            position: 'sticky',
                            right: 0,
                            zIndex: 25
                        }}>
                            <input
                                type="range"
                                min="0.1"
                                max="5.0"
                                step="0.1"
                                value={gain}
                                onChange={(e) => setGain(parseFloat(e.target.value))}
                                style={{
                                    writingMode: 'vertical-lr',
                                    direction: 'rtl',
                                    width: 10,
                                    height: 60,
                                    cursor: 'ns-resize'
                                }}
                                title={`Gain: ${gain.toFixed(1)}x`}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
