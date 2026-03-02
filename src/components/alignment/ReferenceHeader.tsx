import React, { memo } from 'react';
import { Plus, Trash2, RotateCw } from 'lucide-react';
import { CutSite } from '../../lib/analysis/restrictionEnzymes';
import { CODON_TABLE } from '../../lib/constants/codonTable';
import { getBaseColor } from '../../lib/utils/dnaUtils';

export interface Annotation {
    name: string;
    start: number;
    end: number;
    direction?: 1 | -1;
    color?: string;
    type?: string;
}

export interface ConsensusState {
    consensusSequence: string;
    refToViewMap: Int32Array;
    gapsAfter: Int16Array;
    gapsBeforeStart: number;
}

interface ReferenceHeaderProps {
    referenceSequence: string;
    referenceName: string;
    referenceId?: string;
    cutSites: CutSite[];
    headerHeight: number | null;
    sidebarWidth: number;
    consensusState: ConsensusState;
    visibleRange: { start: number; end: number };
    zoom: number;
    hoveredEnzyme: string | null;
    setHoveredEnzyme: (id: string | null) => void;
    editCursor: { sequenceId: string; pos: number } | null;
    setEditCursor: (cursor: { sequenceId: string; pos: number } | null) => void;
    editSelection: { sequenceId: string; start: number; end: number } | null;
    setEditSelection: (selection: { sequenceId: string; start: number; end: number } | null) => void;
    selectionAnchor: React.MutableRefObject<number | null>;
    onRealign: () => void;
    onAddFiles: () => void;
    onClearAll: () => void;
    startHeaderResize: (e: React.MouseEvent) => void;
    startSidebarResize: (e: React.MouseEvent) => void;
    isResizingHeader: boolean;
    isResizingSidebar: boolean;
    stackedAnnotations: { items: Array<{ ann: Annotation; row: number }>; totalRows: number };
    orfAnnotations: Annotation[];
    headerRef: React.RefObject<HTMLDivElement>;
}

