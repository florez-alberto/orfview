/**
 * Drag State Manager
 * 
 * Simple module-level state to track dragged file paths.
 * Used because Tauri's webview doesn't support dataTransfer.getData reliably.
 */

let draggedFilePath: string | null = null;

export function setDraggedFile(path: string | null) {
    draggedFilePath = path;
}

export function getDraggedFile(): string | null {
    return draggedFilePath;
}

export function clearDraggedFile() {
    draggedFilePath = null;
}
