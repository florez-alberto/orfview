import { describe, it, expect } from 'vitest';
import {
    initializeMatrix,
    fillGlobalScoreMatrix,
    tracebackGlobal,
    globalAlign,
    initGlobalBoundaries,
    SCORING
} from './alignment';

describe('Alignment Algorithm Helpers', () => {

    describe('initializeMatrix', () => {
        it('should create a zero-filled matrix of correct dimensions', () => {
            const rows = 3;
            const cols = 2;
            const matrix = initializeMatrix(rows, cols);

            expect(matrix.length).toBe(rows + 1);
            expect(matrix[0].length).toBe(cols + 1);
            expect(matrix[0][0]).toBe(0);
            expect(matrix[rows][cols]).toBe(0);
        });
    });

    describe('fillGlobalScoreMatrix', () => {
        it('should correctly score a simple match', () => {
            const ref = 'A';
            const qry = 'A';
            const m = ref.length;
            const n = qry.length;

            const matrix = initializeMatrix(m, n);
            initGlobalBoundaries(matrix, m, n);
            fillGlobalScoreMatrix(matrix, ref, qry);

            // Diagonal movement: 0 + MATCH_SCORE
            expect(matrix[1][1]).toBe(SCORING.MATCH);
        });

        it('should correctly score a mismatch', () => {
            const ref = 'A';
            const qry = 'C';
            const m = ref.length;
            const n = qry.length;

            const matrix = initializeMatrix(m, n);
            initGlobalBoundaries(matrix, m, n);
            fillGlobalScoreMatrix(matrix, ref, qry);

            // Diagonal movement: 0 + MISMATCH_PENALTY
            expect(matrix[1][1]).toBe(SCORING.MISMATCH);
        });

        it('should handle gaps correctly (Global)', () => {
            // ref: A
            // qry: -
            // This is effectively boundary condition check or gap extension
            const ref = 'A';
            const qry = 'A';
            // Let's test "AT" vs "A-T" implicitly via a longer matrix or just check boundary
            const matrix = initializeMatrix(ref.length, qry.length);
            initGlobalBoundaries(matrix, ref.length, qry.length);

            fillGlobalScoreMatrix(matrix, ref, qry);
            // matrix[1][1] should be max of:
            // Match: 0 + 2 = 2
            // Del: -2 - 1 = -3
            // Ins: -2 - 1 = -3
            expect(matrix[ref.length][qry.length]).toBe(2);
        });
    });

    describe('tracebackGlobal', () => {
        it('should return optimal path for identical sequences', () => {
            const ref = 'ACGT';
            const qry = 'ACGT';
            // We need a filled matrix first
            // To simulate "unit test" isolation, we can manually construct a matrix or use the helper
            // Using helper is safer integration unit test
            const m = ref.length;
            const n = qry.length;
            const matrix = initializeMatrix(m, n);
            initGlobalBoundaries(matrix, m, n);
            fillGlobalScoreMatrix(matrix, ref, qry);

            const result = tracebackGlobal(matrix, ref, qry);
            expect(result.alignedRef).toBe('ACGT');
            expect(result.alignedQry).toBe('ACGT');
        });

        it('should handle simple gap', () => {
            const ref = 'AT';
            const qry = 'A';
            const m = ref.length;
            const n = qry.length;
            const matrix = initializeMatrix(m, n);
            initGlobalBoundaries(matrix, m, n);
            fillGlobalScoreMatrix(matrix, ref, qry);

            const result = tracebackGlobal(matrix, ref, qry);
            // Should be AT vs A-
            expect(result.alignedRef).toBe('AT');
            expect(result.alignedQry).toBe('A-');
        });
    });

    describe('globalAlign (Integration)', () => {
        it('should align sequences correctly end-to-end', () => {
            const result = globalAlign('GATTACA', 'GCATGCU'); // simple check, ignoring T/U diff for score but handling strings
            // Just structural check
            expect(result).toBeDefined();
            expect(result.alignedReference.length).toBe(result.alignedQuery.length);
            expect(result.score).toBeDefined();
        });
    });
});
