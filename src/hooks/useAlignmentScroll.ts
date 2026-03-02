import { useState, useRef, useEffect, useCallback } from 'react';

interface UseAlignmentScrollProps {
    zoom: number;
    sidebarWidth: number;
}

export function useAlignmentScroll({ zoom, sidebarWidth }: UseAlignmentScrollProps) {
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 500 });
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const requestIdRef = useRef<number | null>(null);

    const updateVisibleRange = useCallback(() => {
        if (!scrollContainerRef.current) return;
        const target = scrollContainerRef.current;
        const scrollLeft = target.scrollLeft;
        const width = target.clientWidth;

        const startIdx = Math.max(0, Math.floor((scrollLeft - sidebarWidth) / zoom) - 10);
        const endIdx = Math.ceil((scrollLeft - sidebarWidth + width) / zoom) + 10;

        setVisibleRange(prev => {
            const threshold = 10;
            if (Math.abs(prev.start - startIdx) > threshold || Math.abs(prev.end - endIdx) > threshold) {
                return { start: startIdx, end: endIdx };
            }
            return prev;
        });
    }, [zoom, sidebarWidth]);

    // Initial size calculation + React to Zoom/Resize
    useEffect(() => {
        updateVisibleRange();
        window.addEventListener('resize', updateVisibleRange);

        const observer = new ResizeObserver(() => {
            updateVisibleRange();
        });
        if (scrollContainerRef.current) {
            observer.observe(scrollContainerRef.current);
        }

        return () => {
            window.removeEventListener('resize', updateVisibleRange);
            observer.disconnect();
        };
    }, [updateVisibleRange]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const scrollLeft = target.scrollLeft;
        const width = target.clientWidth;

        if (requestIdRef.current) return;

        requestIdRef.current = requestAnimationFrame(() => {
            const startIdx = Math.max(0, Math.floor((scrollLeft - sidebarWidth) / zoom) - 10);
            const endIdx = Math.ceil((scrollLeft - sidebarWidth + width) / zoom) + 10;

            setVisibleRange(prev => {
                const threshold = 10;
                if (Math.abs(prev.start - startIdx) > threshold || Math.abs(prev.end - endIdx) > threshold) {
                    return { start: startIdx, end: endIdx };
                }
                return prev;
            });
            requestIdRef.current = null;
        });
    };

    return {
        visibleRange,
        scrollContainerRef,
        handleScroll,
        updateVisibleRange
    };
}
