import { Files, Box, ChevronRight, ChevronDown, X, Folder, RefreshCw } from "lucide-react";
import { useState } from "react";
import JSZip from "jszip";
import { useFolderContent } from "../../hooks/useFileSystem";
import { setDraggedFile } from "../../lib/dragState";

interface SidebarProps {
    openFolders: string[];
    recentFolders: string[];
    onNavigate: (path: string) => void; // Open a folder (add to stack)
    onOpenFile: (path: string) => void;
    onOpenFolderDialog: () => void;
    onCloseFolder: (path: string) => void; // Close specific folder
    onRemoveRecent: (path: string) => void;
}

export function Sidebar({ openFolders, recentFolders, onNavigate, onOpenFile, onOpenFolderDialog, onCloseFolder, onRemoveRecent }: SidebarProps) {
    const [activeTab, setActiveTab] = useState("files");

    // File Explorer State
    const [recentExpanded, setRecentExpanded] = useState(true);
    const [hoveredRecent, setHoveredRecent] = useState<string | null>(null);

    // Extension System State
    const [installedExtensions, setInstalledExtensions] = useState<Array<{ id: string, name: string, version: string, description: string }>>([]);

    // region Extensions Logic
    const handleLoadExtension = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);

            // Read manifest
            const manifestFile = zip.file("manifest.json");
            if (!manifestFile) {
                alert("Invalid extension: missing manifest.json");
                return;
            }

            const manifestContent = await manifestFile.async("string");
            const manifest = JSON.parse(manifestContent);

            // Read main script
            const mainScriptFile = zip.file("extension.js") || zip.file("main.js");
            if (!mainScriptFile) {
                alert("Invalid extension: missing extension.js or main.js");
                return;
            }

            const scriptContent = await mainScriptFile.async("string");

            // Execute script
            try {
                (function () {
                    try {
                        // eslint-disable-next-line no-eval
                        window.eval(scriptContent);
                        console.log(`[Extension] Executed ${manifest.name}`);
                    } catch (err) {
                        console.error(`[Extension] Error executing ${manifest.name}:`, err);
                        alert(`Error executing extension: ${err}`);
                    }
                })();
            } catch (e) {
                console.error("Script execution failed", e);
            }

            const newExtension = {
                id: manifest.id || file.name,
                name: manifest.name || "Unknown Extension",
                version: manifest.version || "0.0.0",
                description: manifest.description || "Local extension",
                fileObj: file
            };

            setInstalledExtensions(prev => {
                if (prev.some(e => e.id === newExtension.id)) return prev;
                return [...prev, newExtension];
            });

        } catch (error) {
            console.error("Failed to load extension:", error);
            alert("Failed to load extension. See console for details.");
        }
        event.target.value = '';
    };


    const getDisplayPath = (path: string) => {
        const parts = path.split(/[\\\/]/);
        if (parts.length > 3) {
            return "~/" + parts.slice(-2).join("/");
        }
        return path;
    };

    return (
        <div className="sidebar">
            {/* Activity Bar */}
            <div className="activity-bar">
                <ActivityIcon icon={Files} active={activeTab === "files"} onClick={() => setActiveTab("files")} />
                <ActivityIcon icon={Box} active={activeTab === "extensions"} onClick={() => setActiveTab("extensions")} />
            </div>

            {/* Side Panel */}
            <div className="explorer-panel">
                {activeTab === "files" ? (
                    <>
                        <div className="explorer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 11, letterSpacing: '0.05em' }}>EXPLORER</span>
                            <button
                                onClick={onOpenFolderDialog}
                                style={{
                                    fontSize: 10,
                                    backgroundColor: '#007acc',
                                    color: 'white',
                                    padding: '2px 8px',
                                    borderRadius: 3,
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                Open...
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>

                            {/* RECENT FOLDERS (Source) */}
                            {recentFolders.length > 0 && (
                                <div style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '6px 8px',
                                            cursor: 'pointer',
                                            color: 'var(--text-secondary)'
                                        }}
                                        onClick={() => setRecentExpanded(!recentExpanded)}
                                    >
                                        {recentExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginLeft: 4 }}>
                                            Recent Folders
                                        </span>
                                    </div>

                                    {recentExpanded && (
                                        <div style={{ paddingBottom: 8 }}>
                                            {recentFolders.map(path => {
                                                const folderName = path.split(/[\\\/]/).pop();
                                                const isHovered = hoveredRecent === path;
                                                // It's active if it's in the openFolders list
                                                const isActive = openFolders.includes(path);

                                                return (
                                                    <div
                                                        key={path}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            padding: '4px 12px',
                                                            cursor: 'pointer',
                                                            backgroundColor: isHovered ? 'var(--bg-hover)' : 'transparent',
                                                            color: isActive ? 'var(--text-active)' : 'var(--text-primary)'
                                                        }}
                                                        onMouseEnter={() => setHoveredRecent(path)}
                                                        onMouseLeave={() => setHoveredRecent(null)}
                                                    >
                                                        <div
                                                            style={{ flex: 1, minWidth: 0 }}
                                                            onClick={() => onNavigate(path)}
                                                            title={path}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <Folder size={14} style={{ color: isActive ? '#007acc' : '#dcb67a', flexShrink: 0 }} />
                                                                <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {folderName}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 20 }}>
                                                                {getDisplayPath(path)}
                                                            </div>
                                                        </div>
                                                        <div
                                                            style={{
                                                                opacity: isHovered ? 1 : 0,
                                                                padding: 4,
                                                                borderRadius: 3,
                                                                cursor: 'pointer',
                                                                transition: 'opacity 0.15s'
                                                            }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onRemoveRecent(path);
                                                            }}
                                                            title="Remove from Recent"
                                                        >
                                                            <X size={12} style={{ color: 'var(--text-secondary)' }} />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* OPEN WORKSPACE FOLDERS (Stacked) */}
                            {openFolders.map(path => (
                                <WorkspaceFolder
                                    key={path}
                                    path={path}
                                    onClose={() => onCloseFolder(path)}
                                    onOpenFile={onOpenFile}
                                    onNavigate={onNavigate} // Recursive Nav if needed or just to open
                                />
                            ))}

                            {/* Empty state when nothing is open */}
                            {openFolders.length === 0 && recentFolders.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                        No folders open.
                                    </p>
                                    <button
                                        onClick={onOpenFolderDialog}
                                        style={{
                                            backgroundColor: '#007acc',
                                            color: 'white',
                                            fontSize: 12,
                                            padding: '6px 16px',
                                            borderRadius: 4,
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Open Folder
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* Extensions Panel */
                    <>
                        <div className="explorer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 11, letterSpacing: '0.05em' }}>EXTENSIONS</span>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                <input
                                    type="file"
                                    id="extension-upload"
                                    accept=".zip"
                                    style={{ display: 'none' }}
                                    onChange={handleLoadExtension}
                                />
                                <button
                                    onClick={() => document.getElementById('extension-upload')?.click()}
                                    style={{
                                        width: '100%',
                                        backgroundColor: '#007acc',
                                        color: 'white',
                                        fontSize: 12,
                                        padding: '8px 12px',
                                        borderRadius: 4,
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8
                                    }}
                                >
                                    <span>Load Extension...</span>
                                </button>
                            </div>
                            {installedExtensions.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {installedExtensions.map(ext => (
                                        <div key={ext.id} style={{ display: 'flex', gap: 8, padding: 8, backgroundColor: 'var(--bg-hover)', borderRadius: 4 }}>
                                            <div style={{ fontSize: 24 }}>📦</div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 500 }}>{ext.name}</div>
                                                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{ext.description}</div>
                                                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                                                    <button
                                                        onClick={() => {
                                                            // @ts-ignore
                                                            if (window.orfview && window.orfview.uninstall) {
                                                                // @ts-ignore
                                                                window.orfview.uninstall(ext.id);
                                                            }
                                                            setInstalledExtensions(prev => prev.filter(p => p.id !== ext.id));
                                                        }}
                                                        style={{ fontSize: 10, padding: 0, border: 'none', background: 'none', color: '#f44336', cursor: 'pointer' }}
                                                    >
                                                        Uninstall
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// Sub-component for each stacked folder view using its own file hook
function WorkspaceFolder({ path, onClose, onOpenFile, onNavigate }: { path: string, onClose: () => void, onOpenFile: (p: string) => void, onNavigate: (p: string) => void }) {
    const { files, loading, error, refresh } = useFolderContent(path);
    const [expanded, setExpanded] = useState(true);
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div style={{ borderBottom: '1px solid var(--border-color)' }}>
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 8px',
                    color: 'var(--text-secondary)',
                    backgroundColor: isHovered ? 'var(--bg-hover)' : 'transparent'
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                <span
                    onClick={() => setExpanded(!expanded)}
                    style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginLeft: 4, cursor: 'pointer', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    title={path}
                >
                    {path.split(/[\\\/]/).pop()}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4 }}>
                    <div onClick={refresh} style={{ cursor: 'pointer', padding: 2 }} title="Refresh">
                        <RefreshCw size={10} />
                    </div>
                    <div onClick={onClose} style={{ cursor: 'pointer', padding: 2 }} title="Close Folder">
                        <X size={12} />
                    </div>
                </div>
            </div>

            {/* Content */}
            {expanded && (
                <div style={{ paddingBottom: 8, paddingLeft: 8 }}>
                    {loading ? (
                        <div style={{ padding: 8, fontSize: 11, fontStyle: 'italic', color: 'var(--text-secondary)' }}>Loading...</div>
                    ) : error ? (
                        <div style={{ padding: 8, fontSize: 11, color: 'red' }}>Error loading files</div>
                    ) : (
                        <>
                            {files.map((file) => (
                                <FileItem
                                    key={file.path}
                                    name={file.name}
                                    isDir={file.is_dir}
                                    filePath={file.path}
                                    icon={file.name.endsWith(".dna") || file.name.endsWith(".seq") || file.name.endsWith(".gb") || file.name.endsWith(".ab1") || file.name.endsWith(".fasta") || file.name.endsWith(".fa") ? "dna" : undefined}
                                    onClick={() => file.is_dir ? onNavigate(file.path) : onOpenFile(file.path)}
                                />
                            ))}
                            {files.length === 0 && (
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', paddingLeft: 12 }}>
                                    (Empty folder)
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function ActivityIcon({ icon: Icon, active, onClick }: { icon: any, active: boolean, onClick: () => void }) {
    return (
        <div
            className={`activity-icon ${active ? 'active' : ''}`}
            onClick={onClick}
        >
            <Icon size={24} strokeWidth={1.5} />
        </div>
    );
}

function FileItem({ name, isDir, isOpen, active, icon, onClick, filePath }: { name: string, isDir?: boolean, isOpen?: boolean, active?: boolean, icon?: string, onClick?: () => void, filePath?: string }) {
    const handleDragStart = (e: React.DragEvent) => {
        if (filePath && !isDir) {
            e.dataTransfer.setData('text/plain', filePath);
            e.dataTransfer.effectAllowed = 'copy';
            setDraggedFile(filePath);
        }
    };

    const isDraggable = !isDir;

    return (
        <div
            className={`file-item ${active ? 'active' : ''}`}
            onClick={onClick}
            draggable={isDraggable}
            onDragStart={handleDragStart}
            style={{ cursor: isDraggable ? 'grab' : 'pointer' }}
            title={isDraggable ? 'Drag to Alignment panel' : undefined}
        >
            <span className="file-icon-spacer">
                {isDir ? (isOpen ? "▾" : "▸") : ""}
                {!isDir && icon === "dna" && <span style={{ fontSize: 10, marginRight: 4 }}>🧬</span>}
            </span>
            <span className="file-name">{name}</span>
        </div>
    )
}
