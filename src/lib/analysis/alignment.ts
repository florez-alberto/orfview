/**
 * Sequence Alignment Module
 * 
 * Implements Needleman-Wunsch global alignment algorithm for DNA sequences.
 * Modularized for testability and clarity.
 */

import { getReverseComplement as reverseComplement } from '../utils/dnaUtils';

export interface AlignmentResult {
    /** Aligned reference sequence (with gaps as '-') */
    alignedReference: string;
    /** Aligned query sequence (with gaps as '-') */
    alignedQuery: string;
    /** Alignment score */
    score: number;
    /** Start position in reference (0-based) */
    refStart: number;
    /** End position in reference (0-based, exclusive) */
    refEnd: number;
    /** Start position in query (0-based) */
    queryStart: number;
    /** End position in query (0-based, exclusive) */
    queryEnd: number;
    /** Number of matching bases */
    matches: number;
    /** Number of mismatches */
    mismatches: number;
    /** Number of gaps in reference */
    gapsInRef: number;
    /** Number of gaps in query */
    gapsInQuery: number;
    /** Per-position alignment info */
    positions: AlignmentPosition[];
    /** Whether the query was reverse complemented for alignment */
    isReverseComplement: boolean;
}

export interface AlignmentPosition {
    /** Position in aligned sequence (0-based) */
    alignedPos: number;
    /** Position in reference (-1 if gap) */
    refPos: number;
    /** Position in query (-1 if gap) */
    queryPos: number;
    /** Reference base (or '-' for gap) */
    refBase: string;
    /** Query base (or '-' for gap) */
    queryBase: string;
    /** Type of alignment at this position */
    type: 'match' | 'mismatch' | 'gap_ref' | 'gap_query';
}

// Scoring parameters
export const SCORING = {
    MATCH: 2,
    MISMATCH: -1,
    GAP_OPEN: -2,
    GAP_EXTEND: -1
};

/**
 * Initialize a scoring matrix of size (m+1) x (n+1) with zeros.
 */
export function initializeMatrix(rows: number, cols: number): number[][] {
    return Array(rows + 1).fill(null).map(() => Array(cols + 1).fill(0));
}

/**
 * Initialize boundaries for Global Alignment (Needleman-Wunsch).
 */
export function initGlobalBoundaries(score: number[][], m: number, n: number): void {
    for (let i = 0; i <= m; i++) {
        score[i][0] = i === 0 ? 0 : SCORING.GAP_OPEN + (i - 1) * SCORING.GAP_EXTEND;
    }
    for (let j = 0; j <= n; j++) {
        score[0][j] = j === 0 ? 0 : SCORING.GAP_OPEN + (j - 1) * SCORING.GAP_EXTEND;
    }
}

/**
 * Fill scoring matrix for Global Alignment.
 */
export function fillGlobalScoreMatrix(score: number[][], ref: string, qry: string): void {
    const m = ref.length;
    const n = qry.length;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const match = score[i - 1][j - 1] + (ref[i - 1] === qry[j - 1] ? SCORING.MATCH : SCORING.MISMATCH);
            const deleteGap = score[i - 1][j] + SCORING.GAP_EXTEND;
            const insertGap = score[i][j - 1] + SCORING.GAP_EXTEND;
            score[i][j] = Math.max(match, deleteGap, insertGap);
        }
    }
}

/**
 * Fill scoring matrix for Local Alignment (Smith-Waterman).
 * Returns the position and value of the maximum score.
 */
export function fillLocalScoreMatrix(score: number[][], ref: string, qry: string): { maxScore: number, maxI: number, maxJ: number } {
    const m = ref.length;
    const n = qry.length;
    let maxScore = 0;
    let maxI = 0;
    let maxJ = 0;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const match = score[i - 1][j - 1] + (ref[i - 1] === qry[j - 1] ? SCORING.MATCH : SCORING.MISMATCH);
            const deleteGap = score[i - 1][j] + SCORING.GAP_EXTEND;
            const insertGap = score[i][j - 1] + SCORING.GAP_EXTEND;
            score[i][j] = Math.max(0, match, deleteGap, insertGap);

            if (score[i][j] > maxScore) {
                maxScore = score[i][j];
                maxI = i;
                maxJ = j;
            }
        }
    }
    return { maxScore, maxI, maxJ };
}

