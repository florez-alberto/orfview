import { useEffect, useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { TabBar } from "./components/layout/TabBar";
import { MainPanel } from "./components/layout/MainPanel";
import { StatusBar } from "./components/layout/StatusBar";
import { useExtensionSystem } from "./hooks/useExtensionSystem";
import { useWorkspaceState } from "./hooks/useWorkspaceState";
import { useFileHandler, getSequenceData } from "./hooks/useFileHandler";
import { ChromatogramViewer } from "./components/viewer/ChromatogramViewer";
import { AlignableSequence } from "./components/alignment";
// ActiveFile import used for typing in map if needed, though mostly inferred
// import { ActiveFile } from "./lib/types";

import { settingsManager } from "./lib/settings/settingsManager";

function App() {


  // 1. Get State
  const workspace = useWorkspaceState();
  const {
    openFolders, setOpenFolders,
    recentFolders, removeRecentFolder,
    openFolderDialog,
    openFiles, activeFileId, setActiveFileId,
    visibleTabs, loading, modifiedFiles,
    alignmentPool,
    getFileViewState, updateFileViewState,
  } = workspace;

  // Sidebar Visibility State
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(() => settingsManager.get('ui.sidebarVisible') ?? true);

  // 2. Get Handlers
  const {
    handleOpenFile,
    handleAddToAlignment,
    handleRemoveFromAlignment,
    updateFileContent,
    handleCloseTab,
    handleSave,
    handleSaveAs,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo
  } = useFileHandler(workspace);

  // Initialize Extension API with context
  useExtensionSystem({
    activeFileId,
    openFiles,
    onOpenFile: handleOpenFile,
    onUpdateSequence: updateFileContent
  });


  // Clipboard Handlers (dispatch events)
  const handleCut = () => window.dispatchEvent(new CustomEvent('app:cut'));
  const handleCopy = () => window.dispatchEvent(new CustomEvent('app:copy'));
  const handlePaste = () => window.dispatchEvent(new CustomEvent('app:paste'));

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Sidebar: Cmd+B (VSCode style)
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarVisible(prev => !prev);
        return;
      }

      // Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) handleSaveAs();
        else handleSave();
        return;
      }

      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      // Cut / Copy / Paste Global overrides
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'c') {
          handleCopy();
        } else if (e.key === 'x') {
          handleCut();
        } else if (e.key === 'v') {
          handlePaste();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSaveAs, handleUndo, handleRedo]);

  // Build tabs array
  const tabs = openFiles
    .filter(f => visibleTabs.has(f.path))
    .map(f => ({
      name: f.path.split(/[\\/]/).pop() || 'Untitled',
      path: f.path
    }));

  return (
    <div className="app-container">
      <div className="app-body">
        {sidebarVisible && (
          <Sidebar
            openFolders={openFolders}
            recentFolders={recentFolders}
            onNavigate={(path) => {
              setOpenFolders(prev => prev.includes(path) ? prev : [path, ...prev]);
            }}
            onOpenFile={handleOpenFile}
            onOpenFolderDialog={async () => {
              const path = await openFolderDialog();
              if (path) setOpenFolders(prev => prev.includes(path) ? prev : [path, ...prev]);
            }}
            onCloseFolder={(path) => setOpenFolders(prev => prev.filter(p => p !== path))}
            onRemoveRecent={removeRecentFolder}
          />
        )}
        <div className="main-content">
          <TabBar
            tabs={tabs}
            activeTab={activeFileId || undefined}
            onSelectTab={(path) => setActiveFileId(path)}
            onCloseTab={handleCloseTab}
            modifiedFiles={modifiedFiles}
          />

          {loading ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)'
            }}>
              Loading...
            </div>
          ) : openFiles.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              gap: 16
            }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>🧬</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>ORFView</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Open a folder or file to get started
              </div>
              <button
                onClick={async () => {
                  const path = await openFolderDialog();
                  if (path) {
                    setOpenFolders(prev => prev.includes(path) ? prev : [path, ...prev]);
                  }
                }}
                style={{
                  marginTop: 8,
                  backgroundColor: '#007acc',
                  color: 'white',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: 4,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Open Folder
              </button>
            </div>
          ) : (
            openFiles.map(file => {
              const isActive = file.path === activeFileId;
              const fileName = file.path.split(/[\\/]/).pop() || 'Untitled';

              // Per-file data preparation
              const { sequence, annotations } = getSequenceData(file);
              const viewState = getFileViewState(file.path);

              // Per-file alignable sequences calculation
              // We need to calculate this per file based on its alignment pool
              const poolIds = alignmentPool[file.path] || [];
              const fileAlignableSequences: AlignableSequence[] = [];
              if (poolIds.length > 0) {
                for (const f of openFiles) {
                  const baseName = f.path.split(/[\\/]/).pop() || 'Unknown';
                  if (f.type === 'ab1') {
                    if (poolIds.includes(f.path)) {
                      fileAlignableSequences.push({
                        id: f.path,
                        name: baseName.replace(/\.(ab1|abi)$/i, ''),
                        sequence: f.data.sequence,
                        chromatogramData: f.data,
                        metadata: { bases: f.data.sequence.length, filePath: f.path, date: new Date().toLocaleDateString() }
                      });
                    }
                  } else if (f.type === 'fasta') {
                    f.data.forEach((seq, idx) => {
                      const seqId = `${f.path}#${idx}`;
                      if (poolIds.includes(seqId)) {
                        fileAlignableSequences.push({
                          id: seqId,
                          name: seq.id || `${baseName} seq ${idx + 1}`,
                          sequence: seq.sequence,
                          metadata: { bases: seq.sequence.length, filePath: f.path }
                        });
                      }
                    });
                  } else if (f.type === 'genbank') {
                    if (poolIds.includes(f.path)) {
                      fileAlignableSequences.push({
                        id: f.path,
                        name: f.data.locus || baseName.replace(/\.(gb|gbk)$/i, ''),
                        sequence: f.data.sequence, // Just the sequence, no features
                        metadata: { bases: f.data.sequence.length, filePath: f.path }
                      });
                    }
                  }
                }
              }

              return (
                <div
                  key={file.path}
                  style={{
                    display: isActive ? 'flex' : 'none',
                    flex: 1,
                    flexDirection: 'column',
                    overflow: 'hidden',
                    height: '100%'
                  }}
                >
                  {file.type === 'ab1' ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                      <div style={{ padding: '16px 16px 0 16px', flexShrink: 0 }}>
                        <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>
                          {fileName}
                        </h2>
                        <p style={{ margin: '4px 0 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {file.data.sequence.length} bp | Sample: {file.data.sampleName || 'Unknown'}
                        </p>
                      </div>
                      <div style={{ flex: 1, padding: '0 16px 16px 16px', minHeight: 0 }}>
                        <ChromatogramViewer data={file.data} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      {/* Header for GenBank/FASTA */}
                      {(file.type === 'genbank' || file.type === 'fasta') && (
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                          <h2 style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>
                            {file.type === 'genbank' ? (file.data.locus || fileName) : (file.data[0]?.id || fileName)}
                          </h2>
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>
                            {file.type === 'genbank'
                              ? `${file.data.length} bp | ${file.data.topology} | ${file.data.features.length} features`
                              : `${file.data[0]?.sequence.length} bp | FASTA | ${file.data.length} sequence(s)`}
                          </p>
                        </div>
                      )}

                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <MainPanel
                          fileName={fileName}
                          sequence={sequence}
                          annotations={annotations}
                          alignableSequences={fileAlignableSequences}
                          onOpenFile={handleOpenFile}
                          onAddToAlignment={handleAddToAlignment}
                          onRemoveFromAlignment={handleRemoveFromAlignment}
                          fileType={file.type}
                          file={file}
                          viewState={viewState}
                          updateViewState={updateFileViewState}
                          onUpdateSequence={updateFileContent}
                          // File Operations
                          onSave={handleSave}
                          onSaveAs={handleSaveAs}
                          onCut={handleCut}
                          onCopy={handleCopy}
                          onPaste={handlePaste}
                          onUndo={handleUndo}
                          onRedo={handleRedo}
                          canUndo={canUndo}
                          canRedo={canRedo}

                          viewMode={viewState.viewMode}
                          onViewModeChange={(mode) => updateFileViewState(file.path, { viewMode: mode })}

                          selectedAlignmentIds={viewState.selectedAlignmentIds}
                          onSelectionChange={(ids) => updateFileViewState(file.path, { selectedAlignmentIds: ids })}

                          showMap={viewState.showMap}
                          onShowMapChange={(show) => updateFileViewState(file.path, { showMap: show })}

                          showSequence={viewState.showSequence}
                          onShowSequenceChange={(show) => updateFileViewState(file.path, { showSequence: show })}

                          showEnzymes={viewState.showEnzymes}
                          onShowEnzymesChange={(show) => updateFileViewState(file.path, { showEnzymes: show })}

                          showORFs={viewState.showORFs}
                          onShowORFsChange={(show) => updateFileViewState(file.path, { showORFs: show })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      <StatusBar onOpenSettings={() => handleOpenFile('settings.json')} />
    </div >
  );
}

export default App;
