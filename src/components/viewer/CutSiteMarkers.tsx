import { useEffect, useRef, useCallback } from 'react';

interface EnzymeCutLabelsProps {
    cutSites: Array<{
        enzyme: string;
        position: number;
        strand: number;
        recognitionStart?: number;
        recognitionEnd?: number;
    }>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    sequenceLength: number;
}

export function CutSiteMarkers({ cutSites, containerRef, sequenceLength }: EnzymeCutLabelsProps) {
    const observerRef = useRef<MutationObserver | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const injectLabels = useCallback(() => {
        if (!containerRef.current || cutSites.length === 0) {
            return;
        }

        const container = containerRef.current;

        // Remove existing enzyme labels
        const existingLabels = container.querySelectorAll('.enzyme-cut-label, .enzyme-highlight');
        existingLabels.forEach(el => el.remove());

        // Find the linear scroller
        let linearScroller = container.querySelector('.la-vz-linear-scroller');
        if (!linearScroller) {
            linearScroller = container.querySelector('.la-vz-viewer-linear');
        }

        if (!linearScroller) {
            return;
        }

        const seqBlocks = linearScroller.querySelectorAll('.la-vz-seqblock');
        if (seqBlocks.length === 0) {
            return;
        }

        let totalInjected = 0;

        // Iterate through ACTUAL DOM blocks (handles virtualisation)
        seqBlocks.forEach((block) => {
            const svg = block as SVGSVGElement;

            // Find the complement sequence text element (labels go below this)
            const compSeq = svg.querySelector('.la-vz-comp-seq') as SVGTextElement;
            // Find forward sequence for positioning reference
            const forwardSeq = svg.querySelector('.la-vz-seq') as SVGTextElement;

            if (!forwardSeq) {
                return;
            }

            // Get bp per block from actual text content
            const seqText = forwardSeq.textContent || '';
            const bpPerBlock = seqText.length;
            if (bpPerBlock === 0) {
                return;
            }

            // Get the block's genomic start position from index labels
            const indexLabels = svg.querySelectorAll('text.la-vz-index-line');
            let blockStart = 0;

            if (indexLabels.length > 0) {
                const firstLabel = indexLabels[0] as SVGTextElement;
                const labelText = firstLabel.textContent?.trim() || '';
                blockStart = parseInt(labelText, 10) - 1; // Convert to 0-based
                if (isNaN(blockStart)) {
                    return;
                }
            } else {
                return;
            }

            const blockEnd = blockStart + bpPerBlock;

            // Find cut sites in this block
            const sitesInBlock = cutSites.filter(site =>
                site.position >= blockStart && site.position < blockEnd
            );

            if (sitesInBlock.length === 0) {
                return;
            }

            const svgRect = svg.getBoundingClientRect();
            const forwardRect = forwardSeq.getBoundingClientRect();

            let yBase: number;
            if (compSeq) {
                const compRect = compSeq.getBoundingClientRect();
                yBase = (compRect.bottom - svgRect.top) + 4;
            } else {
                yBase = (forwardRect.bottom - svgRect.top) + 4;
            }

            if (forwardRect.width === 0) {
                return;
            }

            const charWidth = forwardRect.width / bpPerBlock;

            const sortedSites = [...sitesInBlock].sort((a, b) => a.position - b.position);
            let lastX = -100;
            let stackLevel = 0;

            sortedSites.forEach((site) => {
                const posInBlock = site.position - blockStart;
                const xInSvg = (forwardRect.left - svgRect.left) + (posInBlock * charWidth) + (charWidth / 2);

                if (xInSvg - lastX < 50) {
                    stackLevel++;
                } else {
                    stackLevel = 0;
                }
                lastX = xInSvg;

                const labelY = yBase + 10 + (stackLevel * 14);

                const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                group.classList.add('enzyme-cut-label');
                group.setAttribute('data-enzyme', site.enzyme);
                group.setAttribute('data-position', site.position.toString());
                group.style.cursor = 'pointer';

                const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                tickLine.setAttribute('x1', xInSvg.toString());
                tickLine.setAttribute('y1', yBase.toString());
                tickLine.setAttribute('x2', xInSvg.toString());
                tickLine.setAttribute('y2', (labelY - 3).toString());
                tickLine.setAttribute('stroke', '#888');
                tickLine.setAttribute('stroke-width', '1');

                const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                triangle.setAttribute('points',
                    `${xInSvg - 3},${yBase + 4} ${xInSvg + 3},${yBase + 4} ${xInSvg},${yBase}`
                );
                triangle.setAttribute('fill', '#888');

                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', xInSvg.toString());
                text.setAttribute('y', labelY.toString());
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '10');
                text.setAttribute('fill', '#fff');
                text.setAttribute('font-family', 'monospace');
                text.setAttribute('font-weight', 'bold');
                text.textContent = site.enzyme;

                group.appendChild(tickLine);
                group.appendChild(triangle);
                group.appendChild(text);

                // Hover effects
                group.addEventListener('mouseenter', () => {
                    text.setAttribute('fill', '#E91E63');
                    tickLine.setAttribute('stroke', '#E91E63');
                    triangle.setAttribute('fill', '#E91E63');

                    // Highlight recognition site
                    if (site.recognitionStart !== undefined && site.recognitionEnd !== undefined) {
                        highlightRecognitionSite(
                            site.recognitionStart,
                            site.recognitionEnd,
                            seqBlocks
                        );
                    }
                });

                group.addEventListener('mouseleave', () => {
                    text.setAttribute('fill', '#fff');
                    tickLine.setAttribute('stroke', '#888');
                    triangle.setAttribute('fill', '#888');

                    // Remove highlights
                    container.querySelectorAll('.enzyme-highlight').forEach(el => el.remove());
                });

                svg.appendChild(group);
                totalInjected++;
            });
        });

        console.log(`[CutSiteMarkers] Injected ${totalInjected} labels`);
    }, [cutSites, containerRef, sequenceLength]);

    useEffect(() => {
        const timer = setTimeout(injectLabels, 150);

        if (containerRef.current) {
            const scroller = containerRef.current.querySelector('.la-vz-linear-scroller');
            if (scroller) {
                observerRef.current = new MutationObserver(() => {
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(injectLabels, 100);
                });

                observerRef.current.observe(scroller, {
                    childList: true,
                    subtree: true
                });
            }
        }

        return () => {
            clearTimeout(timer);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [injectLabels, containerRef]);

    return null;
}

function highlightRecognitionSite(
    startPos: number,
    endPos: number,
    seqBlocks: NodeListOf<Element>
) {
    seqBlocks.forEach((block) => {
        const svg = block as SVGSVGElement;
        const forwardSeq = svg.querySelector('.la-vz-seq') as SVGTextElement;
        if (!forwardSeq) return;

        const seqText = forwardSeq.textContent || '';
        const bpPerBlock = seqText.length;
        if (bpPerBlock === 0) return;

        // Get block's genomic start from index labels
        const indexLabels = svg.querySelectorAll('text.la-vz-index-line');
        let blockStart = 0;

        if (indexLabels.length > 0) {
            const firstLabel = indexLabels[0] as SVGTextElement;
            const labelText = firstLabel.textContent?.trim() || '';
            blockStart = parseInt(labelText, 10) - 1;
            if (isNaN(blockStart)) return;
        } else {
            return;
        }

        const blockEnd = blockStart + bpPerBlock;

        if (endPos < blockStart || startPos >= blockEnd) {
            return;
        }

        const svgRect = svg.getBoundingClientRect();
        const forwardRect = forwardSeq.getBoundingClientRect();
        const charWidth = forwardRect.width / bpPerBlock;

        const highlightStart = Math.max(0, startPos - blockStart);
        const highlightEnd = Math.min(bpPerBlock - 1, endPos - blockStart);

        if (highlightEnd < 0 || highlightStart >= bpPerBlock) return;

        const xStart = (forwardRect.left - svgRect.left) + (highlightStart * charWidth);
        const width = (highlightEnd - highlightStart + 1) * charWidth;
        const yForward = forwardRect.top - svgRect.top;
        const height = forwardRect.height;

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.classList.add('enzyme-highlight');
        rect.setAttribute('x', xStart.toString());
        rect.setAttribute('y', yForward.toString());
        rect.setAttribute('width', width.toString());
        rect.setAttribute('height', height.toString());
        rect.setAttribute('fill', '#E91E63');
        rect.setAttribute('fill-opacity', '0.3');
        rect.style.pointerEvents = 'none';
        svg.appendChild(rect);

        const compSeq = svg.querySelector('.la-vz-comp-seq') as SVGTextElement;
        if (compSeq) {
            const compRect = compSeq.getBoundingClientRect();
            const yComp = compRect.top - svgRect.top;

            const rect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect2.classList.add('enzyme-highlight');
            rect2.setAttribute('x', xStart.toString());
            rect2.setAttribute('y', yComp.toString());
            rect2.setAttribute('width', width.toString());
            rect2.setAttribute('height', compRect.height.toString());
            rect2.setAttribute('fill', '#E91E63');
            rect2.setAttribute('fill-opacity', '0.3');
            rect2.style.pointerEvents = 'none';
            svg.appendChild(rect2);
        }
    });
}
