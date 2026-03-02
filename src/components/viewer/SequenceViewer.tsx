import { SeqViz } from "seqviz";
import { useRef, useEffect, useState } from "react";
import { LinearSequenceView, LinearSequenceViewHandle } from "./LinearSequenceView";
import { LinearMap } from "./LinearMap";
import { Circle } from "lucide-react";

// Custom Linear Icon |---|
const LinearIcon = ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="12" x2="21" y2="12" />
        <path d="M3 7v10" />
        <path d="M21 7v10" />
    </svg>
);

interface SequenceViewerProps {
    sequence: string;
    annotations: any[];
    showCircular?: boolean;
    showLinear?: boolean;
    name?: string;
    cutSites?: Array<{
        enzyme: string;
        position: number;
        strand: number;
        recognitionStart?: number;
        recognitionEnd?: number;
        topSnip?: number;
        bottomSnip?: number;
    }>;
    mapViewType?: 'circular' | 'linear';
    onUpdateSequence?: (newSeq: string) => void;
}

export function SequenceViewer({ sequence, annotations, showCircular = true, showLinear = true, name = 'Sequence', cutSites = [], mapViewType = 'circular', onUpdateSequence }: SequenceViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const lsvRef = useRef<LinearSequenceViewHandle>(null); // Ref to Linear View
    const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
    const [activeMapViewType, setActiveMapViewType] = useState(mapViewType);

    // Sync state if prop changes (e.g. switching files)
    useEffect(() => {
        setActiveMapViewType(mapViewType);
    }, [mapViewType]);

    // Measure container and update on resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setDimensions({
                    width: rect.width || 800,
                    height: rect.height || 500
                });
            }
        };

        updateDimensions();

        const observer = new ResizeObserver(updateDimensions);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const defaultSeq = "ATGCGTACGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG";

    const defaultAnnotations = [
        { name: "Promoter", start: 0, end: 30, direction: 1 as const, color: "#2196F3" },
        { name: "Gene", start: 40, end: 100, direction: 1 as const, color: "#4CAF50" }
    ];

    const displaySeq = sequence || defaultSeq;
    const displayAnnotations = annotations || defaultAnnotations;

    const handleFeatureClick = (pos: number) => {
        if (lsvRef.current) {
            lsvRef.current.scrollTo(pos);
        }
    };

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'row', // Horizontal split
                overflow: 'hidden'
            }}
        >
            {showLinear && (
                <div
                    style={{
                        flex: showCircular ? '0 0 50%' : 1,
                        position: 'relative',
                        overflow: 'hidden',
                        borderRight: showCircular ? '1px solid #333' : 'none'
                    }}
                >
                    <LinearSequenceView
                        ref={lsvRef}
                        sequence={displaySeq}
                        annotations={displayAnnotations}
                        cutSites={cutSites}
                        onUpdateSequence={onUpdateSequence}
                    />
                </div>
            )}

            {showCircular && (
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 10 }}>
                    <div style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        zIndex: 100,
                        display: 'flex',
                        backgroundColor: '#1e1e1e',
                        borderRadius: 4,
                        padding: 2,
                        border: '1px solid #333'
                    }}>
                        <button
                            onClick={() => setActiveMapViewType('linear')}
                            title="Linear Map"
                            style={{
                                background: activeMapViewType === 'linear' ? '#333' : 'transparent',
                                border: 'none',
                                borderRadius: 3,
                                color: activeMapViewType === 'linear' ? '#fff' : '#888',
                                padding: 4,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <LinearIcon size={16} />
                        </button>
                        <button
                            onClick={() => setActiveMapViewType('circular')}
                            title="Circular Map"
                            style={{
                                background: activeMapViewType === 'circular' ? '#333' : 'transparent',
                                border: 'none',
                                borderRadius: 3,
                                color: activeMapViewType === 'circular' ? '#fff' : '#888',
                                padding: 4,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <Circle size={16} />
                        </button>
                    </div>

                    {dimensions.height > 0 && (
                        activeMapViewType === 'linear' ? (
                            <LinearMap
                                sequence={displaySeq}
                                annotations={displayAnnotations}
                                cutSites={cutSites}
                                containerWidth={showLinear ? dimensions.width / 2 : dimensions.width}
                                onFeatureClick={handleFeatureClick}
                            />
                        ) : (
                            <SeqViz
                                name={name}
                                seq={displaySeq}
                                annotations={displayAnnotations}
                                enzymes={Array.from(new Set(cutSites.map(c => c.enzyme)))}
                                style={{
                                    height: dimensions.height, // Full height
                                    width: showLinear ? dimensions.width / 2 : dimensions.width // Half width if split
                                }}
                                viewer="circular"
                                onSelection={(selection: any) => {
                                    if (selection && (selection.start !== undefined)) {
                                        handleFeatureClick(selection.start);
                                    }
                                }}
                            />
                        )
                    )}
                </div>
            )}
        </div>
    );
}
