
import { useState, useMemo, useEffect } from 'react';

interface LinearMapProps {
    sequence: string;
    annotations?: Array<{
        name: string;
        start: number;
        end: number;
        direction?: 1 | -1;
        color?: string;
        type?: string;
    }>;
    cutSites?: Array<{
        enzyme: string;
        position: number;
        strand: number;
    }>;
    containerWidth?: number;
    onFeatureClick?: (pos: number) => void;
}

export function LinearMap({
    sequence,
    annotations = [],
    cutSites = [],
    containerWidth = 800,
    onFeatureClick
}: LinearMapProps) {
    const seqLength = sequence.length;

    // Zoom Logic
    const FIT_ZOOM = (containerWidth - 60) / seqLength;
    const MAX_ZOOM = 10;
    const [pixelsPerBp, setPixelsPerBp] = useState(FIT_ZOOM > 0 ? FIT_ZOOM : 1);
    const [hoveredEnzyme, setHoveredEnzyme] = useState<string | null>(null);

    // Initial fit
    useEffect(() => {
        if (containerWidth && seqLength) {
            const fit = (containerWidth - 60) / seqLength;
            if (fit > 0) setPixelsPerBp(fit);
        }
    }, [containerWidth, seqLength]);

    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setPixelsPerBp(val);
    };

    const handleFit = () => {
        const fit = (containerWidth - 60) / seqLength;
        if (fit > 0) setPixelsPerBp(fit);
    };

    const handleZoomIn = () => setPixelsPerBp(prev => Math.min(MAX_ZOOM, prev * 1.2));
    const handleZoomOut = () => setPixelsPerBp(prev => Math.max(FIT_ZOOM, prev / 1.2));

    // --- Enzyme Lane Allocation ---
    const enzymeLanes = useMemo(() => {
        // Clone and sort
        const sites = [...cutSites].sort((a, b) => a.position - b.position);

        const lanes: number[] = [];
        const labeledSites = sites.map((site, i) => {
            const x = site.position * pixelsPerBp;
            let assignedLane = -1;

            const labelWidth = site.enzyme.length * 7 + 10;
            const labelStart = x - (labelWidth / 2);
            const labelEnd = x + (labelWidth / 2);

            for (let l = 0; l < lanes.length; l++) {
                if (lanes[l] + 2 < labelStart) {
                    assignedLane = l;
                    lanes[l] = labelEnd;
                    break;
                }
            }
            if (assignedLane === -1) {
                assignedLane = lanes.length;
                lanes.push(labelEnd);
            }
            return { ...site, lane: assignedLane, x, id: `${site.enzyme}-${site.position}-${i}` };
        });

        return { sites: labeledSites, totalLanes: lanes.length };
    }, [cutSites, pixelsPerBp]);

    // --- Feature Lane Allocation ---
    const featureLanes = useMemo(() => {
        const features = [...annotations].map(ann => {
            const isEnzyme = cutSites.some(c => c.enzyme === ann.name);
            if (isEnzyme) return null;
            return ann;
        }).filter(Boolean) as typeof annotations;

        features.sort((a, b) => a.start - b.start);

        const lanes: number[] = [];
        const processedFeatures = features.map(feat => {
            const startX = feat.start * pixelsPerBp;
            const endX = feat.end * pixelsPerBp;
            const width = Math.max(2, endX - startX);

            let assignedLane = -1;
            for (let l = 0; l < lanes.length; l++) {
                if (lanes[l] + 2 < startX) {
                    assignedLane = l;
                    lanes[l] = startX + width;
                    break;
                }
            }
            if (assignedLane === -1) {
                assignedLane = lanes.length;
                lanes.push(startX + width);
            }
            return { ...feat, lane: assignedLane, x: startX, width };
        });

        return { features: processedFeatures, totalLanes: lanes.length };
    }, [annotations, cutSites, pixelsPerBp]);


    // Layout Calculation
    const ENZYME_LANE_HEIGHT = 14;
    const FEATURE_LANE_HEIGHT = 16;
    const BACKBONE_Y = (enzymeLanes.totalLanes * ENZYME_LANE_HEIGHT) + 100;
    const TOTAL_HEIGHT = BACKBONE_Y + 20 + (featureLanes.totalLanes * FEATURE_LANE_HEIGHT) + 20;
    const TOTAL_WIDTH = Math.max(containerWidth, seqLength * pixelsPerBp + 60);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            <div
                className="linear-map-scroll-container"
                style={{
                    width: '100%',
                    height: 'calc(100% - 50px)', // Reserve space at bottom for enzyme panel
                    overflow: 'auto',
                    backgroundColor: '#111',
                }}
            >
                <style>{`
                    .linear-map-scroll-container::-webkit-scrollbar {
                        height: 12px;
                        background: #1e1e1e;
                    }
                    .linear-map-scroll-container::-webkit-scrollbar-thumb {
                        background: #555;
                        border-radius: 6px;
                        border: 2px solid #1e1e1e;
                    }
                    .linear-map-scroll-container::-webkit-scrollbar-thumb:hover {
                        background: #777;
                    }
                    .linear-map-scroll-container::-webkit-scrollbar-corner {
                        background: #1e1e1e;
                    }
                `}</style>
                <svg width={TOTAL_WIDTH} height={TOTAL_HEIGHT}>
                    {/* --- Backbone --- */}
                    <line
                        x1={20} y1={BACKBONE_Y}
                        x2={20 + (seqLength * pixelsPerBp)} y2={BACKBONE_Y}
                        stroke="#666"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />

                    {/* --- Enzymes (Top) --- */}
                    {enzymeLanes.sites.map((site, i) => {
                        const yText = BACKBONE_Y - 20 - (site.lane * ENZYME_LANE_HEIGHT);
                        return (
                            <g
                                key={i}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onFeatureClick?.(site.position);
                                }}
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={() => setHoveredEnzyme(site.id ? site.id : `${site.enzyme}-${i}`)}
                                onMouseLeave={() => setHoveredEnzyme(null)}
                            >
                                {/* Invisible hit area */}
                                <rect
                                    x={site.x + 20 - (site.enzyme.length * 4)}
                                    y={yText - 10}
                                    width={(site.enzyme.length * 8)}
                                    height={Math.abs(BACKBONE_Y - yText) + 10}
                                    fill="transparent"
                                />

                                <line
                                    x1={site.x + 20} y1={BACKBONE_Y}
                                    x2={site.x + 20} y2={yText + 5}
                                    stroke={hoveredEnzyme === (site.id || `${site.enzyme}-${i}`) ? "#fff" : "#888"}
                                    strokeWidth="1"
                                />
                                <text
                                    x={site.x + 20}
                                    y={yText}
                                    textAnchor="middle"
                                    fill={hoveredEnzyme === (site.id || `${site.enzyme}-${i}`) ? "#fff" : "#ccc"}
                                    fontSize="10"
                                    fontFamily="monospace"
                                    fontWeight={hoveredEnzyme === (site.id || `${site.enzyme}-${i}`) ? "bold" : "normal"}
                                >
                                    {site.enzyme}
                                </text>
                            </g>
                        );
                    })}

                    {/* --- Features (Bottom) --- */}
                    {featureLanes.features.map((feat, i) => {
                        const yRect = BACKBONE_Y + 20 + (feat.lane * FEATURE_LANE_HEIGHT);

                        return (
                            <g
                                key={i}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onFeatureClick?.(feat.start);
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <rect
                                    x={feat.x + 20}
                                    y={yRect}
                                    width={feat.width}
                                    height={10}
                                    fill={feat.color || '#4CAF50'}
                                    rx="2"
                                />
                                {feat.width > 20 && (
                                    <text
                                        x={feat.x + 20 + (feat.width / 2)}
                                        y={yRect + 9}
                                        textAnchor="middle"
                                        fill="#000"
                                        fontSize="9"
                                        fontFamily="sans-serif"
                                        fontWeight="bold"
                                        pointerEvents="none"
                                    >
                                        {feat.name}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* --- Ticks/Ruler --- */}
                    {Array.from({ length: Math.ceil(seqLength / (pixelsPerBp < 1 ? 1000 : 100)) + 1 }).map((_, i) => {
                        const step = pixelsPerBp < 1 ? 1000 : 100; // Adaptive tick step
                        const pos = i * step;
                        if (pos > seqLength) return null;
                        const x = 20 + (pos * pixelsPerBp);
                        return (
                            <g key={`tick-${pos}`}>
                                <line x1={x} y1={BACKBONE_Y - 5} x2={x} y2={BACKBONE_Y + 5} stroke="#ccc" strokeWidth="1" />
                                <text x={x} y={BACKBONE_Y + 15} textAnchor="middle" fill="#888" fontSize="10">{pos}</text>
                            </g>
                        )
                    })}
                </svg>
            </div>

            {/* Zoom Controls Overlay */}
            <div style={{
                position: 'absolute',
                top: 10,
                left: 10,
                backgroundColor: 'rgba(30, 30, 30, 0.9)',
                padding: '8px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                border: '1px solid #444',
                zIndex: 1000
            }}>
                <button onClick={handleFit} style={{ ...btnStyle, fontSize: '11px' }}>Fit</button>
                <div style={{ width: '1px', height: '16px', background: '#555' }}></div>
                <button onClick={handleZoomOut} style={btnStyle}>-</button>
                <input
                    type="range"
                    min={FIT_ZOOM}
                    max={MAX_ZOOM}
                    step="0.01"
                    value={pixelsPerBp}
                    onChange={handleZoomChange}
                    style={{ width: '100px', cursor: 'pointer' }}
                />
                <button onClick={handleZoomIn} style={btnStyle}>+</button>
            </div>
        </div>
    );
}

const btnStyle = {
    background: '#333',
    color: '#eee',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '2px 8px',
    cursor: 'pointer',
    fontSize: '14px',
    minWidth: '24px'
};
