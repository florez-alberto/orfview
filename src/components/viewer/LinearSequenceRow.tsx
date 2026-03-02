import React, { memo } from 'react';
import { CODON_TABLE } from '../../lib/constants/codonTable';

// Layout Constants
const CHAR_WIDTH = 10;
const SEQ_LINE_HEIGHT = 16;
const SPACER_HEIGHT = 24;

export interface LinearRowData {
    index: number;
    start: number;
    end: number;
    seq: string;
    compSeq: string;
    cutSites: Array<{
        id: string;
        enzyme: string;
        position: number;
        relativePos: number;
        lane: number;
        recognitionStart?: number;
        recognitionEnd?: number;
        topSnip?: number;
        bottomSnip?: number;
    }>;
    features: Array<{
        name: string;
        start: number;
        end: number;
        relativeStart: number;
        relativeEnd: number;
        lane: number;
        color?: string;
        direction?: number;
    }>;
    orfFeatures: Array<{
        name: string;
        start: number;
        end: number;
        relativeStart: number;
        relativeEnd: number;
        lane: number;
        color?: string;
        direction?: number;
        type?: string;
    }>;
    height: number;
    topPadding: number;
    orfZonePadding: number;
}

export interface LinearSequenceRowProps {
    row: LinearRowData;
    sequenceLength: number;
    bpsPerRow: number;
    fullSequence: string; // Needed for cross-row codons
    selection: { start: number; end: number } | null;
    cursor: number | null;
    hoveredEnzyme: string | null;
    hoveredFeature: string | null;
    setHoveredEnzyme: (id: string | null) => void;
    setHoveredFeature: (id: string | null) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onDrag: (index: number) => void;
    onSelectRange: (start: number, end: number) => void;
    onUpdateSequence?: (newSeq: string) => void;
}