export const ReferenceHeader = memo(function ReferenceHeader({
    referenceSequence,
    referenceName,
    referenceId,
    cutSites,
    headerHeight,
    sidebarWidth,
    consensusState,
    visibleRange,
    zoom,
    hoveredEnzyme,
    setHoveredEnzyme,
    editCursor,
    setEditCursor,
    editSelection,
    setEditSelection,
    selectionAnchor,
    onRealign,
    onAddFiles,
    onClearAll,
    startHeaderResize,
    startSidebarResize,
    isResizingHeader,
    isResizingSidebar,
    stackedAnnotations,
    orfAnnotations,
    headerRef
}: ReferenceHeaderProps) {

    return (
        <div
            ref={headerRef}
            style={{
                backgroundColor: '#252526',
                position: 'sticky',
                top: 0,
                zIndex: 20,
                display: 'flex',
                // Resize styles
                height: headerHeight ? `${headerHeight}px` : 'auto',
                minHeight: 80,
                paddingBottom: 4 // Space for handle border
            }}
        >
            {/* Sidebar column with controls */}
            <div style={{
                flex: `0 0 ${sidebarWidth}px`,
                borderRight: '1px solid #333',
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                position: 'sticky',
                left: 0,
                zIndex: 30, // Higher than content
                backgroundColor: '#252526' // Ensure opacity
            }}>
                <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>
                        Original Sequence
                    </div>
                    <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>
                        {referenceName}
                    </div>
                    <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>
                        {referenceSequence.length} bp
                    </div>
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', gap: 4, marginTop: 4, paddingTop: 8, borderTop: '1px solid #333' }}>
                    <button
                        onClick={onAddFiles}
                        style={{
                            flex: 1,
                            backgroundColor: '#4fc3f7',
                            color: '#000',
                            border: 'none',
                            borderRadius: 3,
                            padding: '4px',
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4
                        }}
                    >
                        <Plus size={12} /> Add
                    </button>

                    <button
                        onClick={onClearAll}
                        title="Clear All Files"
                        style={{
                            backgroundColor: '#333',
                            color: '#ff6666',
                            border: 'none',
                            borderRadius: 3,
                            padding: '4px 8px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center'
                        }}
                    >
                        <Trash2 size={12} />
                    </button>
                </div>

                <div style={{ position: 'relative' }}>
                    <button
                        onClick={onRealign}
                        style={{
                            marginTop: 4,
                            width: '100%',
                            backgroundColor: '#2d2d2d',
                            color: '#ccc',
                            border: '1px solid #444',
                            borderRadius: 3,
                            padding: '4px',
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4
                        }}
                        title="Re-run alignment algorithm to optimize gaps"
                    >
                        <RotateCw size={11} /> Realign
                    </button>
                    {/* Sidebar Resize Handle */}
                    <div
                        onMouseDown={startSidebarResize}
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            right: -2,
                            width: 4,
                            cursor: 'col-resize',
                            zIndex: 100,
                            backgroundColor: isResizingSidebar ? '#4fc3f7' : 'transparent',
                            transition: 'background-color 0.2s'
                        }}
                    />
                </div>
            </div>

            {/* Reference content */}
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    flex: 1,
                    position: 'relative',
                    // overflowY: 'auto', // Removed to fix sticky behavior (preventing inner scroll context)
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    paddingBottom: 8
                }}>
                {/* Process cut sites for enzyme display */}
                {(() => {
                    // Filter and map cut sites to view coordinates
                    const visibleCutSites = cutSites
                        .map(site => {
                            const viewPos = consensusState.refToViewMap[site.position];
                            if (viewPos === undefined) return null;
                            if (viewPos < visibleRange.start || viewPos > visibleRange.end) return null;

                            return {
                                ...site,
                                viewPos,
                                id: `${site.enzyme}-${site.position}`
                            };
                        })
                        .filter(Boolean) as (CutSite & { viewPos: number; id: string })[];

                    // Lane allocation for collision avoidance
                    visibleCutSites.sort((a, b) => a.viewPos - b.viewPos);
                    const enzymeLanes: number[] = [];
                    const labeledSites = visibleCutSites.map(site => {
                        let assignedLane = -1;
                        for (let l = 0; l < enzymeLanes.length; l++) {
                            if (enzymeLanes[l] < site.viewPos - 6) {
                                assignedLane = l;
                                enzymeLanes[l] = site.viewPos;
                                break;
                            }
                        }
                        if (assignedLane === -1) {
                            assignedLane = enzymeLanes.length;
                            enzymeLanes.push(site.viewPos);
                        }
                        return { ...site, lane: assignedLane };
                    });

                    const maxLane = labeledSites.length > 0 ? Math.max(...labeledSites.map(s => s.lane)) : -1;
                    const enzymeZoneHeight = (maxLane + 1) * 14 + 10;

                    return (
                        <svg
                            style={{ display: 'block', marginTop: 4 }}
                            width={consensusState.consensusSequence.length * zoom}
                            height={enzymeZoneHeight + 20}
                        >
                            {/* Enzyme Labels */}
                            {labeledSites.map((site, i) => {
                                const xLabel = site.viewPos * zoom + (zoom / 2);
                                const yLabel = enzymeZoneHeight - 10 - (site.lane * 14);
                                const isHovered = hoveredEnzyme === site.id;
                                const color = isHovered ? '#ff5252' : '#888';
                                const textFill = isHovered ? '#fff' : '#fff';

                                // Calculate cut positions for visualisation
                                let topCutViewPos = site.viewPos;
                                let bottomCutViewPos = site.viewPos;

                                if (site.topSnip !== undefined && site.bottomSnip !== undefined) {
                                    topCutViewPos = consensusState.refToViewMap[site.topSnip] ?? site.viewPos;
                                    bottomCutViewPos = consensusState.refToViewMap[site.bottomSnip] ?? site.viewPos;
                                }

                                const topCutX = topCutViewPos * zoom + (zoom / 2);
                                const bottomCutX = bottomCutViewPos * zoom + (zoom / 2);

                                // Y coordinates for cut path (similar to LinearSequenceView)
                                const ySequenceTop = enzymeZoneHeight + 24; // Just below ruler
                                const ySequenceBottom = enzymeZoneHeight + 46; // Bottom of sequence area

                                // Build cut path
                                let cutPath = "";
                                if (Math.abs(topCutX - bottomCutX) < 1) {
                                    // Blunt cut
                                    cutPath = `M ${topCutX} ${ySequenceTop} L ${topCutX} ${ySequenceBottom}`;
                                } else {
                                    // Staggered cut
                                    const yMid = (ySequenceTop + ySequenceBottom) / 2;
                                    cutPath = `M ${topCutX} ${ySequenceTop} L ${topCutX} ${yMid} L ${bottomCutX} ${yMid} L ${bottomCutX} ${ySequenceBottom}`;
                                }

                                return (
                                    <g
                                        key={i}
                                        className="enzyme-label-group"
                                        onMouseEnter={() => setHoveredEnzyme(site.id)}
                                        onMouseLeave={() => setHoveredEnzyme(null)}
                                        style={{ cursor: 'pointer' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Select recognition site if available
                                            // Select recognition site if available
                                            if (referenceId && site.recognitionStart !== undefined && site.recognitionEnd !== undefined) {
                                                setEditSelection({
                                                    sequenceId: referenceId,
                                                    start: site.recognitionStart,
                                                    end: site.recognitionEnd
                                                });
                                                setEditCursor(null);
                                            }
                                        }}
                                    >
                                        {/* Invisible hit area for easier hovering */}
                                        <rect
                                            x={xLabel - (site.enzyme.length * 4) - 4}
                                            y={yLabel - 10}
                                            width={(site.enzyme.length * 8) + 8}
                                            height={16}
                                            fill="transparent"
                                            style={{ cursor: 'pointer' }}
                                        />

                                        {/* Tick line from label to ruler baseline */}
                                        <line
                                            x1={xLabel}
                                            y1={yLabel + 4}
                                            x2={xLabel}
                                            y2={enzymeZoneHeight}
                                            stroke={color}
                                            strokeWidth="1"
                                        />

                                        {/* Background highlight on hover */}
                                        {isHovered && (
                                            <rect
                                                x={xLabel - (site.enzyme.length * 3.5) - 2}
                                                y={yLabel - 8}
                                                width={(site.enzyme.length * 7) + 4}
                                                height="12"
                                                fill="#ff5252"
                                                rx="2"
                                            />
                                        )}

                                        {/* Enzyme label text */}
                                        <text
                                            x={xLabel}
                                            y={yLabel}
                                            textAnchor="middle"
                                            fontFamily="monospace"
                                            fontSize="11"
                                            fontWeight="bold"
                                            fill={textFill}
                                            style={{ pointerEvents: 'none' }}
                                        >
                                            {site.enzyme}
                                        </text>

                                        {/* Cut Path Visualisation on Hover */}
                                        {isHovered && (
                                            <g style={{ pointerEvents: 'none' }}>
                                                {/* Red cut path line */}
                                                <path
                                                    d={cutPath}
                                                    stroke="#ff0000"
                                                    strokeWidth="2"
                                                    fill="none"
                                                />
                                                {/* Top triangle (pointing down to 5' cut) */}
                                                <polygon
                                                    points={`${topCutX - 4},${ySequenceTop - 2} ${topCutX + 4},${ySequenceTop - 2} ${topCutX},${ySequenceTop + 4}`}
                                                    fill="#ff0000"
                                                />
                                                {/* Bottom triangle (pointing up to 3' cut) */}
                                                <polygon
                                                    points={`${bottomCutX - 4},${ySequenceBottom + 2} ${bottomCutX + 4},${ySequenceBottom + 2} ${bottomCutX},${ySequenceBottom - 4}`}
                                                    fill="#ff0000"
                                                />
                                            </g>
                                        )}
                                    </g>
                                );
                            })}

                            {/* Ruler baseline at bottom */}
                            <line
                                x1={0}
                                y1={enzymeZoneHeight}
                                x2={consensusState.consensusSequence.length * zoom}
                                y2={enzymeZoneHeight}
                                stroke="#444"
                                strokeWidth="1"
                            />

                            {/* Ruler ticks - pointing DOWN from baseline - Ref Indices */}
                            {Array.from({ length: referenceSequence.length }).map((_, i) => {
                                const refPos = i + 1;
                                const viewIdx = consensusState.refToViewMap[i];
                                if (viewIdx === undefined) return null;
                                if (viewIdx < visibleRange.start || viewIdx > visibleRange.end) return null;

                                const centerX = viewIdx * zoom + (zoom / 2);

                                if (refPos % 10 === 0) {
                                    return (
                                        <g key={`tick-${i}`}>
                                            <line x1={centerX} y1={enzymeZoneHeight} x2={centerX} y2={enzymeZoneHeight + 8} stroke="#666" strokeWidth="1" />
                                            <text x={centerX} y={enzymeZoneHeight + 16} textAnchor="middle" fontSize="8" fill="#888" fontFamily="monospace">{refPos}</text>
                                        </g>
                                    );
                                } else if (refPos % 5 === 0) {
                                    return (
                                        <line key={`tick-${i}`} x1={centerX} y1={enzymeZoneHeight} x2={centerX} y2={enzymeZoneHeight + 5} stroke="#555" strokeWidth="1" />
                                    );
                                } else {
                                    return (
                                        <line key={`tick-${i}`} x1={centerX} y1={enzymeZoneHeight} x2={centerX} y2={enzymeZoneHeight + 2} stroke="#444" strokeWidth="1" />
                                    );
                                }
                            })}
                        </svg>
                    );
                })()}

                {/* Reference sequence bases (Consensus) - With Editing Support */}
                <div style={{ whiteSpace: 'nowrap', padding: '4px 0', height: 22, position: 'relative' }}>
                    {/* Spacer for virtualisation */}
                    <div style={{
                        display: 'inline-block',
                        width: visibleRange.start * zoom
                    }} />

                    {(() => {
                        // Calculate standard Ref Index for the start of the visible range
                        const startRefIdx = consensusState.consensusSequence
                            .slice(0, visibleRange.start)
                            .replace(/-/g, '').length;

                        let currentRefIdx = startRefIdx;

                        return consensusState.consensusSequence
                            .slice(visibleRange.start, visibleRange.end)
                            .toUpperCase().split('').map((base, i) => {
                                const globalIdx = visibleRange.start + i;
                                const isGap = base === '-'; // Check if visual gap
                                const myRefIdx = isGap ? -1 : currentRefIdx;

                                // Increment ref counter for next base if this wasn't a gap
                                if (!isGap) {
                                    currentRefIdx++;
                                }

                                // Edit state for reference
                                const isCursor = !isGap && editCursor?.sequenceId === referenceId && editCursor?.pos === myRefIdx;
                                const isSelected = !isGap && editSelection && editSelection.sequenceId === referenceId &&
                                    myRefIdx >= editSelection.start &&
                                    myRefIdx < editSelection.end;

                                return (
                                    <span
                                        key={`ref-${globalIdx}`}
                                        onMouseEnter={(e) => {
                                            // Drag selection logic
                                            if (!referenceId || isGap) return;
                                            if (e.buttons === 1 && selectionAnchor.current !== null) {
                                                const anchor = selectionAnchor.current;
                                                const start = Math.min(anchor, myRefIdx);
                                                const end = Math.max(anchor, myRefIdx) + 1;
                                                setEditSelection({ sequenceId: referenceId, start, end });
                                                setEditCursor(null);
                                            }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => {
                                            if (!referenceId || isGap) return;
                                            e.stopPropagation();
                                            e.preventDefault();

                                            if (e.button === 0) {
                                                if (e.shiftKey) {
                                                    const currentAnchor = selectionAnchor.current !== null ? selectionAnchor.current : (editCursor?.pos || 0);
                                                    const start = Math.min(currentAnchor, myRefIdx);
                                                    const end = Math.max(currentAnchor, myRefIdx) + 1;
                                                    setEditSelection({ sequenceId: referenceId, start, end });
                                                    setEditCursor(null);
                                                    selectionAnchor.current = currentAnchor; // Keep anchor
                                                } else {
                                                    // Start selection drag
                                                    setEditCursor({ sequenceId: referenceId, pos: myRefIdx });
                                                    setEditSelection(null);
                                                    selectionAnchor.current = myRefIdx;
                                                }
                                            }
                                        }}

                                        style={{
                                            display: 'inline-block',
                                            width: zoom,
                                            textAlign: 'center',
                                            color: isSelected ? '#fff' : getBaseColor(base),
                                            backgroundColor: isSelected ? 'rgba(79, 195, 247, 0.4)' : 'transparent',
                                            fontFamily: 'monospace',
                                            fontSize: 12,
                                            cursor: isGap ? 'default' : 'text',
                                            borderLeft: isCursor ? '2px solid #4fc3f7' : 'none',
                                            boxSizing: 'border-box',
                                            userSelect: 'none'
                                        }}
                                    >
                                        {base}
                                    </span>
                                );
                            });
                    })()}
                </div>

                {/* ORF Zone: AA translation + small ruler in a SINGLE unified lane */}
                {(() => {
                    if (orfAnnotations.length === 0) return null;

                    const orfHeight = 34; // Single lane height
                    const yAA = 10;
                    const yRulerLine = 28;

                    const aaElements: JSX.Element[] = [];
                    const rulerElements: JSX.Element[] = [];
                    const processedPositions = new Set<number>(); // Track positions to avoid duplicates

                    // Process all ORFs and collect their amino acids
                    orfAnnotations.forEach((orf, orfIdx) => {
                        const startView = consensusState.refToViewMap[orf.start] ?? orf.start;
                        const endView = consensusState.refToViewMap[orf.end] ?? orf.end;

                        const xStart = startView * zoom;
                        const width = (endView - startView) * zoom;

                        // Horizontal ruler baseline for this ORF
                        rulerElements.push(
                            <line key={`ruler-baseline-${orfIdx}`} x1={xStart} y1={yRulerLine} x2={xStart + width} y2={yRulerLine} stroke="#555" strokeWidth="1" />
                        );

                        // Translate codons
                        for (let pos = orf.start; pos < orf.end; pos++) {
                            const dist = pos - orf.start;
                            if (dist % 3 === 0 && pos + 3 <= referenceSequence.length) {
                                // Skip if we've already rendered an AA at this position
                                if (processedPositions.has(pos)) continue;
                                processedPositions.add(pos);

                                const codon = referenceSequence.substr(pos, 3).toUpperCase();
                                const aa = CODON_TABLE[codon] || '?';
                                const aaIndex = Math.floor(dist / 3) + 1;

                                // Map AA position. Use center of 3 bases.
                                const p1 = consensusState.refToViewMap[pos];
                                const p3 = consensusState.refToViewMap[pos + 2];

                                if (p1 !== undefined && p3 !== undefined) {
                                    // Optimisation: Skip off-screen AAs
                                    if (p1 < visibleRange.start - 5 || p1 > visibleRange.end + 5) continue;

                                    const centerX = ((p1 + p3) / 2) * zoom + (zoom / 2);
                                    const color = aa === '*' ? '#ff5252' : '#e0e0e0';

                                    // AA letter - all in same row now
                                    aaElements.push(
                                        <text
                                            key={`aa-${orfIdx}-${pos}`}
                                            x={centerX}
                                            y={yAA}
                                            textAnchor="middle"
                                            fontSize="10"
                                            fill={color}
                                            fontFamily="monospace"
                                            fontWeight="bold"
                                            style={{ cursor: 'pointer' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!referenceId) return;

                                                const codonStart = pos;
                                                const codonEnd = Math.min(pos + 3, referenceSequence.length);

                                                setEditSelection({
                                                    sequenceId: referenceId,
                                                    start: codonStart,
                                                    end: codonEnd
                                                });
                                                setEditCursor(null);
                                            }}
                                        >
                                            {aa}
                                        </text>
                                    );

                                    // AA position ruler tick (every 10 AA)
                                    if (aaIndex === 1 || aaIndex % 10 === 0) {
                                        rulerElements.push(
                                            <g key={`ruler-${orfIdx}-${pos}`}>
                                                <line x1={centerX} y1={yRulerLine} x2={centerX} y2={yRulerLine - 4} stroke="#666" strokeWidth="1" />
                                                <text x={centerX} y={yRulerLine - 5} textAnchor="middle" fontSize="6" fill="#888" fontFamily="monospace">
                                                    {aaIndex}
                                                </text>
                                            </g>
                                        );
                                    } else if (aaIndex % 5 === 0) {
                                        rulerElements.push(
                                            <line key={`ruler-${orfIdx}-${pos}`} x1={centerX} y1={yRulerLine} x2={centerX} y2={yRulerLine - 3} stroke="#555" strokeWidth="1" />
                                        );
                                    }
                                }
                            }
                        }
                    });

                    return (
                        <svg
                            style={{ display: 'block', marginTop: 4, marginBottom: 0 }}
                            width={consensusState.consensusSequence.length * zoom}
                            height={orfHeight}
                        >
                            <g>
                                {aaElements}
                                {rulerElements}
                            </g>
                        </svg>
                    );
                })()}

                {/* Annotations bar - moved up closer to ORF */}
                {stackedAnnotations.items.length > 0 && (
                    <div style={{ position: 'relative', height: stackedAnnotations.totalRows * 14, marginBottom: 4, marginTop: -4 }}>
                        {stackedAnnotations.items.map((item, idx) => {
                            const startView = consensusState.refToViewMap[item.ann.start] ?? item.ann.start;
                            const endView = consensusState.refToViewMap[item.ann.end] ?? item.ann.end;

                            const left = startView * zoom;
                            const width = Math.max(2, (endView - startView) * zoom);

                            return (
                                <div
                                    key={idx}
                                    style={{
                                        position: 'absolute',
                                        left,
                                        top: item.row * 14,
                                        width,
                                        height: 12,
                                        backgroundColor: item.ann.color || '#4fc3f7',
                                        borderRadius: 2,
                                        opacity: 0.7,
                                        display: 'flex',
                                        alignItems: 'center',
                                        paddingLeft: 4
                                    }}
                                    title={`${item.ann.name} (${item.ann.start}-${item.ann.end})`}
                                >
                                    <span style={{ fontSize: 9, color: '#000', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                        {item.ann.name}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* RESIZE HANDLE - Horizontal Border */}
            <div
                onMouseDown={startHeaderResize}
                style={{
                    position: 'absolute',
                    bottom: -2, // Move it slightly down so it centers on the border
                    left: 0,
                    right: 0,
                    height: 5,
                    cursor: 'row-resize',
                    zIndex: 30,
                    backgroundColor: isResizingHeader ? '#4fc3f7' : 'transparent', // Transparent unless resizing
                    pointerEvents: 'auto' // Ensure it captures mouse events for resizing
                }}
            />
        </div>
    );
});
