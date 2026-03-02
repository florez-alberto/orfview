import { useState, useEffect, useRef, useCallback } from 'react';

interface UseColumnResizeOptions {
    initialSidebarWidth?: number;
    minSidebarWidth?: number;
    initialHeaderHeight?: number;
    minHeaderHeight?: number;
}

export function useColumnResize(options: UseColumnResizeOptions = {}) {
    const {
        initialSidebarWidth = 200,
        minSidebarWidth = 150,
        initialHeaderHeight = 160,
        minHeaderHeight = 100
    } = options;

    const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
    const [headerHeight, setHeaderHeight] = useState<number | null>(null);

    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const [isResizingHeader, setIsResizingHeader] = useState(false);

    const headerRef = useRef<HTMLDivElement>(null);

    // Sidebar Resize Effect
    useEffect(() => {
        if (!isResizingSidebar) return;

        const handleMouseMove = (e: MouseEvent) => {
            setSidebarWidth(prev => Math.max(minSidebarWidth, prev + e.movementX));
        };

        const handleMouseUp = () => {
            setIsResizingSidebar(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingSidebar, minSidebarWidth]);

    // Header Resize Effect
    useEffect(() => {
        if (!isResizingHeader) return;

        const handleMouseMove = (e: MouseEvent) => {
            setHeaderHeight(prev => {
                const current = prev || (headerRef.current?.offsetHeight || initialHeaderHeight);
                return Math.max(minHeaderHeight, current + e.movementY);
            });
        };

        const handleMouseUp = () => {
            setIsResizingHeader(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingHeader, initialHeaderHeight, minHeaderHeight]);

    const startSidebarResize = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizingSidebar(true);
    }, []);

    const startHeaderResize = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Initialize header height if null
        if (headerHeight === null && headerRef.current) {
            setHeaderHeight(headerRef.current.offsetHeight);
        }
        setIsResizingHeader(true);
    }, [headerHeight]);

    return {
        sidebarWidth,
        headerHeight,
        setHeaderHeight,
        isResizingSidebar,
        isResizingHeader,
        headerRef,
        startSidebarResize,
        startHeaderResize
    };
}