/**
 * Perform traceback for Global Alignment.
 */
export function tracebackGlobal(score: number[][], ref: string, qry: string): { alignedRef: string, alignedQry: string } {
    let alignedRef = '';
    let alignedQry = '';
    let i = ref.length;
    let j = qry.length;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0) {
            const currentScore = score[i][j];
            const matchScore = ref[i - 1] === qry[j - 1] ? SCORING.MATCH : SCORING.MISMATCH;

            if (currentScore === score[i - 1][j - 1] + matchScore) {
                alignedRef = ref[i - 1] + alignedRef;
                alignedQry = qry[j - 1] + alignedQry;
                i--;
                j--;
            } else if (currentScore === score[i - 1][j] + SCORING.GAP_EXTEND) {
                alignedRef = ref[i - 1] + alignedRef;
                alignedQry = '-' + alignedQry;
                i--;
            } else {
                alignedRef = '-' + alignedRef;
                alignedQry = qry[j - 1] + alignedQry;
                j--;
            }
        } else if (i > 0) {
            alignedRef = ref[i - 1] + alignedRef;
            alignedQry = '-' + alignedQry;
            i--;
        } else {
            alignedRef = '-' + alignedRef;
            alignedQry = qry[j - 1] + alignedQry;
            j--;
        }
    }
    return { alignedRef, alignedQry };
}

/**
 * Perform traceback for Local Alignment.
 * Starts from the position of maximum score and stops when score drops to 0.
 */
export function tracebackLocal(score: number[][], ref: string, qry: string, startI: number, startJ: number): { alignedRef: string, alignedQry: string, refStart: number, queryStart: number } {
    let alignedRef = '';
    let alignedQry = '';
    let i = startI;
    let j = startJ;

    while (i > 0 && j > 0 && score[i][j] > 0) {
        const currentScore = score[i][j];
        const matchScore = ref[i - 1] === qry[j - 1] ? SCORING.MATCH : SCORING.MISMATCH;

        if (currentScore === score[i - 1][j - 1] + matchScore) {
            alignedRef = ref[i - 1] + alignedRef;
            alignedQry = qry[j - 1] + alignedQry;
            i--;
            j--;
        } else if (currentScore === score[i - 1][j] + SCORING.GAP_EXTEND) {
            alignedRef = ref[i - 1] + alignedRef;
            alignedQry = '-' + alignedQry;
            i--;
        } else {
            alignedRef = '-' + alignedRef;
            alignedQry = qry[j - 1] + alignedQry;
            j--;
        }
    }

    return { alignedRef, alignedQry, refStart: i, queryStart: j };
}

/**
 * Build AlignmentResult object from aligned strings and scores.
 */
export function buildAlignmentResult(
    alignedReference: string,
    alignedQuery: string,
    score: number,
    refStart: number,
    refEnd: number,
    queryStart: number,
    queryEnd: number,
    isReverseComplement: boolean = false
): AlignmentResult {
    const positions: AlignmentPosition[] = [];
    let matches = 0;
    let mismatches = 0;
    let gapsInRef = 0;
    let gapsInQuery = 0;

    let refIdx = refStart;
    let qryIdx = queryStart;

    for (let pos = 0; pos < alignedReference.length; pos++) {
        const refBase = alignedReference[pos];
        const qryBase = alignedQuery[pos];
        let type: AlignmentPosition['type'];

        if (refBase === '-') {
            type = 'gap_ref';
            gapsInRef++;
            positions.push({ alignedPos: pos, refPos: -1, queryPos: qryIdx, refBase, queryBase: qryBase, type });
            qryIdx++;
        } else if (qryBase === '-') {
            type = 'gap_query';
            gapsInQuery++;
            positions.push({ alignedPos: pos, refPos: refIdx, queryPos: -1, refBase, queryBase: qryBase, type });
            refIdx++;
        } else if (refBase === qryBase) {
            type = 'match';
            matches++;
            positions.push({ alignedPos: pos, refPos: refIdx, queryPos: qryIdx, refBase, queryBase: qryBase, type });
            refIdx++;
            qryIdx++;
        } else {
            type = 'mismatch';
            mismatches++;
            positions.push({ alignedPos: pos, refPos: refIdx, queryPos: qryIdx, refBase, queryBase: qryBase, type });
            refIdx++;
            qryIdx++;
        }
    }

    return {
        alignedReference,
        alignedQuery,
        score,
        refStart,
        refEnd,
        queryStart,
        queryEnd,
        matches,
        mismatches,
        gapsInRef,
        gapsInQuery,
        positions,
        isReverseComplement
    };
}

