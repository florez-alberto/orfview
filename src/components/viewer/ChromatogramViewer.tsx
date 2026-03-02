import { useRef, useEffect, useState, useMemo } from 'react';
import { AB1Data } from '../../lib/parsers/ab1Parser';

interface ChromatogramViewerProps {
    data: AB1Data;
    width?: number;
    height?: number;
}

const CHANNEL_COLORS: Record<string, string> = {
    A: '#00cc00', // Green
    C: '#0066ff', // Blue  
    G: '#333333', // Dark gray (more visible on dark bg)
    T: '#ff3333', // Red
};

export function ChromatogramViewer({ data, height = 280 }: Omit<ChromatogramViewerProps, 'width'> & { width?: number }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sequenceRef = useRef<HTMLDivElement>(null);
    const [scrollX, setScrollX] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [gain, setGain] = useState(1);
    const [containerHeight, setContainerHeight] = useState(height);
    const [containerWidth, setContainerWidth] = useState(800);

    // Observe container size
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    setContainerWidth(entry.contentRect.width);
                }
                if (entry.contentRect.height > 0) {
                    setContainerHeight(entry.contentRect.height);
                }
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Width comes from container now - subtract 30px for the gain slider
    const width = Math.max(0, containerWidth - 30);

    // Calculate the visible portion of the trace
    const pixelsPerSample = zoom;
    const totalWidth = data.traceLength * pixelsPerSample;
    const canvasHeight = Math.max(100, containerHeight - 80); // Leave room for controls and sequence

    // Calculate visible base range for sequence display
    const visibleRange = useMemo(() => {
        const startSample = Math.floor(scrollX / pixelsPerSample);
        const endSample = Math.min(data.traceLength, startSample + Math.ceil(width / pixelsPerSample));

        // Find bases in this range
        let startBase = 0;
        let endBase = data.sequence.length;

        for (let i = 0; i < data.peakLocations.length; i++) {
            if (data.peakLocations[i] >= startSample && startBase === 0) {
                startBase = Math.max(0, i - 1);
            }
            if (data.peakLocations[i] > endSample) {
                endBase = i + 1;
                break;
            }
        }

        return { startSample, endSample, startBase, endBase };
    }, [scrollX, pixelsPerSample, width, data.traceLength, data.peakLocations, data.sequence.length]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { startSample, endSample } = visibleRange;

        // Clear canvas
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, width, canvasHeight);

        // Find max value for scaling
        let maxValue = 1;
        for (const channel of ['A', 'C', 'G', 'T'] as const) {
            for (let i = startSample; i < endSample; i++) {
                maxValue = Math.max(maxValue, data.traces[channel][i] || 0);
            }
        }

        // Draw each channel trace
        for (const channel of ['A', 'C', 'G', 'T'] as const) {
            const trace = data.traces[channel];
            if (!trace || trace.length === 0) continue;

            ctx.beginPath();
            ctx.strokeStyle = CHANNEL_COLORS[channel];
            ctx.lineWidth = 1.2;

            for (let i = startSample; i < endSample; i++) {
                const x = (i - startSample) * pixelsPerSample;
                const value = trace[i] * gain;
                const y = canvasHeight - 20 - (value / maxValue) * (canvasHeight - 30);

                if (i === startSample) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }

        // Draw quality bars at peak positions
        for (let i = 0; i < data.sequence.length; i++) {
            const peakPos = data.peakLocations[i];
            if (peakPos < startSample || peakPos > endSample) continue;

            const x = (peakPos - startSample) * pixelsPerSample;
            const quality = data.quality[i] || 0;

            // Quality bar
            const barHeight = Math.min((quality / 60) * 15, 15);
            ctx.fillStyle = quality > 30 ? '#4caf50' : quality > 20 ? '#ff9800' : '#f44336';
            ctx.fillRect(x - 1.5, canvasHeight - 18, 3, barHeight);
        }

    }, [data, width, canvasHeight, visibleRange, pixelsPerSample, gain]);

    const handleScroll = (e: React.WheelEvent) => {
        e.preventDefault();
        if (e.shiftKey) {
            // Zoom with Shift+Scroll
            setZoom(z => Math.max(0.3, Math.min(3, z + (e.deltaY > 0 ? -0.05 : 0.05))));
        } else {
            // Pan with regular scroll
            setScrollX(x => Math.max(0, Math.min(totalWidth - width, x + e.deltaY * 2)));
        }
    };

    // Generate sequence display with coloring
    const sequenceDisplay = useMemo(() => {
        const { startBase, endBase, startSample } = visibleRange;
        const elements: JSX.Element[] = [];

        for (let i = startBase; i < endBase && i < data.sequence.length; i++) {
            const base = data.sequence[i];
            const quality = data.quality[i] || 0;
            const peakPos = data.peakLocations[i];
            const xPos = (peakPos - startSample) * pixelsPerSample;

            elements.push(
                <span
                    key={i}
                    style={{
                        position: 'absolute',
                        left: xPos - 4,
                        color: CHANNEL_COLORS[base] || '#fff',
                        opacity: quality > 30 ? 1 : quality > 20 ? 0.7 : 0.4,
                        fontWeight: quality > 30 ? 600 : 400,
                        fontSize: 11,
                        fontFamily: 'monospace',
                    }}
                    title={`${base} (Q${quality}) pos ${i + 1}`}
                >
                    {base}
                </span>
            );
        }
        return elements;
    }, [visibleRange, data.sequence, data.quality, data.peakLocations, pixelsPerSample]);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: '#1e1e1e', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header Controls */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 12px',
                backgroundColor: '#252526',
                borderBottom: '1px solid #3c3c3c',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    {(['A', 'C', 'G', 'T'] as const).map(base => (
                        <div key={base} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                backgroundColor: CHANNEL_COLORS[base]
                            }} />
                            <span style={{ color: '#aaa', fontSize: 11, fontWeight: 500 }}>{base}</span>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 10, color: '#888' }}>
                    <span>{data.sequence.length} bp</span>
                    <span>Zoom: {Math.round(zoom * 100)}%</span>
                    <span style={{ opacity: 0.6 }}>Scroll to pan | Shift+Scroll to zoom</span>
                </div>
            </div>

            {/* Trace Canvas + Vertical Gain Slider */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}>
                <div onWheel={handleScroll} style={{ cursor: 'grab', flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <canvas
                        ref={canvasRef}
                        width={width} // Note: This might need adjustment if slider takes width space, but we overlay or shrink
                        height={canvasHeight}
                        style={{ display: 'block' }}
                    />
                </div>

                {/* Vertical Gain Slider */}
                <div style={{
                    width: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#1a1a1a',
                    borderLeft: '1px solid #333',
                    zIndex: 10
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
                            height: '60%',
                            cursor: 'ns-resize',
                            accentColor: '#E91E63'
                        }}
                        title={`Gain: ${gain.toFixed(1)}x`}
                    />
                </div>
            </div>

            {/* Sequence Row */}
            <div
                ref={sequenceRef}
                style={{
                    position: 'relative',
                    height: 24,
                    backgroundColor: '#252526',
                    borderTop: '1px solid #3c3c3c',
                    overflow: 'hidden',
                    flexShrink: 0
                }}
                onWheel={handleScroll}
            >
                {sequenceDisplay}
            </div>

            {/* Position Ruler */}
            <div style={{
                height: 16,
                backgroundColor: '#1e1e1e',
                borderTop: '1px solid #3c3c3c',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 8,
                fontSize: 9,
                color: '#666',
                fontFamily: 'monospace',
                flexShrink: 0
            }}>
                Position: {visibleRange.startBase + 1} - {Math.min(visibleRange.endBase, data.sequence.length)}
            </div>

            {/* Scrollbar */}
            <div style={{
                padding: '4px 8px',
                backgroundColor: '#252526',
                borderTop: '1px solid #3c3c3c',
                flexShrink: 0
            }}>
                <input
                    type="range"
                    min={0}
                    max={Math.max(0, totalWidth - width)}
                    value={scrollX}
                    onChange={(e) => setScrollX(Number(e.target.value))}
                    style={{
                        width: '100%',
                        height: 6,
                        cursor: 'pointer',
                        accentColor: '#007acc'
                    }}
                />
            </div>
        </div>
    );
}
