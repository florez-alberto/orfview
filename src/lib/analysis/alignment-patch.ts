import { AlignmentResult, AlignmentPosition } from './alignment';

/**
 * Patch an existing alignment result with a manual edit.
 * 
 * This treats the alignment as a "Text Editor" would:
 * - Insertions shift the query sequence to the right.
 * - Deletions shift the query sequence to the left.
 * - Reference sequence remains anchored.
 * 
 * This is a "dumb" patch that does not run the alignment algorithm.
 * Ideally, the user should click "Realign" after making edits.
 */
export function patchAlignment(
    currentResult: AlignmentResult,
    change: { type: 'insert' | 'delete' | 'replace', queryIndex: number, newBase?: string }
): AlignmentResult {
    // We reconstruct the aligned strings first
    let { alignedReference, alignedQuery } = currentResult;

    // Find the position in the aligned strings that corresponds to the queryIndex
    // We need to allow editing at the very end, so we look for queryIndex or the end
    let alignedPos = -1;

    if (change.queryIndex >= currentResult.queryEnd) {
        // Appending to end
        alignedPos = alignedReference.length;
    } else {
        // Find the visual position of this query index
        // We look for the first occurrence where queryPos matches
        const posInfo = currentResult.positions.find(p => p.queryPos === change.queryIndex);
        if (posInfo) {
            alignedPos = posInfo.alignedPos;
        } else {
            // Should not happen unless index out of bounds
            // Fallback: assume end?
            alignedPos = alignedReference.length;
        }
    }

    // Apply the edit to the aligned strings
    let newAlignedRef = alignedReference;
    let newAlignedQry = alignedQuery;

    // Use "Trivial Tail Re-alignment" approach for everything.
    // Splice point: alignedPos.
    // Head (0 to alignedPos) is preserved.
    const headRef = alignedReference.slice(0, alignedPos);
    const headQry = alignedQuery.slice(0, alignedPos);

    // Tail (alignedPos to end)
    let tailRefRaw = alignedReference.slice(alignedPos).replace(/-/g, '');
    let tailQryRaw = alignedQuery.slice(alignedPos).replace(/-/g, ''); // This is the sequence content downstream

    // Apply edit to Tail Query
    if (change.type === 'insert') {
        tailQryRaw = (change.newBase || '-') + tailQryRaw;
    } else if (change.type === 'delete') {
        if (tailQryRaw.length > 0) {
            tailQryRaw = tailQryRaw.slice(1);
        }
    } else if (change.type === 'replace') {
        if (tailQryRaw.length > 0) {
            tailQryRaw = (change.newBase || '-') + tailQryRaw.slice(1);
        }
    }

    // Trivial Align Tails
    // We just map char-to-char until one runs out, then pad with gaps.
    let newTailRef = '';
    let newTailQry = '';
    const maxLen = Math.max(tailRefRaw.length, tailQryRaw.length);

    for (let i = 0; i < maxLen; i++) {
        newTailRef += (i < tailRefRaw.length) ? tailRefRaw[i] : '-';
        newTailQry += (i < tailQryRaw.length) ? tailQryRaw[i] : '-';
    }

    newAlignedRef = headRef + newTailRef;
    newAlignedQry = headQry + newTailQry;

    // Re-calculate statistics (matches, mismatches, positions)
    const positions: AlignmentPosition[] = [];
    let matches = 0;
    let mismatches = 0;
    let gapsInRef = 0;
    let gapsInQuery = 0;

    // We reconstruct the positions logic
    let refIdx = currentResult.refStart;
    let qryIdx = currentResult.queryStart;

    for (let pos = 0; pos < newAlignedRef.length; pos++) {
        const r = newAlignedRef[pos];
        const q = newAlignedQry[pos];
        let type: AlignmentPosition['type'] = 'mismatch';

        if (r === '-') {
            type = 'gap_ref';
            gapsInRef++;
            positions.push({ alignedPos: pos, refPos: -1, queryPos: qryIdx, refBase: r, queryBase: q, type });
            qryIdx++;
        } else if (q === '-') {
            type = 'gap_query';
            gapsInQuery++;
            positions.push({ alignedPos: pos, refPos: refIdx, queryPos: -1, refBase: r, queryBase: q, type });
            refIdx++;
        } else {
            if (r === q) {
                matches++;
                type = 'match';
            } else {
                mismatches++;
                type = 'mismatch';
            }
            positions.push({ alignedPos: pos, refPos: refIdx, queryPos: qryIdx, refBase: r, queryBase: q, type });
            refIdx++;
            qryIdx++;
        }
    }

    return {
        ...currentResult,
        alignedReference: newAlignedRef,
        alignedQuery: newAlignedQry,
        matches,
        mismatches,
        gapsInRef,
        gapsInQuery,
        positions,
        refEnd: refIdx,
        queryEnd: qryIdx
    };
}
