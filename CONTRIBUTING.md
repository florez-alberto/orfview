# Contributing to ORFView

This guide explains how to extend ORFView with custom functionality, add new file format support, or contribute to the codebase.

---

## Table of Contents

1. [Extension Development](#extension-development)
2. [Extension API Reference](#extension-api-reference)
3. [Core Contributions](#core-contributions)
   - [Adding File Format Parsers](#adding-file-format-parsers)
   - [Codebase Architecture](#codebase-architecture)
   - [Development Workflow](#development-workflow)

---

## Extension Development

ORFView's extension system is exposed via the global `window.orfview` object. Extensions are JavaScript files that can:

- Customise the application theme
- Register cleanup handlers for proper lifecycle management
- (Future) Add custom menu items, toolbar buttons, or file handlers

### Extension Skeleton

```javascript
// extension-template.js
(function() {
  'use strict';
  
  const EXTENSION_ID = 'my-extension-name';
  
  // ============================================
  // 1. INITIALISATION
  // ============================================
  
  console.log(`[${EXTENSION_ID}] Loading...`);
  
  // Ensure orfview API is available
  if (!window.orfview) {
    console.error(`[${EXTENSION_ID}] orfview API not found!`);
    return;
  }
  
  // ============================================
  // 2. YOUR EXTENSION LOGIC
  // ============================================
  
  // Example: Apply a custom theme
  window.orfview.theme.setColors({
    '--bg-sidebar': '#1e1e2e',
    '--bg-activity-bar': '#181825',
    '--bg-status-bar': '#89b4fa',
    '--accent-color': '#cba6f7',
    '--selection-bg': '#313244'
  });
  
  // Example: Listen for file opens
  const unsubscribeFiles = window.orfview.files.onFileOpened((file) => {
    // window.orfview.dialogs.showMessage(`File opened: ${file.path}`);
    console.log(`[${EXTENSION_ID}] File opened: ${file.path}`);
  });

  // Example: Get current sequence
  const currentSeq = window.orfview.editor.getSequence();
  if (currentSeq) {
    console.log(`[${EXTENSION_ID}] Current sequence length: ${currentSeq.length}`);
  }
  
  // ============================================
  // 3. CLEANUP FUNCTION
  // ============================================
  
  function cleanup() {
    console.log(`[${EXTENSION_ID}] Cleaning up...`);
    
    // Reset theme to defaults
    window.orfview.theme.resetColors();
    
    // Unsubscribe from file events
    unsubscribeFiles();
    
    console.log(`[${EXTENSION_ID}] Cleanup complete.`);
  }
  
  // ============================================
  // 4. REGISTER EXTENSION
  // ============================================
  
  window.orfview.register(EXTENSION_ID, cleanup);
  console.log(`[${EXTENSION_ID}] Loaded successfully.`);
  
})();
```

### Loading Your Extension

**Option 1: DevTools Console (Testing)**
```javascript
// Paste your extension code directly in the browser console
(function() { /* ... */ })();
```

**Option 2: Script Injection (Production)**
```html
<!-- Add to index.html before closing </body> -->
<script src="extensions/my-extension.js"></script>
```

**Option 3: Dynamic Loading**
```javascript
const script = document.createElement('script');
script.src = 'path/to/my-extension.js';
document.body.appendChild(script);
```

### Uninstalling Extensions

```javascript
// From devtools or another script
window.orfview.uninstall('my-extension-name');
```

---

## Extension API Reference

### `window.orfview`

The global extension API object.

#### `register(id: string, cleanup: () => void): void`

Register an extension with a unique identifier and cleanup function.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Unique extension identifier |
| `cleanup` | `() => void` | Function called when extension is uninstalled |

**Example:**
```javascript
window.orfview.register('my-ext', () => {
  // Cleanup code here
});
```

#### `uninstall(id: string): void`

Uninstall a previously registered extension, calling its cleanup function.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Extension ID to uninstall |

**Example:**
```javascript
window.orfview.uninstall('my-ext');
```

---

### `window.orfview.theme`

Theme customisation API.

#### `setColors(colors: Record<string, string>): void`

Apply custom CSS variable values to the document root.

| Parameter | Type | Description |
|-----------|------|-------------|
| `colors` | `Record<string, string>` | CSS variable name → value mapping |

**Available CSS Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `--bg-sidebar` | `#252526` | Sidebar background |
| `--bg-activity-bar` | `#333333` | Activity bar background |
| `--bg-status-bar` | `#007acc` | Status bar background |
| `--accent-color` | `#007acc` | Primary accent color |
| `--selection-bg` | `#37373d` | Selection highlight |
| `--bg-primary` | `#1e1e1e` | Main content background |
| `--bg-secondary` | `#252526` | Secondary surfaces |
| `--text-primary` | `#e0e0e0` | Primary text color |
| `--text-secondary` | `#909090` | Secondary/muted text |
| `--border-color` | `#3c3c3c` | Border color |

**Example:**
```javascript
window.orfview.theme.setColors({
  '--bg-primary': '#0d1117',
  '--accent-color': '#58a6ff',
  '--text-primary': '#c9d1d9'
});
```

#### `resetColors(): void`

Reset all theme colors to their default values.

**Example:**
```javascript
window.orfview.theme.resetColors();
```

---

---

---

### `window.orfview.dialogs`

Interaction with system dialogs.

#### `showMessage(message: string): void`
Shows a simple alert dialog.

#### `showError(message: string): void`
Shows an error alert dialog.

#### `confirm(message: string): Promise<boolean>`
Shows a confirmation dialog. Returns a promise resolving to `true` (OK) or `false` (Cancel).

---

### `window.orfview.files`

File system events and access.

#### `getActiveFile()`

Returns the currently active file object, including path and type-specific data (content, sequence, etc.).

**Returns:** `{ type, path, content?, data? } | null`

#### `onFileOpened(callback: (file: { path: string }) => void): UnsubscribeFunction`

Subscribe to file open events. Returns a function to unsubscribe.

#### `onFileSaved(callback: (file: { path: string }) => void): UnsubscribeFunction`

Subscribe to file save events. Returns a function to unsubscribe.

---

### `window.orfview.editor`

Interaction with the active editor/viewer.

#### `getSequence(): string | null`

Returns the raw sequence string of the active file (if applicable).

#### `setSequence(sequence: string): boolean`

Updates the sequence content of the active file. Returns `true` if successful.

---

## Core Contributions

This section covers contributing to the core Rust backend and React frontend.

### Adding File Format Parsers

To add support for a new file format, create a parser in `src/lib/parsers/`.

### Parser Interface

Every parser should export:

1. **Data Interface**: TypeScript interface for the parsed data
2. **Parse Function**: Synchronous function for text formats, or async for binary
3. **Load Function (optional)**: Async wrapper that reads from file system

### Example: Adding SnapGene (.dna) Parser

```typescript
// src/lib/parsers/snapgeneParser.ts

import { invoke } from "@tauri-apps/api/core";

// 1. Define data interface
export interface SnapGeneData {
  sequence: string;
  topology: 'linear' | 'circular';
  features: Array<{
    type: string;
    name: string;
    start: number;
    end: number;
    strand: 1 | -1;
  }>;
  // ... more fields
}

// 2. Parse function (binary format)
export function parseSnapGene(buffer: ArrayBuffer): SnapGeneData {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  // Verify magic bytes
  if (bytes[0] !== 0x09 || bytes[1] !== 0x00) {
    throw new Error('Invalid SnapGene file');
  }
  
  // Parse header, segments, etc.
  // ... implementation details ...
  
  return {
    sequence: '...',
    topology: 'circular',
    features: []
  };
}

// 3. Load function (file system wrapper)
export async function loadSnapGeneFile(path: string): Promise<SnapGeneData> {
  const bytes = await invoke<number[]>("read_binary_file", { path });
  const buffer = new Uint8Array(bytes).buffer;
  return parseSnapGene(buffer);
}
```

### Registering the Parser

Update `src/App.tsx` to handle the new format:

```typescript
// In handleOpenFile function
const ext = path.toLowerCase().split('.').pop();

// Add new format case
if (ext === 'dna') {
  const data = await loadSnapGeneFile(path);
  newFile = { type: 'snapgene', path, data };
}
```

And update the `ActiveFile` type:

```typescript
type ActiveFile =
  | { type: 'text'; path: string; content: string }
  | { type: 'ab1'; path: string; data: AB1Data }
  | { type: 'genbank'; path: string; data: GenBankData }
  | { type: 'fasta'; path: string; data: FastaSequence[] }
  | { type: 'snapgene'; path: string; data: SnapGeneData };  // NEW
```

---

## Codebase Architecture

### Data Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   File System   │───▶│   Rust Backend   │───▶│  React Frontend │
│  (.gb, .ab1)    │    │   (Tauri IPC)    │    │   (Parsing &    │
└─────────────────┘    └──────────────────┘    │    Rendering)   │
                                               └─────────────────┘
```

1. **User opens a file** via sidebar or drag-drop
2. **Rust backend** reads raw bytes/text from disk
3. **Frontend parsers** decode the format into typed objects
4. **React components** render the data

### State Management

All state lives in `App.tsx`:

| State | Type | Purpose |
|-------|------|---------|
| `openFiles` | `ActiveFile[]` | All loaded file data |
| `activeFileId` | `string \| null` | Currently displayed file |
| `visibleTabs` | `Set<string>` | Files shown in tab bar |
| `alignmentPool` | `Record<string, string[]>` | Per-reference alignment sequences |
| `fileViewStates` | `Record<string, FileViewState>` | Per-file UI state |

### Component Hierarchy

```
App
├── Sidebar (folder tree, recent files)
├── MainContent
│   ├── TabBar
│   ├── MainPanel
│   │   ├── Toolbar (view toggles, actions)
│   │   ├── SequenceViewer (circular map via seqviz)
│   │   ├── LinearSequenceView (linear editing view)
│   │   └── AlignmentView (multi-sequence alignment)
│   └── ChromatogramViewer (AB1 traces)
└── StatusBar
```

---

## Development Workflow

### Setup

```bash
# Clone and install
git clone https://github.com/florez-alberto/orfview.git
cd orfview
npm install

# Start development server
npm run tauri dev
```

### Code Style

- **TypeScript**: Strict mode enabled
- **React**: Functional components with hooks
- **CSS**: Vanilla CSS with CSS variables (in `src/index.css`)

### Testing Changes

1. Make changes to source files
2. Vite hot-reloads the frontend automatically
3. Rust changes require restarting `tauri dev`

### Building for Production

```bash
npm run tauri build
```

Output binaries are in `src-tauri/target/release/bundle/`.

---

## Future Extension Points

The following APIs are planned but not yet implemented:

| Feature | Status | Description |
|---------|--------|-------------|
| `orfview.menu.addItem` | Planned | Add custom menu items |
| `orfview.toolbar.addButton` | Planned | Add custom toolbar buttons |
| `orfview.parsers.register` | Planned | Register custom file format handlers |
| `orfview.alignment.onAlign` | Planned | Hook into alignment computation |

If you're interested in implementing any of these, please open an issue for discussion.

---

## Questions?

Open an issue on GitHub or reach out to the maintainers.
