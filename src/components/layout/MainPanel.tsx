import { SequenceViewer } from "../viewer/SequenceViewer";
import { Save, RotateCcw, RotateCw, Scissors, Copy, Clipboard, Printer, Search, ChevronDown, ChevronRight, GitCompare, Settings } from "lucide-react";
import { useState, useMemo } from "react";
import { findORFs } from "../../lib/analysis/orfFinder";
import { analyzeRestrictionSites, ENZYME_DATABASE, CutSite } from "../../lib/analysis/restrictionEnzymes";
import { AlignmentView, AlignableSequence } from "../alignment";
import { CodeEditor } from "../editor/CodeEditor";
import { settingsManager } from "../../lib/settings/settingsManager";

interface MainPanelProps {
    fileName?: string;
    sequence?: string;
    annotations?: Array<{
        name: string;
        start: number;
        end: number;
        direction?: 1 | -1;
        color?: string;
    }>;
    /** Sequences available for alignment (e.g., open AB1 files) */
    alignableSequences?: AlignableSequence[];
    /** Callback to open a file (for drag-drop) */
    onOpenFile?: (path: string) => void;
    /** Callback to add file to alignment without opening it */
    onAddToAlignment?: (path: string) => void;
    /** Callback to remove sequences from alignment pool */
    onRemoveFromAlignment?: (ids: string[]) => void;
    /** Type of the file being viewed */
    fileType?: 'genbank' | 'fasta' | 'ab1' | 'text' | 'json';

    // New Props for Persistence & Editing
    file?: any;
    viewState?: any;
    updateViewState?: any;
    onUpdateSequence?: (id: string, newSequence: string) => void;
}

export type ViewMode = 'viewer' | 'alignment';

interface MainPanelProps {
    fileName?: string;
    sequence?: string;
    annotations?: Array<{
        name: string;
        start: number;
        end: number;
        direction?: 1 | -1;
        color?: string;
    }>;
    /** Sequences available for alignment (e.g., open AB1 files) */
    alignableSequences?: AlignableSequence[];
    /** Callback to open a file (for drag-drop) */
    onOpenFile?: (path: string) => void;
    /** Callback to add file to alignment without opening it */
    onAddToAlignment?: (path: string) => void;
    /** Callback to remove sequences from alignment pool */
    onRemoveFromAlignment?: (ids: string[]) => void;
    /** Type of the file being viewed */
    fileType?: 'genbank' | 'fasta' | 'ab1' | 'text' | 'json';

    // Controlled state props
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    selectedAlignmentIds: string[];
    onSelectionChange: (ids: string[]) => void;

    // View Toggles (Lifted state)
    showMap: boolean;
    onShowMapChange: (show: boolean) => void;
    showSequence: boolean;
    onShowSequenceChange: (show: boolean) => void;
    showEnzymes: boolean;
    onShowEnzymesChange: (show: boolean) => void;
    showORFs: boolean;
    onShowORFsChange: (show: boolean) => void;

    // File Operations
    onSave?: () => void;
    onSaveAs?: () => void;
    onCut?: () => void;
    onCopy?: () => void;
    onPaste?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
}

