import { vi } from 'vitest';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

// Mock DataTransfer for drag and drop tests
if (typeof DataTransfer === 'undefined') {
    global.DataTransfer = class DataTransfer {
        items = {
            add: () => { },
        } as unknown as DataTransferItemList;
        files = {
            item: () => null,
            length: 0,
        } as unknown as FileList;
        types = [];
        clearData = () => { };
        getData = () => '';
        setData = () => { };
        setDragImage = () => { };
        dropEffect: "none" | "copy" | "link" | "move" = 'none';
        effectAllowed: "none" | "copy" | "copyLink" | "copyMove" | "link" | "linkMove" | "move" | "all" | "uninitialized" = 'none';
    };
}
