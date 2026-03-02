import { useRef, useEffect, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { EditConfirmationDialog } from '../alignment/EditConfirmationDialog';
import { getComplementSequence } from '../../lib/utils/dnaUtils';
import { useSequenceInteraction } from '../../hooks/useSequenceInteraction';
import { LinearSequenceRow } from './LinearSequenceRow';

interface LinearSequenceViewProps {
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
        position: number; // Cut position (0-based index of bp AFTER cut)
        strand: number;
        recognitionStart?: number;
        recognitionEnd?: number;
        topSnip?: number;
        bottomSnip?: number;
    }>;
    zoom?: number;
    onUpdateSequence?: (newSeq: string) => void;
}

// Layout Constants
const CHAR_WIDTH = 10;
const SEQ_LINE_HEIGHT = 16;
const SPACER_HEIGHT = 24;
const BASE_ROW_HEIGHT = (SEQ_LINE_HEIGHT * 2) + SPACER_HEIGHT;

export interface LinearSequenceViewHandle {
    scrollTo: (pos: number) => void;
}

export const LinearSequenceView = forwardRef<LinearSequenceViewHandle, LinearSequenceViewProps>(function LinearSequenceView({
    sequence,
    annotations = [],
    cutSites = [],
    onUpdateSequence
}, ref) {

    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(800);
    const [hoveredEnzyme, setHoveredEnzyme] = useState<string | null>(null);
    const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);

    // Interaction Hook
    const {
        cursor, setCursor,
        selection,
        dialogState, setDialogState,
        handleSelection,
        handleDrag,
        handleSelectRange,
        handleConfirmEdit,
        handleKeyDown
    } = useSequenceInteraction({ sequence, onUpdateSequence });

    // Handle Mouse Down (calculates index and calls hook)
    const handleMouseDown = (e: React.MouseEvent, rowStart: number) => {
        if (!onUpdateSequence) return;
        if (e.button !== 0) return;

        const x = e.nativeEvent.offsetX;
        const relativeX = x - 20;
        const charIndex = Math.round(relativeX / CHAR_WIDTH);
        let index = rowStart + charIndex;
        index = Math.max(0, Math.min(sequence.length, index));

        handleSelection(index, e.shiftKey);
    };

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const bpsPerRow = Math.max(1, Math.floor((containerWidth - 40) / CHAR_WIDTH));

    // Group sequence into rows with associated data
    const rows = useMemo(() => {
        const rowCount = Math.ceil(sequence.length / bpsPerRow);
        const result = [];
        for (let i = 0; i < rowCount; i++) {
            const start = i * bpsPerRow;
            const end = Math.min(start + bpsPerRow, sequence.length);
            const rowSeq = sequence.slice(start, end);

            // Filter cut sites for this row
            const rowCutSites = cutSites.filter(site =>
                site.position >= start && site.position < end
            ).map(site => ({
                ...site,
                relativePos: site.position - start,
                id: `${site.enzyme}-${site.position}`
            }));

            // --- Enzyme Lane Allocation ---
            rowCutSites.sort((a, b) => a.position - b.position);
            const enzymeLanes: number[] = [];

            const labeledSites = rowCutSites.map(site => {
                const startX = site.relativePos;
                let assignedLane = -1;
                for (let l = 0; l < enzymeLanes.length; l++) {
                    if (enzymeLanes[l] < startX) {
                        // Check for collision (allow 6 chars spacing)
                        if (startX - enzymeLanes[l] > 6) {
                            assignedLane = l;
                            enzymeLanes[l] = startX;
                            break;
                        }
                    }
                }
                if (assignedLane === -1) {
                    assignedLane = enzymeLanes.length;
                    enzymeLanes.push(startX);
                }
                return { ...site, lane: assignedLane };
            });

            const maxEnzymeLane = enzymeLanes.length > 0 ? Math.max(...labeledSites.map(s => s.lane)) : -1;
            const laneHeight = 14;
            const topPadding = (maxEnzymeLane + 1) * laneHeight + 30;

            // --- Feature Lane Allocation ---
            const rowFeatures = annotations.filter(ann => {
                const annStart = ann.start;
                const annEnd = ann.end;
                // Strict Filter: Exclude anything that shares a name with an enzyme
                const isEnzyme = cutSites.some(c => c.enzyme === ann.name);
                if (isEnzyme) return false;

                return annStart < end && annEnd > start;
            }).map(ann => {
                const fStart = Math.max(start, ann.start);
                const fEnd = Math.min(end, ann.end);
                const isOrf = ann.type === 'CDS' || ann.name.toLowerCase().includes('orf');
                return {
                    ...ann,
                    relativeStart: fStart - start,
                    relativeEnd: fEnd - start,
                    width: (fEnd - Math.max(start, ann.start)),
                    isOrf
                };
            });

            // Separate ORF features from regular features
            const orfFeatures = rowFeatures.filter(f => f.isOrf);
            const regularFeatures = rowFeatures.filter(f => !f.isOrf);

            // Sort both types
            orfFeatures.sort((a, b) => a.relativeStart - b.relativeStart);
            regularFeatures.sort((a, b) => a.relativeStart - b.relativeStart);

            // Lane allocation for regular features
            const featureLanes: number[] = [];
            const processedFeatures = regularFeatures.map(feat => {
                let lane = 0;
                while (true) {
                    if (featureLanes.length <= lane) {
                        featureLanes.push(-1);
                    }
                    if (featureLanes[lane] < feat.relativeStart) {
                        featureLanes[lane] = feat.relativeEnd + 1;
                        break;
                    }
                    lane++;
                }
                return { ...feat, lane };
            });

            // Lane allocation for ORF features
            const orfLanes: number[] = [];
            const processedOrfFeatures = orfFeatures.map(feat => {
                let lane = 0;
                while (true) {
                    if (orfLanes.length <= lane) {
                        orfLanes.push(-1);
                    }
                    if (orfLanes[lane] < feat.relativeStart) {
                        orfLanes[lane] = feat.relativeEnd + 1;
                        break;
                    }
                    lane++;
                }
                return { ...feat, lane };
            });

            const maxFeatureLane = featureLanes.length > 0 ? Math.max(...processedFeatures.map(f => f.lane)) : -1;
            const maxOrfLane = orfLanes.length > 0 ? Math.max(...processedOrfFeatures.map(f => f.lane)) : -1;
            const featureHeight = 32;
            const orfHeight = 45; // Height per ORF lane
            const orfZonePadding = (maxOrfLane + 1) * orfHeight + (orfFeatures.length > 0 ? 10 : 0);
            const bottomPadding = (maxFeatureLane + 1) * featureHeight + 20;

            result.push({
                index: i,
                start,
                end,
                seq: rowSeq,
                compSeq: getComplementSequence(rowSeq),
                cutSites: labeledSites,
                features: processedFeatures,
                orfFeatures: processedOrfFeatures,
                height: topPadding + BASE_ROW_HEIGHT + orfZonePadding + bottomPadding,
                topPadding,
                orfZonePadding
            });
        }
        return result;
    }, [sequence, bpsPerRow, cutSites, annotations, containerWidth]);

    // Expose scrollTo method
    useImperativeHandle(ref, () => ({
        scrollTo: (pos: number) => {
            if (!containerRef.current || !rows.length) return;

            // Find which row contains the pos
            const rowIndex = rows.findIndex(r => pos >= r.start && pos < r.end);
            if (rowIndex === -1) return;

            // Calculate Y offset
            let yOffset = 20;
            for (let i = 0; i < rowIndex; i++) {
                yOffset += rows[i].height + 10;
            }

            containerRef.current.scrollTo({
                top: yOffset,
                behavior: 'smooth'
            });

            setCursor(pos);
        }
    }), [rows, setCursor]);

    return (
        <div
            ref={containerRef}
            className="lsv-container"
            style={{
                width: '100%',
                height: '100%',
                overflowY: 'auto',
                overflowX: 'hidden',
                background: '#111',
                color: '#eee',
                fontFamily: "'Roboto Mono', 'Courier New', monospace",
                position: 'relative',
                outline: 'none'
            }}
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            <div style={{ padding: '20px 0' }}>
                {rows.map((row, i) => (
                    <LinearSequenceRow
                        key={i}
                        row={row}
                        sequenceLength={sequence.length}
                        bpsPerRow={bpsPerRow}
                        fullSequence={sequence}
                        selection={selection}
                        cursor={cursor}
                        hoveredEnzyme={hoveredEnzyme}
                        hoveredFeature={hoveredFeature}
                        setHoveredEnzyme={setHoveredEnzyme}
                        setHoveredFeature={setHoveredFeature}
                        onMouseDown={(e) => handleMouseDown(e, row.start)}
                        onDrag={handleDrag}
                        onSelectRange={handleSelectRange}
                        onUpdateSequence={onUpdateSequence}
                    />
                ))}
            </div>

            <EditConfirmationDialog
                isOpen={dialogState.isOpen}
                mode={dialogState.mode}
                onCancel={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handleConfirmEdit}
                originalText={dialogState.originalText}
                newText={dialogState.newText}
                startIndex={dialogState.pos}
                sequenceName="Sequence"
            />
        </div>
    );
});