export const LinearSequenceRow = memo(function LinearSequenceRow({
    row,
    sequenceLength,
    bpsPerRow,
    fullSequence,
    selection,
    cursor,
    hoveredEnzyme,
    hoveredFeature,
    setHoveredEnzyme,
    setHoveredFeature,
    onMouseDown,
    onDrag,
    onSelectRange,
    onUpdateSequence
}: LinearSequenceRowProps) {
    const { start, seq, compSeq, cutSites, features, orfFeatures, topPadding, orfZonePadding } = row;

    const yTopStrand = topPadding;
    const ySpacer = topPadding + SEQ_LINE_HEIGHT;
    const yBottomStrand = topPadding + SEQ_LINE_HEIGHT + SPACER_HEIGHT;
    const yRowBottom = yBottomStrand + SEQ_LINE_HEIGHT;
    const yOrfZone = yRowBottom + 8;
    const yFeatureZone = yRowBottom + orfZonePadding;

    return (
        <div
            className="lsv-row"
            style={{
                position: 'relative',
                height: `${row.height}px`,
                marginBottom: '10px',
                cursor: 'text'
            }}
            onMouseDown={onMouseDown}
            onMouseMove={(e) => {
                if (e.buttons === 1 && !e.shiftKey) {
                    const x = e.nativeEvent.offsetX;
                    const relativeX = x - 20;
                    const charIndex = Math.round(relativeX / CHAR_WIDTH);
                    let index = start + charIndex;
                    index = Math.max(0, Math.min(sequenceLength, index));
                    onDrag(index);
                }
            }}
        >
            <svg
                width="100%"
                height="100%"
                style={{ position: 'absolute', top: 0, left: 0 }}
            >
                {/* Draw Selection Background */}
                {selection && (
                    (() => {
                        const selStart = Math.max(start, selection.start);
                        const selEnd = Math.min(start + bpsPerRow, selection.end); // Clamp to row end
                        if (selEnd > selStart) {
                            const x = 20 + (selStart - start) * CHAR_WIDTH;
                            const w = (selEnd - selStart) * CHAR_WIDTH;
                            return (
                                <rect
                                    x={x}
                                    y={topPadding}
                                    width={w}
                                    height={yRowBottom - topPadding}
                                    fill="rgba(79, 195, 247, 0.4)"
                                />
                            );
                        }
                        return null;
                    })()
                )}

                {/* Draw Cursor */}
                {cursor !== null && cursor >= start && cursor <= Math.min(start + bpsPerRow, sequenceLength) && (
                    <line
                        x1={20 + (cursor - start) * CHAR_WIDTH}
                        y1={topPadding - 4}
                        x2={20 + (cursor - start) * CHAR_WIDTH}
                        y2={yRowBottom + 4}
                        stroke="#4fc3f7"
                        strokeWidth="2"
                    />
                )}

                {/* --- Highlight Column (Behind Text) --- */}
                {cutSites.map((site) => {
                    const isHovered = hoveredEnzyme === site.id;
                    if (isHovered && site.recognitionStart !== undefined && site.recognitionEnd !== undefined) {
                        const rStart = site.recognitionStart - start;
                        const rEnd = site.recognitionEnd - start;

                        const hStart = Math.max(0, rStart);
                        const hEnd = Math.min(seq.length, rEnd);

                        if (hEnd > hStart) {
                            const x = 20 + (hStart * CHAR_WIDTH);
                            const w = (hEnd - hStart) * CHAR_WIDTH;
                            return (
                                <g key={`highlight-${site.id}`}>
                                    <rect
                                        x={x}
                                        y={yTopStrand}
                                        width={w}
                                        height={yRowBottom - yTopStrand}
                                        fill="rgba(128, 128, 128, 0.3)"
                                        rx="0"
                                    />
                                </g>
                            );
                        }
                    }
                    return null;
                })}

                {/* Sequence Text (Forward) */}
                <text
                    x="20"
                    y={yTopStrand + 12}
                    fontFamily="monospace"
                    fontSize="14"
                    fill="#ccc"
                    pointerEvents="none"
                    style={{ whiteSpace: 'pre' }}
                >
                    {seq.split('').map((char, i) => (
                        <tspan key={i} x={20 + (i * CHAR_WIDTH)}>{char}</tspan>
                    ))}
                </text>

                {/* Sequence Text (Reverse) */}
                <text
                    x="20"
                    y={yBottomStrand + 12}
                    fontFamily="monospace"
                    fontSize="14"
                    fill="#ccc"
                    opacity="0.7"
                    pointerEvents="none"
                    style={{ whiteSpace: 'pre' }}
                >
                    {compSeq.split('').map((char, i) => (
                        <tspan key={i} x={20 + (i * CHAR_WIDTH)}>{char}</tspan>
                    ))}
                </text>

                {/* Central Grid Line & Ruler */}
                <line
                    x1={20} y1={ySpacer + SPACER_HEIGHT - 4}
                    x2={20 + (seq.length * CHAR_WIDTH)} y2={ySpacer + SPACER_HEIGHT - 4}
                    stroke="#444"
                    strokeWidth="1"
                />
                {seq.split('').map((_, i) => {
                    const pos = start + i + 1;
                    const x = 20 + (i * CHAR_WIDTH);
                    const centerX = x + (CHAR_WIDTH / 2);
                    const yBaseline = ySpacer + SPACER_HEIGHT - 4;

                    if (pos % 10 === 0) {
                        return (
                            <g key={`tick-${i}`}>
                                <line x1={centerX} y1={yBaseline} x2={centerX} y2={yBaseline - 8} stroke="#666" strokeWidth="1" />
                                <text x={centerX} y={yBaseline - 10} textAnchor="middle" fontSize="9" fill="#888" fontFamily="monospace" style={{ pointerEvents: 'none' }}>{pos}</text>
                            </g>
                        );
                    } else if (pos % 5 === 0) {
                        return (
                            <line key={`tick-${i}`} x1={centerX} y1={yBaseline} x2={centerX} y2={yBaseline - 5} stroke="#555" strokeWidth="1" />
                        );
                    } else {
                        return (
                            <line key={`tick-${i}`} x1={centerX} y1={yBaseline} x2={centerX} y2={yBaseline - 2} stroke="#444" strokeWidth="1" />
                        );
                    }
                })}

                {/* --- ORF Zone --- */}
                {orfFeatures.map((feat, i) => {
                    const xStart = 20 + (feat.relativeStart * CHAR_WIDTH);
                    const width = Math.max(CHAR_WIDTH, (feat.relativeEnd - feat.relativeStart) * CHAR_WIDTH);
                    const orfHeight = 45;
                    const yBase = yOrfZone + (feat.lane * orfHeight);
                    const yAA = yBase + 10;
                    const yRulerLine = yBase + 28;
                    const yRect = yBase + 34;

                    const aaElements = [];
                    const rulerElements = [];
                    let aaIndex = 0;

                    rulerElements.push(
                        <line key="ruler-baseline" x1={xStart} y1={yRulerLine} x2={xStart + width} y2={yRulerLine} stroke="#555" strokeWidth="1" />
                    );

                    for (let col = feat.relativeStart; col < feat.relativeEnd; col++) {
                        const globalPos = start + col;
                        const dist = globalPos - feat.start;
                        if (dist >= 0 && dist % 3 === 0) {
                            aaIndex = Math.floor(dist / 3) + 1;
                            if (globalPos + 3 <= sequenceLength) {
                                // Use fullSequence to handle codons spanning row boundaries
                                const codon = fullSequence.substr(globalPos, 3).toUpperCase();
                                const aa = (CODON_TABLE[codon] || '?');
                                const xAA = 20 + (col * CHAR_WIDTH) + (CHAR_WIDTH * 1.5);
                                const color = aa === '*' ? '#ff5252' : '#e0e0e0';

                                aaElements.push(
                                    <text
                                        key={`aa-${col}`}
                                        x={xAA}
                                        y={yAA}
                                        textAnchor="middle"
                                        fontSize="11"
                                        fill={color}
                                        fontFamily="monospace"
                                        fontWeight="bold"
                                        style={{ cursor: 'pointer' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!onUpdateSequence) return;
                                            onSelectRange(globalPos, Math.min(globalPos + 3, sequenceLength));
                                        }}
                                    >
                                        {aa}
                                    </text>
                                );

                                if (aaIndex === 1 || aaIndex % 10 === 0) {
                                    rulerElements.push(
                                        <g key={`ruler-${col}`}>
                                            <line x1={xAA} y1={yRulerLine} x2={xAA} y2={yRulerLine - 4} stroke="#666" strokeWidth="1" />
                                            <text x={xAA} y={yRulerLine - 5} textAnchor="middle" fontSize="7" fill="#888" fontFamily="monospace">
                                                {aaIndex}
                                            </text>
                                        </g>
                                    );
                                } else if (aaIndex % 5 === 0) {
                                    rulerElements.push(
                                        <line key={`ruler-${col}`} x1={xAA} y1={yRulerLine} x2={xAA} y2={yRulerLine - 3} stroke="#555" strokeWidth="1" />
                                    );
                                }
                            }
                        }
                    }

                    return (
                        <g
                            key={`orf-${i}`}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredFeature(`orf-${i}`)}
                            onMouseLeave={() => setHoveredFeature(null)}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!onUpdateSequence) return;
                                onSelectRange(feat.start, feat.end);
                            }}
                        >
                            {rulerElements}
                            {aaElements}
                            <rect
                                x={xStart}
                                y={yRect}
                                width={width}
                                height="10"
                                fill={feat.color || '#9C27B0'}
                                fillOpacity={hoveredFeature === `orf-${i}` ? "1.0" : "0.9"}
                                rx="2"
                                stroke={hoveredFeature === `orf-${i}` ? "#fff" : "none"}
                                strokeWidth={hoveredFeature === `orf-${i}` ? "1" : "0"}
                            />
                            {width > 30 && (
                                <text
                                    x={xStart + (width / 2)}
                                    y={yRect + 8}
                                    fontSize="8"
                                    fill="#fff"
                                    textAnchor="middle"
                                    pointerEvents="none"
                                    fontWeight="bold"
                                    fontFamily="sans-serif"
                                >
                                    {feat.name}
                                </text>
                            )}
                            {feat.direction === 1 && (
                                <text x={xStart + width + 2} y={yRect + 8} fontSize="10" fill={feat.color || '#9C27B0'}>→</text>
                            )}
                            {feat.direction === -1 && (
                                <text x={xStart - 10} y={yRect + 8} fontSize="10" fill={feat.color || '#9C27B0'}>←</text>
                            )}
                        </g>
                    );
                })}

                {/* --- Regular Features --- */}
                {features.map((feat, i) => {
                    const xStart = 20 + (feat.relativeStart * CHAR_WIDTH);
                    const width = Math.max(CHAR_WIDTH, (feat.relativeEnd - feat.relativeStart) * CHAR_WIDTH);
                    const yBase = yFeatureZone + 10 + (feat.lane * 24);

                    return (
                        <g
                            key={`feat-${i}`}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredFeature(`feat-${i}`)}
                            onMouseLeave={() => setHoveredFeature(null)}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!onUpdateSequence) return;
                                onSelectRange(feat.start, feat.end);
                            }}
                        >
                            <rect
                                x={xStart}
                                y={yBase}
                                width={width}
                                height="12"
                                fill={feat.color || '#2196F3'}
                                fillOpacity={hoveredFeature === `feat-${i}` ? "1.0" : "0.8"}
                                rx="2"
                                stroke={hoveredFeature === `feat-${i}` ? "#fff" : "none"}
                                strokeWidth={hoveredFeature === `feat-${i}` ? "1" : "0"}
                            />
                            {width > 20 && (
                                <text
                                    x={xStart + (width / 2)}
                                    y={yBase + 9}
                                    fontSize="9"
                                    fill="#000"
                                    textAnchor="middle"
                                    pointerEvents="none"
                                    fontWeight="bold"
                                    fontFamily="sans-serif"
                                    style={{ whiteSpace: 'pre' }}
                                >
                                    {feat.name}
                                </text>
                            )}
                            {feat.direction === 1 && (
                                <text x={xStart + width + 2} y={yBase + 10} fontSize="10" fill={feat.color || '#2196F3'}>→</text>
                            )}
                            {feat.direction === -1 && (
                                <text x={xStart - 10} y={yBase + 10} fontSize="10" fill={feat.color || '#2196F3'}>←</text>
                            )}
                        </g>
                    );
                })}

                {/* --- Enzymes --- */}
                {cutSites.map((site, i) => {
                    const xLabel = 20 + (site.relativePos * CHAR_WIDTH);
                    const yLabel = topPadding - 10 - (site.lane * 14);
                    const isHovered = hoveredEnzyme === site.id;

                    const color = isHovered ? '#ff5252' : '#888';
                    const textFill = isHovered ? '#fff' : '#fff';
                    const bgColor = isHovered ? '#ff5252' : 'none';

                    let topSnipRel = site.relativePos;
                    let bottomSnipRel = site.relativePos;
                    if (site.topSnip !== undefined && site.bottomSnip !== undefined) {
                        topSnipRel = site.topSnip - start;
                        bottomSnipRel = site.bottomSnip - start;
                    }

                    const topX = 20 + (topSnipRel * CHAR_WIDTH);
                    const bottomX = 20 + (bottomSnipRel * CHAR_WIDTH);
                    const yStart = yTopStrand - 2;
                    const yMid = ySpacer + (SPACER_HEIGHT / 2);
                    const yEnd = yRowBottom + 2;

                    let cutPath = "";
                    if (Math.abs(topX - bottomX) < 1) {
                        cutPath = `M ${topX} ${yStart} L ${topX} ${yEnd}`;
                    } else {
                        cutPath = `M ${topX} ${yStart} L ${topX} ${yMid} L ${bottomX} ${yMid} L ${bottomX} ${yEnd}`;
                    }

                    let hitAreaX = xLabel;
                    let hitAreaWidth = 0;
                    if (site.recognitionStart !== undefined && site.recognitionEnd !== undefined) {
                        const rStart = site.recognitionStart - start;
                        const rEnd = site.recognitionEnd - start;
                        const hStart = Math.max(0, rStart);
                        const hEnd = Math.min(seq.length, rEnd);
                        if (hEnd > hStart) {
                            hitAreaX = 20 + (hStart * CHAR_WIDTH);
                            hitAreaWidth = (hEnd - hStart) * CHAR_WIDTH;
                        }
                    }

                    return (
                        <g
                            key={i}
                            className="enzyme-label-group"
                            onMouseEnter={() => setHoveredEnzyme(site.id)}
                            onMouseLeave={() => setHoveredEnzyme(null)}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!onUpdateSequence) return;
                                if (site.recognitionStart !== undefined && site.recognitionEnd !== undefined) {
                                    onSelectRange(site.recognitionStart, site.recognitionEnd);
                                }
                            }}
                        >
                            {hitAreaWidth > 0 && (
                                <rect
                                    x={hitAreaX}
                                    y={yTopStrand}
                                    width={hitAreaWidth}
                                    height={yRowBottom - yTopStrand}
                                    fill="transparent"
                                    style={{ cursor: 'pointer' }}
                                />
                            )}

                            <line
                                x1={xLabel}
                                y1={yLabel + 4}
                                x2={topX}
                                y2={yTopStrand}
                                stroke={color}
                                strokeWidth="1"
                            />
                            {isHovered && (
                                <rect
                                    x={xLabel - (site.enzyme.length * 4) - 4}
                                    y={yLabel - 8}
                                    width={(site.enzyme.length * 7) + 8}
                                    height={12}
                                    fill={bgColor}
                                    rx="2"
                                />
                            )}

                            <rect
                                x={xLabel - (site.enzyme.length * 4) - 4}
                                y={yLabel - 10}
                                width={(site.enzyme.length * 8) + 8}
                                height={16}
                                fill="transparent"
                                style={{ cursor: 'pointer' }}
                            />

                            <text
                                x={xLabel}
                                y={yLabel}
                                textAnchor="middle"
                                fontFamily="monospace"
                                fontSize="11"
                                fontWeight="bold"
                                fill={textFill}
                                style={{ cursor: 'pointer', pointerEvents: 'none' }}
                            >
                                {site.enzyme}
                            </text>

                            {isHovered && (
                                <g style={{ pointerEvents: 'none' }}>
                                    <path
                                        d={cutPath}
                                        stroke="#ff0000"
                                        strokeWidth="2"
                                        fill="none"
                                    />
                                    <polygon
                                        points={`${topX - 4},${yTopStrand - 2} ${topX + 4},${yTopStrand - 2} ${topX},${yTopStrand + 4}`}
                                        fill="#ff0000"
                                    />
                                    <polygon
                                        points={`${bottomX - 4},${yBottomStrand + SEQ_LINE_HEIGHT + 2} ${bottomX + 4},${yBottomStrand + SEQ_LINE_HEIGHT + 2} ${bottomX},${yBottomStrand + SEQ_LINE_HEIGHT - 4}`}
                                        fill="#ff0000"
                                    />
                                </g>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
});
