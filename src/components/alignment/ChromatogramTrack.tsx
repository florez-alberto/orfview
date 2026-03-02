import { useEffect, useRef, memo } from 'react';
import { AlignmentResult } from '../../lib/analysis/alignment';
import type { AlignableSequence } from './AlignmentView';

interface ChromatogramTrackProps {
    seq: AlignableSequence;
    alignment: AlignmentResult;
    zoom: number;
    consensusMap: Int32Array | null;
    visibleRange: { start: number; end: number };
    refLength: number;
    isExpanded: boolean;
    gain: number;
}

export const ChromatogramTrack = memo(function ChromatogramTrack({
    seq,
    alignment,
    zoom,
    consensusMap,
    visibleRange,
    refLength,
    isExpanded,
    gain
}: ChromatogramTrackProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Draw chromatogram (Consensus Aware & Optimized)
    useEffect(() => {
        if (!isExpanded || !seq.chromatogramData || !canvasRef.current || !consensusMap) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const traces = seq.chromatogramData.traces;
        if (!traces) return;

        // Set canvas dimensions based on Visible Range for performance
        // We only draw what is visible + buffer
        const xOffset = visibleRange.start * zoom;
        const visibleWidth = (visibleRange.end - visibleRange.start) * zoom; // +100 for buffer?

        // Safety check for width
        const finalWidth = Math.max(1, visibleWidth);

        const canvasHeight = 100;

        // Handle High DPI displays
        const dpr = window.devicePixelRatio || 1;
        canvas.width = finalWidth * dpr;
        canvas.height = canvasHeight * dpr;
        canvas.style.width = `${finalWidth}px`;
        canvas.style.height = `${canvasHeight}px`;
        canvas.style.marginLeft = `${xOffset}px`; // Shift it to correct position

        ctx.scale(dpr, dpr);
        // Translate context to match view coordinates relative to window
        ctx.translate(-xOffset, 0);

        // Clear
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(xOffset, 0, finalWidth, canvasHeight);

        // Pre-calculate View Positions for all valid trace points
        const drawCommands: Array<{ viewCenter: number, peakIdx: number }> = [];
        const peakLocations = seq.chromatogramData.peakLocations; // Map: BaseIndex -> TraceIndex

        let currentRefAnchor = alignment.refStart - 1;
        let insertionCount = 0;

        const seqLength = seq.sequence.length;

        for (const pos of alignment.positions) {
            let viewPos = -1;

            if (pos.refPos !== -1) {
                currentRefAnchor = pos.refPos;
                insertionCount = 0;
                viewPos = consensusMap[pos.refPos];
                if (viewPos === undefined) viewPos = -1;
            } else {
                let anchorView = (currentRefAnchor === -1) ? -1 : (consensusMap[currentRefAnchor]);
                if (anchorView === undefined) anchorView = -1;
                viewPos = anchorView + 1 + insertionCount;
                insertionCount++;
            }

            if (pos.queryPos !== -1 && viewPos >= 0 && viewPos < refLength) {
                const rawIdx = alignment.isReverseComplement ? (seqLength - 1 - pos.queryPos) : pos.queryPos;
                const peakIdx = peakLocations[rawIdx];
                if (peakIdx !== undefined) {
                    drawCommands.push({ viewCenter: (viewPos + 0.5) * zoom, peakIdx });
                }
            }
        }

        const maxVal = Math.max(...traces.A, ...traces.C, ...traces.G, ...traces.T) || 1;
        const colors: Record<string, string> = { A: '#00cc00', C: '#0066ff', G: '#444444', T: '#ff3333' };

        // Helper to swap channels
        const getComplement = (b: string) => {
            switch (b) { case 'A': return 'T'; case 'T': return 'A'; case 'C': return 'G'; case 'G': return 'C'; default: return b; }
        };

        const windowSize = 8; // Half-width of island

        for (const [base, color] of Object.entries(colors)) {
            const sourceBase = alignment.isReverseComplement ? getComplement(base) : base;
            const traceData = traces[sourceBase as keyof typeof traces];
            if (!traceData) continue;

            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;

            for (const cmd of drawCommands) {
                const peakIdx = cmd.peakIdx;

                const points = [];
                for (let k = -windowSize; k <= windowSize; k++) {
                    const tIdx = peakIdx + k;
                    if (tIdx < 0 || tIdx >= traceData.length) continue;

                    const val = traceData[tIdx];
                    const x = cmd.viewCenter + (k / windowSize) * (zoom * 0.5);
                    const y = canvasHeight - (val / maxVal) * 70 * gain;
                    points.push({ x, y });
                }

                if (points.length > 0) {
                    ctx.moveTo(points[0].x, points[0].y);
                    for (let i = 1; i < points.length; i++) {
                        ctx.lineTo(points[i].x, points[i].y);
                    }
                }
            }
            ctx.stroke();
        }

    }, [isExpanded, seq.chromatogramData, alignment, zoom, refLength, gain, consensusMap, visibleRange]);

    return (
        <div style={{ flex: 1, position: 'relative' }}>
            <canvas
                ref={canvasRef}
                style={{ display: 'block' }}
            />
        </div>
    );
});