export function MainPanel({
    fileName,
    sequence,
    annotations = [],
    alignableSequences = [],
    onAddToAlignment,
    onRemoveFromAlignment,
    fileType,
    file,
    // viewState, // Unused
    // updateViewState, // Unused
    onUpdateSequence,
    viewMode,
    onViewModeChange,
    selectedAlignmentIds,
    onSelectionChange,
    showMap,
    onShowMapChange,
    showSequence,
    onShowSequenceChange,
    showEnzymes,
    onShowEnzymesChange,
    showORFs,
    onShowORFsChange,
    onSave,
    onSaveAs,
    onCut,
    onCopy,
    onPaste,
    onUndo,
    onRedo,
    canUndo,
    canRedo
}: MainPanelProps) {
    // Load defaults from settings
    const settings = settingsManager.getAll();
    const [minLen, setMinLen] = useState(settings['orf.minLength'] || 75);
    const [maxCuts, setMaxCuts] = useState(settings['enzymes.maxCuts'] || 1);

    // Calculate ORFs on fly if enabled
    const detectedORFs = useMemo(() => {
        if (!sequence || !showORFs) return [];
        return findORFs(sequence, { minLength: minLen });
    }, [sequence, showORFs, minLen]);

    // Calculate enzyme cut sites
    const enzymeResults = useMemo(() => {
        if (!sequence || !showEnzymes) return new Map();
        const results = analyzeRestrictionSites(sequence, ENZYME_DATABASE);

        // Filter by maxCuts
        const filtered = new Map();
        for (const [enzyme, sites] of results.entries()) {
            if (sites.length <= maxCuts) {
                filtered.set(enzyme, sites);
            }
        }
        return filtered;
    }, [sequence, showEnzymes, maxCuts]);

    // Flat list of cut sites for SnapGene-style labels
    const cutSites = useMemo((): CutSite[] => {
        if (!showEnzymes) return [];
        const sites: CutSite[] = [];
        enzymeResults.forEach((enzymeSites) => {
            enzymeSites.forEach((site: CutSite) => {
                sites.push(site);
            });
        });
        return sites;
    }, [enzymeResults, showEnzymes]);

    // Count actual biological features (GenBank annotations + ORFs, NOT enzyme sites)
    const featureCount = annotations.length + detectedORFs.length;

    // Merge annotations for display (features + ORFs, but NO enzyme markers as features)
    const displayAnnotations = useMemo(() => {
        const orfAnnotations = detectedORFs.map((orf, i) => ({
            name: `ORF${i + 1} (${orf.length}bp)`,
            start: orf.start,
            end: orf.end,
            direction: orf.strand,
            color: '#FF9800'
        }));
        return [...annotations, ...orfAnnotations];
    }, [annotations, detectedORFs]);

    // Handle Enzymes tab click - simple toggle
    const handleEnzymesTabClick = () => {
        onShowEnzymesChange(!showEnzymes);
    };

    return (
        <div className="main-panel">
            {/* Top Toolbar */}
            <div className="toolbar">
                <div className="toolbar-group">
                    <ToolbarBtn icon={Save} label="Save" onClick={onSave} />
                    <ToolbarBtn icon={Save} label="Save As" onClick={onSaveAs} />
                    <div className="toolbar-separator"></div>
                    <ToolbarBtn icon={RotateCcw} label="Undo" onClick={onUndo} disabled={!canUndo} />
                    <ToolbarBtn icon={RotateCw} label="Redo" onClick={onRedo} disabled={!canRedo} />
                    <div className="toolbar-separator"></div>
                    <ToolbarBtn icon={Scissors} label="Cut" onClick={onCut} />
                    <ToolbarBtn icon={Copy} label="Copy" onClick={onCopy} />
                    <ToolbarBtn icon={Clipboard} label="Paste" onClick={onPaste} />
                    <div className="toolbar-separator"></div>
                    <ToolbarBtn icon={Printer} label="Print" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{fileName || "No File Selected"}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>({sequence ? sequence.length : 0} bp)</span>
                    {featureCount > 0 && (
                        <span style={{ color: 'var(--accent-color)', fontSize: 11 }}>
                            {featureCount} feature{featureCount !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>

            {/* View Tabs - now act as toggles, or Settings Toolbar */}
            <div className="view-tabs">
                {fileType === 'json' && fileName === 'settings.json' ? (
                    // Settings Toolbar
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#e0e0e0', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Settings size={14} /> Settings
                        </span>

                        <div style={{ width: 1, height: 16, backgroundColor: '#444' }}></div>

                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                background: '#2196f3', border: 'none', borderRadius: 3,
                                color: 'white', padding: '4px 8px', fontSize: 11, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4
                            }}
                        >
                            <RotateCw size={12} /> Reload App (Apply Changes)
                        </button>

                        <button
                            onClick={() => {
                                if (confirm("Are you sure you want to restore default settings? This cannot be undone.")) {
                                    const defaultContent = settingsManager.restoreDefaults();
                                    if (onUpdateSequence && file) {
                                        onUpdateSequence(file.path, defaultContent);
                                    }
                                }
                            }}
                            className="restore-defaults-btn" // Placeholder class, inline style below
                            style={{
                                background: 'transparent', border: '1px solid #d32f2f', borderRadius: 3,
                                color: '#ef5350', padding: '3px 8px', fontSize: 11, cursor: 'pointer'
                            }}
                        >
                            Restore Defaults
                        </button>
                    </div>
                ) : (
                    // Standard View Tabs
                    <>
                        <ViewTab
                            label="Map"
                            active={viewMode === 'viewer' && showMap}
                            onClick={() => {
                                if (viewMode === 'alignment') {
                                    onViewModeChange('viewer');
                                    onShowMapChange(true);
                                } else {
                                    onShowMapChange(!showMap);
                                }
                            }}
                        />
                        <ViewTab
                            label="Sequence"
                            active={viewMode === 'viewer' && showSequence}
                            onClick={() => {
                                if (viewMode === 'alignment') {
                                    onViewModeChange('viewer');
                                    onShowSequenceChange(true);
                                } else {
                                    onShowSequenceChange(!showSequence);
                                }
                            }}
                        />
                        <ViewTab label="Enzymes" active={showEnzymes} onClick={handleEnzymesTabClick} />
                        <ViewTab
                            label="Alignment"
                            active={viewMode === 'alignment'}
                            onClick={() => {
                                onViewModeChange('alignment');
                                onShowMapChange(false);
                                onShowSequenceChange(false);
                            }}
                            icon={<GitCompare size={12} style={{ marginRight: 4 }} />}
                            badge={alignableSequences.length > 0 ? alignableSequences.length : undefined}
                        />

                        <div style={{ flex: 1 }}></div>

                        {/* ORF Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
                            <ToggleButton
                                active={showORFs}
                                onClick={() => onShowORFsChange(!showORFs)}
                                icon={<Search size={12} />}
                                label={showORFs ? 'Hide ORFs' : 'ORFs'}
                                color="#FF9800"
                            />
                            {showORFs && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#888' }}>
                                    <input type="number" value={minLen} onChange={(e) => setMinLen(Number(e.target.value))}
                                        style={{ width: 36, background: '#222', border: '1px solid #444', color: '#ccc', padding: '1px 4px', borderRadius: 3 }} />
                                    <span>bp</span>
                                </div>
                            )}
                        </div>
                    </>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                </div>
            </div>

            {/* Viewer Area - conditional display based on mode */}
            <div className="viewer-area" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Special handling for Text/JSON Editor - bypasses viewMode */}
                {(fileType === 'json' || fileType === 'text') ? (
                    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                        <CodeEditor
                            content={sequence || ''}
                            language={fileType === 'json' ? 'json' : 'text'}
                            onChange={(newContent) => {
                                if (onUpdateSequence && file) {
                                    onUpdateSequence(file.path, newContent);
                                }
                            }}
                            onSave={onSave}
                        />
                    </div>
                ) : (
                    <>
                        {viewMode === 'alignment' ? (
                            // Alignment View
                            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <AlignmentView
                                        referenceSequence={sequence || ''}
                                        referenceName={fileName?.replace(/\.[^/.]+$/, '') || 'Reference'}
                                        referenceId={file?.path}
                                        availableSequences={alignableSequences}
                                        selectedIds={selectedAlignmentIds}
                                        onSelectionChange={onSelectionChange}
                                        cutSites={cutSites}
                                        annotations={displayAnnotations}
                                        onDropFile={onAddToAlignment}
                                        onRemoveSequence={onRemoveFromAlignment}
                                        onUpdateSequence={onUpdateSequence}
                                    />
                                </div>
                            </div>
                        ) : (
                            // Normal Viewer Mode
                            <>
                                {/* Sequence Viewer with Map/Sequence control */}
                                {(showMap || showSequence) && (
                                    <div style={{ flex: 1, minHeight: 0 }}>
                                        <SequenceViewer
                                            sequence={sequence || ""}
                                            annotations={displayAnnotations}
                                            showCircular={showMap}
                                            showLinear={showSequence}
                                            name={fileName?.replace(/\.[^/.]+$/, '') || 'Sequence'}
                                            cutSites={cutSites}
                                            mapViewType={fileType === 'fasta' ? 'linear' : 'circular'}
                                            onUpdateSequence={onUpdateSequence ? (newSeq) => onUpdateSequence(file.path, newSeq) : undefined}
                                        />
                                    </div>
                                )}

                                {/* Empty state */}
                                {!showMap && !showSequence && !showEnzymes && (
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                                        Enable a view (Map, Sequence, or Enzymes) to see content
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* Enzyme Table (shared across both modes) - positioned at bottom */}
                {showEnzymes && (
                    <div style={{
                        position: 'relative',
                        zIndex: 10,
                        flex: '0 0 auto',
                        borderTop: '1px solid #333'
                    }}>
                        <EnzymeTable
                            results={enzymeResults}
                            maxCuts={maxCuts}
                            onMaxCutsChange={setMaxCuts}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

// Enzyme Table Component - Collapsible
function EnzymeTable({
    results,
    maxCuts,
    onMaxCutsChange
}: {
    results: Map<string, { enzyme: string; position: number }[]>,
    maxCuts: number,
    onMaxCutsChange: (val: number) => void
}) {
    const [isExpanded, setIsExpanded] = useState(false); // Default to false (minimized)
    const sortedResults = Array.from(results.entries()).sort((a, b) => b[1].length - a[1].length);
    const totalSites = sortedResults.reduce((sum, [, sites]) => sum + sites.length, 0);

    return (
        <div style={{ backgroundColor: '#1e1e1e', height: '100%' }}>
            {/* Header */}
            <div
                style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    userSelect: 'none',
                    justifyContent: 'space-between',
                    borderBottom: isExpanded ? '1px solid #333' : 'none'
                }}
            >
                <div
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                >
                    {isExpanded ? <ChevronDown size={14} color="#888" /> : <ChevronRight size={14} color="#888" />}
                    <span style={{ fontSize: 12, color: '#ccc' }}>
                        {sortedResults.length} enzymes cutting
                    </span>
                    <span style={{ fontSize: 11, color: '#E91E63' }}>
                        ({totalSites} sites)
                    </span>
                </div>

                {/* Filter Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#888' }}>
                    <span>Max Sites:</span>
                    <input
                        type="number"
                        min="1"
                        value={maxCuts}
                        onChange={(e) => onMaxCutsChange(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{
                            width: 50,
                            backgroundColor: '#2a2a2a',
                            border: '1px solid #444',
                            borderRadius: 3,
                            color: '#eee',
                            padding: '2px 4px',
                            fontSize: 11
                        }}
                    />
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div style={{ padding: '8px 12px 12px 28px' }}>
                    {sortedResults.length === 0 ? (
                        <div style={{ padding: 8, color: '#666', fontSize: 11, fontStyle: 'italic' }}>
                            No enzymes found matching "Max Sites: {maxCuts}"
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {sortedResults.map(([enzyme, sites]) => (
                                <div key={enzyme} style={{
                                    padding: '3px 6px',
                                    backgroundColor: '#2a2a2a',
                                    borderRadius: 3,
                                    fontSize: 10
                                }}>
                                    <span style={{ color: '#E91E63', fontWeight: 500 }}>{enzyme}</span>
                                    <span style={{ color: '#888', marginLeft: 4 }}>×{sites.length}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ToggleButton({ active, onClick, icon, label, color }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; color: string }) {
    return (
        <button onClick={onClick} style={{
            backgroundColor: active ? `${color}22` : 'transparent',
            color: active ? color : '#888',
            border: `1px solid ${active ? color : '#444'}`,
            padding: '2px 8px',
            borderRadius: 3,
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
        }}>
            {icon}
            {label}
        </button>
    );
}

function ToolbarBtn({ icon: Icon, label, onClick, disabled }: { icon: any, label: string, onClick?: () => void, disabled?: boolean }) {
    return (
        <div
            className="toolbar-btn"
            onClick={!disabled ? onClick : undefined}
            style={{
                opacity: disabled ? 0.3 : 1,
                cursor: disabled ? 'default' : 'pointer',
                pointerEvents: disabled ? 'none' : 'auto'
            }}
        >
            <Icon size={16} strokeWidth={1.5} />
            <span>{label}</span>
        </div>
    )
}

function ViewTab({ label, active, onClick, icon, badge }: { label: string, active?: boolean, onClick?: () => void, icon?: React.ReactNode, badge?: number }) {
    return (
        <span
            className={`view-tab ${active ? 'active' : ''}`}
            onClick={onClick}
            style={{ cursor: onClick ? 'pointer' : 'default', opacity: onClick ? 1 : 0.5, display: 'flex', alignItems: 'center' }}
        >
            {icon}
            {label}
            {badge !== undefined && badge > 0 && (
                <span style={{
                    marginLeft: 4,
                    backgroundColor: '#4fc3f7',
                    color: '#1e1e1e',
                    fontSize: 9,
                    padding: '1px 4px',
                    borderRadius: 8,
                    fontWeight: 600
                }}>
                    {badge}
                </span>
            )}
        </span>
    )
}