/**
 * Needleman-Wunsch Global Alignment
 */
export function globalAlign(reference: string, query: string): AlignmentResult {
    const ref = reference.toUpperCase();
    const qry = query.toUpperCase();
    const m = ref.length;
    const n = qry.length;

    // 1. Initialize
    const score = initializeMatrix(m, n);
    initGlobalBoundaries(score, m, n);

    // 2. Fill Matrix
    fillGlobalScoreMatrix(score, ref, qry);

    // 3. Traceback
    const { alignedRef, alignedQry } = tracebackGlobal(score, ref, qry);

    // 4. Build Result
    return buildAlignmentResult(
        alignedRef,
        alignedQry,
        score[m][n],
        0, m, 0, n,
        false
    );
}

/**
 * Internal implementation of Smith-Waterman Local Alignment
 */
function localAlignInternal(reference: string, query: string): AlignmentResult {
    const ref = reference.toUpperCase();
    const qry = query.toUpperCase();
    const m = ref.length;
    const n = qry.length;

    // 1. Initialize
    const score = initializeMatrix(m, n); // already filled with 0

    // 2. Fill Matrix (find max score)
    const { maxScore, maxI, maxJ } = fillLocalScoreMatrix(score, ref, qry);

    // 3. Traceback
    const { alignedRef, alignedQry, refStart, queryStart } = tracebackLocal(score, ref, qry, maxI, maxJ);

    // 4. Build Result
    return buildAlignmentResult(
        alignedRef,
        alignedQry,
        maxScore,
        refStart, maxI,
        queryStart, maxJ,
        false
    );
}

/**
 * Smith-Waterman Local Alignment with Automatic Reverse Complement Detection
 */
export function localAlign(reference: string, query: string): AlignmentResult {
    // Try forward alignment
    const forwardResult = localAlignInternal(reference, query);

    // Try reverse complement alignment
    const revCompQuery = reverseComplement(query);
    const reverseResult = localAlignInternal(reference, revCompQuery);

    // Return the better-scoring alignment
    if (reverseResult.score > forwardResult.score) {
        return {
            ...reverseResult,
            isReverseComplement: true
        };
    }

    return forwardResult;
}

/**
 * Compute alignment identity percentage
 */
export function getAlignmentIdentity(result: AlignmentResult): number {
    const total = result.matches + result.mismatches + result.gapsInRef + result.gapsInQuery;
    if (total === 0) return 0;
    return (result.matches / total) * 100;
}

/**
 * Get a simple text representation of the alignment
 */
export function formatAlignment(result: AlignmentResult, lineWidth: number = 60): string {
    const lines: string[] = [];
    const { alignedReference, alignedQuery } = result;

    for (let i = 0; i < alignedReference.length; i += lineWidth) {
        const refLine = alignedReference.slice(i, i + lineWidth);
        const qryLine = alignedQuery.slice(i, i + lineWidth);

        // Create match line
        let matchLine = '';
        for (let j = 0; j < refLine.length; j++) {
            if (refLine[j] === qryLine[j]) {
                matchLine += '|';
            } else if (refLine[j] === '-' || qryLine[j] === '-') {
                matchLine += ' ';
            } else {
                matchLine += '.';
            }
        }

        lines.push(`Ref: ${refLine}`);
        lines.push(`     ${matchLine}`);
        lines.push(`Qry: ${qryLine}`);
        lines.push('');
    }

    return lines.join('\n');
}
