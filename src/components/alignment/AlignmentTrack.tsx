/**
 * AlignmentTrack Component
 * 
 * Displays a single aligned sequence with optional chromatogram overlay.
 * Shows alignment statistics, mismatches highlighted, and expandable chromatogram.
 */

import { useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AlignmentResult } from '../../lib/analysis/alignment';
import { AB1Data } from '../../lib/parsers/ab1Parser';

interface AlignmentTrackProps {
    /** Name/label for this sequence */
    name: string;
    /** Alignment result */
    alignment: AlignmentResult;
    /** Optional chromatogram data */
    chromatogramData?: AB1Data;
    /** Width of each character in pixels */
    charWidth?: number;
    /** Whether this track is expanded to show chromatogram */
    expanded?: boolean;
    /** Callback to toggle expansion */
    onToggleExpand?: () => void;
    /** Additional metadata to display */
    metadata?: {
        date?: string;
        bases?: number;
    };
}

const CHANNEL_COLORS: Record<string, string> = {
    A: '#00cc00',
    C: '#0066ff',
    G: '#333333',
    T: '#ff3333',
};

export function AlignmentTrack({
    name,
    alignment,
    chromatogramData,
    charWidth = 10,
    expanded = false,
    onToggleExpand,
    metadata
}: AlignmentTrackProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Draw chromatogram on canvas
    useEffect(() => {
        if (!expanded || !chromatogramData || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { traces, peakLocations } = chromatogramData;
        const alignedLen = alignment.alignedQuery.length;
        const canvasWidth = alignedLen * charWidth;
        const canvasHeight = 120;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Find max trace value for scaling
        const maxVal = Math.max(
            ...traces.A,
            ...traces.C,
            ...traces.G,
            ...traces.T
        );

        // Map aligned positions to trace positions
        const getTraceX = (alignedPos: number): number => {
            const pos = alignment.positions[alignedPos];
            if (!pos || pos.queryPos === -1) return -1;
            return peakLocations[pos.queryPos] || -1;
        };

        // Draw traces
        for (const [base, color] of Object.entries(CHANNEL_COLORS)) {
            const traceData = traces[base as keyof typeof traces];
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();

            let started = false;
            for (let alignedPos = 0; alignedPos < alignedLen; alignedPos++) {
                const traceX = getTraceX(alignedPos);
                if (traceX === -1) continue;

                // Average trace values around this peak
                const startIdx = Math.max(0, traceX - 5);
                const endIdx = Math.min(traceData.length - 1, traceX + 5);

                for (let i = startIdx; i <= endIdx; i++) {
                    const xOffset = (i - startIdx) / (endIdx - startIdx + 1);
                    const x = alignedPos * charWidth + xOffset * charWidth;
                    const y = canvasHeight - (traceData[i] / maxVal) * (canvasHeight - 10) - 5;

                    if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            }
            ctx.stroke();
        }
    }, [expanded, chromatogramData, alignment, charWidth]);

    // Calculate alignment stats string
    const statsString = useMemo(() => {
        const parts: string[] = [];
        if (metadata?.bases) {
            parts.push(`${metadata.bases} bases`);
        }
        if (metadata?.date) {
            parts.push(metadata.date);
        }
        parts.push(`${alignment.refStart + 1} ... ${alignment.refEnd} aligned`);
        parts.push(`${alignment.mismatches} mismatches`);
        if (alignment.gapsInRef + alignment.gapsInQuery > 0) {
            parts.push(`${alignment.gapsInRef + alignment.gapsInQuery} gap/insertion`);
        }
        return parts.join('\n');
    }, [alignment, metadata]);

    // Render aligned sequence with coloring
    const renderSequence = () => {
        const elements: JSX.Element[] = [];

        for (let i = 0; i < alignment.positions.length; i++) {
            const pos = alignment.positions[i];
            let bgColor = 'transparent';
            let textColor = '#e0e0e0';

            if (pos.type === 'mismatch') {
                bgColor = 'rgba(255, 100, 100, 0.4)';
                textColor = '#ff6666';
            } else if (pos.type === 'gap_query') {
                bgColor = 'rgba(255, 200, 100, 0.3)';
                textColor = '#999';
            } else if (pos.type === 'gap_ref') {
                bgColor = 'rgba(100, 200, 255, 0.3)';
            }

            elements.push(
                <span
                    key={i}
                    style={{
                        display: 'inline-block',
                        width: charWidth,
                        textAlign: 'center',
                        backgroundColor: bgColor,
                        color: textColor,
                        fontFamily: 'monospace',
                        fontSize: 12,
                    }}
                >
                    {pos.queryBase}
                </span>
            );
        }

        return elements;
    };

    return (
        <div
            style={{
                borderBottom: '1px solid #333',
                backgroundColor: '#252526',
            }}
        >
            {/* Header Row */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '8px 12px',
                    gap: 12,
                    cursor: chromatogramData ? 'pointer' : 'default',
                }}
                onClick={chromatogramData ? onToggleExpand : undefined}
            >
                {/* Expand/Collapse Icon */}
                {chromatogramData ? (
                    expanded ? (
                        <ChevronDown size={16} color="#858585" style={{ marginTop: 2 }} />
                    ) : (
                        <ChevronRight size={16} color="#858585" style={{ marginTop: 2 }} />
                    )
                ) : (
                    <div style={{ width: 16 }} />
                )}

                {/* Name and Stats */}
                <div style={{ flex: '0 0 180px', minWidth: 180 }}>
                    <div style={{ color: '#4fc3f7', fontWeight: 500, fontSize: 13 }}>
                        {name}
                    </div>
                    <div style={{ color: '#858585', fontSize: 11, whiteSpace: 'pre-line', marginTop: 4 }}>
                        {statsString}
                    </div>
                </div>

                {/* Aligned Sequence - no scroll, parent handles it */}
                <div style={{ flex: 1 }}>
                    <div style={{ whiteSpace: 'nowrap' }}>
                        {renderSequence()}
                    </div>
                </div>
            </div>

            {/* Chromatogram (when expanded) - no scroll, parent handles it */}
            {expanded && chromatogramData && (
                <div
                    style={{
                        marginLeft: 220,
                        marginRight: 12,
                        marginBottom: 8,
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        style={{
                            display: 'block',
                        }}
                    />
                </div>
            )}
        </div>
    );
}
