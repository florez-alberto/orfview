/**
 * @vitest-environment happy-dom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useExtensionSystem, ExtensionContext } from './useExtensionSystem';

// Extend the Window interface for TypeScript (already done in vite-env.d.ts but good for isolation if needed)
// We rely on the global definition now.

describe('useExtensionSystem', () => {
    // Mock Context
    const mockContext: ExtensionContext = {
        activeFileId: 'file1.fasta',
        openFiles: [
            {
                type: 'fasta',
                path: 'file1.fasta',
                data: [{ id: 'seq1', sequence: 'ATGC', description: '' }]
            },
            { type: 'text', path: 'notes.txt', content: 'Hello World' }
        ],
        onOpenFile: vi.fn(),
        onUpdateSequence: vi.fn(),
    };

    // Clean up window.orfview after each test to ensure isolation
    afterEach(() => {
        // @ts-ignore
        delete window.orfview;
        vi.restoreAllMocks();
    });

    // Setup global mocks for happy-dom if missing
    if (!window.alert) window.alert = vi.fn();
    if (!window.confirm) window.confirm = vi.fn();

    it('1. API Injection: Attach window.orfview global', () => {
        renderHook(() => useExtensionSystem(mockContext));
        expect(window.orfview).toBeDefined();
        expect(window.orfview.register).toBeInstanceOf(Function);
        expect(window.orfview.uninstall).toBeInstanceOf(Function);
        expect(window.orfview.theme).toBeDefined();
        expect(window.orfview.dialogs).toBeDefined();
        expect(window.orfview.files).toBeDefined();
        expect(window.orfview.editor).toBeDefined();
    });

    it('2. Registration Flow: Register and track extensions', () => {
        const { result } = renderHook(() => useExtensionSystem(mockContext));

        const mockCleanup = vi.fn();

        act(() => {
            window.orfview.register('test-ext', mockCleanup);
        });

        // Verify state update
        expect(result.current.activeExtensions).toContain('test-ext');

        // Check cleanup hasn't been called yet
        expect(mockCleanup).not.toHaveBeenCalled();
    });

    it('3. Cleanup Security: Call cleanup on uninstall', () => {
        renderHook(() => useExtensionSystem(mockContext));

        const mockCleanup = vi.fn();
        const extId = 'security-test-ext';

        act(() => {
            window.orfview.register(extId, mockCleanup);
        });

        act(() => {
            window.orfview.uninstall(extId);
        });

        expect(mockCleanup).toHaveBeenCalledTimes(1);
    });

    it('4. Red Team: Duplicate ID Registration', () => {
        const { result } = renderHook(() => useExtensionSystem(mockContext));
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const id = 'duplicate-ext';
        const cleanup1 = vi.fn();
        const cleanup2 = vi.fn();

        act(() => {
            window.orfview.register(id, cleanup1);
        });

        act(() => {
            window.orfview.register(id, cleanup2);
        });

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));

        expect(result.current.activeExtensions.filter(e => e === id).length).toBe(1);

        act(() => {
            window.orfview.uninstall(id);
        });

        expect(cleanup1).not.toHaveBeenCalled();
        expect(cleanup2).toHaveBeenCalled();
    });

    it('4. Red Team: Toxic Cleanup', () => {
        const { result } = renderHook(() => useExtensionSystem(mockContext));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        const id = 'toxic-ext';
        const toxicCleanup = () => {
            throw new Error("I am a virus!");
        };

        act(() => {
            window.orfview.register(id, toxicCleanup);
        });

        expect(() => {
            act(() => {
                window.orfview.uninstall(id);
            });
        }).not.toThrow();

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error uninstalling'), expect.anything());
        expect(result.current.activeExtensions).not.toContain(id);
    });

    it('5. Theming: Apply CSS variables', () => {
        renderHook(() => useExtensionSystem(mockContext));

        const spy = vi.spyOn(document.documentElement.style, 'setProperty');

        act(() => {
            window.orfview.theme.setColors({
                '--test-color': '#ff0000',
                'bg-color': '#000000'
            });
        });

        expect(spy).toHaveBeenCalledWith('--test-color', '#ff0000');
        expect(spy).toHaveBeenCalledWith('bg-color', '#000000');
    });

    it('6. Editor API: Get and Set Sequence', () => {
        renderHook(() => useExtensionSystem(mockContext));

        const seq = window.orfview.editor.getSequence();
        expect(seq).toBe('ATGC');

        act(() => {
            window.orfview.editor.setSequence('GCTA');
        });

        expect(mockContext.onUpdateSequence).toHaveBeenCalledWith('file1.fasta', 'GCTA');
    });

    it('7. Files API: Get Active File', () => {
        renderHook(() => useExtensionSystem(mockContext));

        const file = window.orfview.files.getActiveFile();
        expect(file).toBeDefined();
        expect(file?.path).toBe('file1.fasta');
        expect(file?.type).toBe('fasta');
    });

    it('8. Dialogs API: Show Message', () => {
        renderHook(() => useExtensionSystem(mockContext));
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });

        act(() => {
            window.orfview.dialogs.showMessage('Hello');
        });

        expect(alertSpy).toHaveBeenCalledWith('Hello');
    });

    it('9. Dialogs API: Show Error', () => {
        renderHook(() => useExtensionSystem(mockContext));
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });

        act(() => {
            window.orfview.dialogs.showError('Fatal Error');
        });

        expect(alertSpy).toHaveBeenCalledWith('Error: Fatal Error');
    });

    it('10. Dialogs API: Confirm', async () => {
        renderHook(() => useExtensionSystem(mockContext));
        const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

        let result;
        await act(async () => {
            result = await window.orfview.dialogs.confirm('Are you sure?');
        });

        expect(confirmSpy).toHaveBeenCalledWith('Are you sure?');
        expect(result).toBe(true);
    });

    it('11. Files API: File Opened Event', () => {
        renderHook(() => useExtensionSystem(mockContext));
        const callback = vi.fn();

        // Subscribe
        const unsubscribe = window.orfview.files.onFileOpened(callback);

        // Dispatch Event
        act(() => {
            window.dispatchEvent(new CustomEvent('orfview:file-opened', { detail: { path: '/path/to/newfile.gb' } }));
        });

        expect(callback).toHaveBeenCalledWith({ path: '/path/to/newfile.gb' });

        // Unsubscribe
        unsubscribe();

        // Dispatch again
        act(() => {
            window.dispatchEvent(new CustomEvent('orfview:file-opened', { detail: { path: '/path/to/another.gb' } }));
        });

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('12. Files API: File Saved Event', () => {
        renderHook(() => useExtensionSystem(mockContext));
        const callback = vi.fn();

        // Subscribe
        const unsubscribe = window.orfview.files.onFileSaved(callback);

        // Dispatch Event
        act(() => {
            window.dispatchEvent(new CustomEvent('orfview:file-saved', { detail: { path: '/saved/file.fasta' } }));
        });

        expect(callback).toHaveBeenCalledWith({ path: '/saved/file.fasta' });

        unsubscribe();
    });
});
