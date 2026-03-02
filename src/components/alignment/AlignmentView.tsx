/**
 * AlignmentView Component
 * 
 * Layout: Reference sequence on top, aligned sequences stacked below.
 * All sequences scroll together horizontally.
 * Chromatograms are shown aligned to reference positions.
 * Features: vertical hover highlight, integrated sidebar.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { AB1Data } from '../../lib/parsers/ab1Parser';
import { CutSite } from '../../lib/analysis/restrictionEnzymes';
import { Activity, FileText, X } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useColumnResize } from '../../hooks/useColumnResize';
import { useAlignmentDragDrop } from '../../hooks/useAlignmentDragDrop';
import { useAlignmentEdit } from '../../hooks/useAlignmentEdit';
import { useAlignmentData } from '../../hooks/useAlignmentData';
import { useTrackExpansion } from '../../hooks/useTrackExpansion';
import { useAlignmentScroll } from '../../hooks/useAlignmentScroll';



export interface AlignableSequence {
    id: string;
    name: string;
    sequence: string;
    chromatogramData?: AB1Data;
    metadata?: {
        date?: string;
        bases?: number;
        filePath?: string;
    };
}

interface AlignmentViewProps {
    referenceSequence: string;
    referenceName?: string;
    referenceId?: string;
    availableSequences: AlignableSequence[];
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    cutSites?: CutSite[];
    annotations?: Array<{
        name: string;
        start: number;
        end: number;
        direction?: 1 | -1;
        color?: string;
        type?: string;
    }>;
    onDropFile?: (path: string) => void;
    onRemoveSequence?: (ids: string[]) => void;
    onUpdateSequence?: (id: string, newSequence: string) => void;
}


// Import Edit Dialog
import { EditConfirmationDialog } from './EditConfirmationDialog';
import { AlignedSequenceRow } from './AlignedSequenceRow';
import { ReferenceHeader } from './ReferenceHeader';

// ... (existing imports)

export function AlignmentView({
    referenceSequence,
    referenceName = 'Reference',
    referenceId,
    availableSequences,
    selectedIds,
    onSelectionChange,
    cutSites: _cutSites = [],
    annotations = [],
    onDropFile,
    onRemoveSequence,
    onUpdateSequence
}: AlignmentViewProps) {
    // Track Expansion State (via hook)
    const { expandedTracks, toggleTrackExpansion } = useTrackExpansion({ availableSequences });
    const [zoom, setZoom] = useState(10);
    const [hoveredEnzyme, setHoveredEnzyme] = useState<string | null>(null);
    const {
        headerHeight, isResizingHeader, headerRef, startHeaderResize,
        sidebarWidth, isResizingSidebar, startSidebarResize
    } = useColumnResize({ initialSidebarWidth: 200 });
    const [hoveredPos, setHoveredPos] = useState<number | null>(null);

    // Scroll & Virtualisation State (via hook)
    const { visibleRange, scrollContainerRef, handleScroll } = useAlignmentScroll({ zoom, sidebarWidth });

    // Alignment Data (Calculation & State)
    const {
        alignments,
        setAlignments,
        alignmentCache,
        manualOverrideIds,
        handleRealign
    } = useAlignmentData({
        referenceSequence,
        availableSequences,
        selectedIds
    });

    // Editing State & Interaction (via hook)
    const {
        editCursor,
        setEditCursor,
        editSelection,
        setEditSelection,
        selectionAnchor,
        dialogState,
        setDialogState,
        confirmEdit
    } = useAlignmentEdit({
        availableSequences,
        referenceSequence,
        referenceId,
        onUpdateSequence,
        alignments,
        setAlignments,
        alignmentCache,
        manualOverrideIds
    });



    // Drag-Drop State (via hook)
    const { isDragOver, handleDragOver, handleDragLeave, handleDrop } = useAlignmentDragDrop({ onDropFile });







    // Calculate Consensus / Gapped Reference (MVP 2.1)
    const consensusState = useMemo(() => {
        if (!referenceSequence) return {
            consensusSequence: '',
            refToViewMap: new Int32Array(0),
            gapsAfter: new Int16Array(0),
            gapsBeforeStart: 0
        };

        const refLen = referenceSequence.length;
        const gapsAfter = new Int16Array(refLen).fill(0);
        let gapsBeforeStart = 0;

        // Pass 1: Measure Max Gaps
        alignments.forEach(aln => {
            let currentRefPos = aln.refStart - 1; // Start anchor
            let consecutiveGaps = 0;

            for (const pos of aln.positions) {
                if (pos.refPos !== -1) {
                    // Valid Ref Base
                    if (consecutiveGaps > 0) {
                        if (currentRefPos < 0) {
                            gapsBeforeStart = Math.max(gapsBeforeStart, consecutiveGaps);
                        } else if (currentRefPos < refLen) {
                            gapsAfter[currentRefPos] = Math.max(gapsAfter[currentRefPos], consecutiveGaps);
                        }
                    }
                    consecutiveGaps = 0;
                    currentRefPos = pos.refPos;
                } else {
                    // Insertion (Gap in Ref)
                    consecutiveGaps++;
                }
            }
            // Trailing gaps
            if (consecutiveGaps > 0) {
                if (currentRefPos < 0) {
                    gapsBeforeStart = Math.max(gapsBeforeStart, consecutiveGaps);
                } else if (currentRefPos < refLen) {
                    gapsAfter[currentRefPos] = Math.max(gapsAfter[currentRefPos], consecutiveGaps);
                }
            }
        });

        // Construct Consensus String & Map
        let seq = '';
        const map = new Int32Array(refLen).fill(-1);
        let viewIdx = 0;

        // Gaps before start
        if (gapsBeforeStart > 0) {
            seq += '-'.repeat(gapsBeforeStart);
            viewIdx += gapsBeforeStart;
        }

        for (let r = 0; r < refLen; r++) {
            // Add Ref Base
            map[r] = viewIdx;
            seq += referenceSequence[r];
            viewIdx++;

            // Add Gaps after
            const gaps = gapsAfter[r];
            if (gaps > 0) {
                seq += '-'.repeat(gaps);
                viewIdx += gaps;
            }
        }

        return {
            consensusSequence: seq,
            refToViewMap: map,
            gapsAfter,
            gapsBeforeStart
        };

    }, [referenceSequence, alignments]);

    // Compute stacked annotations layout to avoid overlap
    const stackedAnnotations = useMemo(() => {
        const rows: number[] = []; // End position of the last item in each row
        const result: Array<{ ann: typeof annotations[0], row: number }> = [];

        // Sort by start position
        const sorted = [...annotations].sort((a, b) => a.start - b.start);

        for (const ann of sorted) {
            let rowIdx = 0;
            while (true) {
                // Determine if this row is free for this annotation
                if (rows[rowIdx] === undefined || rows[rowIdx] <= ann.start) {
                    rows[rowIdx] = ann.end;
                    result.push({ ann, row: rowIdx });
                    break;
                }
                rowIdx++;
            }
        }
        return { items: result, totalRows: rows.length };
    }, [annotations]);

    // Virtualisation State - Default to a larger window to ensure content on load




    const toggleSelection = useCallback((id: string) => {
        // Mutual Exclusivity: Clear Text Selection/Cursor when selecting a Row
        setEditCursor(null);
        setEditSelection(null);

        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(i => i !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    }, [selectedIds, onSelectionChange]);

    const handleAddFiles = async () => {
        try {
            const selected = await open({
                multiple: true,
                filters: [{ name: 'Sequences', extensions: ['ab1', 'abi', 'fasta', 'fa', 'gb', 'gbk'] }]
            });

            if (selected && onDropFile) {
                const paths = Array.isArray(selected) ? selected : [selected];
                paths.forEach(p => onDropFile(p));
            }
        } catch (err) {
            console.error("Failed to open file dialog:", err);
        }
    };

    const handleClearAll = () => {
        if (onRemoveSequence) {
            onRemoveSequence(availableSequences.map(s => s.id));
        }
        onSelectionChange([]);
    };

    const contentWidth = consensusState.consensusSequence.length * zoom + 100;



    // Initial height measurement
    useEffect(() => {
        if (headerRef.current && headerHeight === null) {
            // Intialize if needed, though auto works fine. 
            // But if we start dragging, we need a value.
        }
    }, []);

    const orfAnnotations = useMemo(() => annotations.filter(ann =>
        ann.type === 'CDS' || ann.name.toLowerCase().includes('orf')
    ), [annotations]);



    return (
        <div
            // Clear cursors when clicking background
            onClick={() => {
                setEditCursor(null);
                setEditSelection(null);
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: '#1e1e1e',
                overflow: 'hidden',
                position: 'relative'
            }}
        >
            <EditConfirmationDialog
                isOpen={dialogState.isOpen}
                mode={dialogState.mode}
                newText={dialogState.newText}
                originalText={dialogState.originalText}
                startIndex={dialogState.pos}
                endIndex={dialogState.mode === 'replace' ? dialogState.pos + (dialogState.length || 0) : undefined}
                sequenceName={availableSequences.find(s => s.id === dialogState.sequenceId)?.name || 'Unknown'}
                onConfirm={confirmEdit}
                onCancel={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
            />
            {/* Drag Overlay */}
            {isDragOver && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(79, 195, 247, 0.15)',
                    border: '2px dashed #4fc3f7',
                    zIndex: 100,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        backgroundColor: '#1e1e1e',
                        padding: '12px 24px',
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        color: '#4fc3f7',
                        fontWeight: 500
                    }}>
                        Drop sequence files to align
                    </div>
                </div>
            )}

            {/* Main scrollable area */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                style={{
                    flex: 1,
                    overflowX: 'auto',
                    overflowY: 'auto',
                    position: 'relative',
                }}
            >
                <div
                    onMouseMove={(e) => {
                        if (!scrollContainerRef.current) return;
                        const rect = scrollContainerRef.current.getBoundingClientRect();

                        // Calculate mouse position relative to the visible viewport (the scroll container)
                        const viewportX = e.clientX - rect.left;

                        // Check if we are hovering over the sticky sidebar area
                        if (viewportX < sidebarWidth) {
                            setHoveredPos(null);
                            return;
                        }

                        // Calculate logical X position within the scrollable content
                        const x = viewportX + scrollContainerRef.current.scrollLeft - sidebarWidth;

                        if (x < 0) {
                            setHoveredPos(null);
                            return;
                        }

                        const idx = Math.floor(x / zoom);
                        if (idx >= 0 && idx < consensusState.consensusSequence.length) {
                            setHoveredPos(idx);
                        } else {
                            setHoveredPos(null);
                        }
                    }}
                    onMouseLeave={() => setHoveredPos(null)}
                    style={{ minWidth: contentWidth + sidebarWidth, position: 'relative' }}
                >
                    {hoveredPos !== null && !editCursor && !editSelection && (
                        <div
                            style={{
                                position: 'absolute',
                                left: sidebarWidth + hoveredPos * zoom,
                                top: 0,
                                width: zoom,
                                height: '100%',
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                pointerEvents: 'none',
                                zIndex: 50,
                            }}
                        />
                    )}

                    <ReferenceHeader
                        referenceSequence={referenceSequence}
                        referenceName={referenceName}
                        referenceId={referenceId}
                        cutSites={_cutSites}
                        headerHeight={headerHeight}
                        sidebarWidth={sidebarWidth}
                        consensusState={consensusState}
                        visibleRange={visibleRange}
                        zoom={zoom}
                        hoveredEnzyme={hoveredEnzyme}
                        setHoveredEnzyme={setHoveredEnzyme}
                        editCursor={editCursor}
                        setEditCursor={setEditCursor}
                        editSelection={editSelection}
                        setEditSelection={setEditSelection}
                        selectionAnchor={selectionAnchor}
                        onRealign={handleRealign}
                        onAddFiles={handleAddFiles}
                        onClearAll={handleClearAll}
                        startHeaderResize={startHeaderResize}
                        startSidebarResize={startSidebarResize}
                        isResizingHeader={isResizingHeader}
                        isResizingSidebar={isResizingSidebar}
                        stackedAnnotations={stackedAnnotations}
                        orfAnnotations={orfAnnotations}
                        headerRef={headerRef}
                    />
                    {selectedIds.map(id => {
                        const seq = availableSequences.find(s => s.id === id);
                        const alignment = alignments.get(id);
                        if (!seq || !alignment) return null;

                        const isExpanded = expandedTracks.has(id);
                        const hasChromatogram = !!seq.chromatogramData;



                        // Check for active cursor/selection
                        const cursor = (editCursor?.sequenceId === id) ? editCursor.pos : null;
                        const selection = (editSelection?.sequenceId === id) ? { start: editSelection.start, end: editSelection.end } : null;

                        return (
                            <AlignedSequenceRow
                                key={id}
                                seq={seq}
                                alignment={alignment}
                                zoom={zoom}
                                isExpanded={isExpanded}
                                hasChromatogram={hasChromatogram}
                                onToggleExpand={() => toggleTrackExpansion(id)}
                                onToggleSelect={() => toggleSelection(id)}
                                isSelected={true}
                                refLength={consensusState.consensusSequence.length}
                                sidebarWidth={sidebarWidth}
                                consensusMap={consensusState.refToViewMap}
                                visibleRange={visibleRange}

                                cursorPos={cursor}
                                selectionRange={selection}
                                onSetCursor={(pos) => setEditCursor(pos !== null ? { sequenceId: id, pos } : null)}
                                onSetSelection={(range) => setEditSelection(range !== null ? { sequenceId: id, ...range } : null)}

                                orfAnnotations={orfAnnotations}
                            />
                        );
                    })}

                    {availableSequences.filter(s => !selectedIds.includes(s.id)).map(seq => (
                        <div
                            key={seq.id}
                            style={{
                                display: 'flex',
                                borderBottom: '1px solid #333',
                                backgroundColor: '#1a1a1a',
                                opacity: 0.7,
                            }}
                        >
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
                                    backgroundColor: '#1a1a1a'
                                }}
                            >
                                {onRemoveSequence && (
                                    <div
                                        onClick={(e) => { e.stopPropagation(); onRemoveSequence([seq.id]); }}
                                        style={{ cursor: 'pointer', padding: 2, marginRight: 4 }}
                                        title="Remove"
                                    >
                                        <X size={14} color="#666" />
                                    </div>
                                )}

                                <div
                                    onClick={() => toggleSelection(seq.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer' }}
                                >
                                    <div style={{
                                        width: 14,
                                        height: 14,
                                        border: '1px solid #666',
                                        borderRadius: 3,
                                    }} />
                                    {seq.chromatogramData ? <Activity size={12} color="#666" /> : <FileText size={12} color="#666" />}
                                    <span style={{ color: '#888', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {seq.name}
                                    </span>
                                </div>
                            </div>
                            <div style={{ flex: 1, padding: '8px 0', color: '#555', fontSize: 11 }}>
                                Click checkbox to align
                            </div>
                        </div>
                    ))}

                    {availableSequences.length === 0 && (
                        <div style={{ padding: 40, textAlign: 'center', color: '#858585' }}>
                            <p>No sequences available.</p>
                            <p style={{ fontSize: 12, marginTop: 8 }}>
                                Drag AB1/FASTA/GB files here to add them for alignment.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Zoom Controls */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderTop: '1px solid #333',
                backgroundColor: '#252526',
            }}>
                <span style={{ color: '#858585', fontSize: 11 }}>Zoom:</span>
                <input
                    type="range"
                    min={5}
                    max={20}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    style={{ width: 100 }}
                />
                <span style={{ color: '#858585', fontSize: 11 }}>{zoom}px</span>
            </div>
        </div >
    );
}

