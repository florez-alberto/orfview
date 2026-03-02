import { describe, it, expect } from 'vitest';
import { findORFs } from './orfFinder';

describe('findORFs', () => {
    // ATG = Start
    // TAA = Stop
    // Start at 6 (0-based of ATG is 5?) No sequence indices:
    // T (0), T (1), T (2), T (3), T (4)
    // A (5), T (6), G (7) -> Start codon at 5
    // C (8)..
    // T (17), A (18), A (19) -> Stop codon at 17-19. End index 20 (exclusive).
    // Length: 20 - 5 = 15 bp. (5 codons: ATG, CCC, CCC, CCC, TAA)

    it('should find a simple ORF on forward strand', () => {
        const seq = "TTTTTATGCCCCCCCCCTAA TTTTT".replace(/ /g, '');
        //           01234567890123456789 01234
        // ATG starts at 5.
        // TAA ends at 20 (exclusive, i.e. index 19 is last A).
        // Length 15.

        const results = findORFs(seq, { minLength: 9 }); // 3 aa
        expect(results.length).toBeGreaterThan(0);

        const best = results.find(orf => orf.start === 5 && orf.strand === 1);
        expect(best).toBeDefined();
        expect(best?.end).toBe(20);
    });

    it('should respect minimum length option', () => {
        const seq = "ATGCCCTAA"; // 9 bp
        const resultsShort = findORFs(seq, { minLength: 6 });
        expect(resultsShort.length).toBeGreaterThan(0);

        const resultsLong = findORFs(seq, { minLength: 50 });
        expect(resultsLong).toHaveLength(0);
    });

    it('should find ORFs on reverse strand', () => {
        // Construct reverse complement of an ORF
        // Fwd: ATG CCC TAA (9bp)
        // RevComp: TTA GGG CAT
        const seq = "AAAA TTA GGG CAT TTTT".replace(/ /g, '');
        // Rev strand processing will see ATG CCC TAA.

        const results = findORFs(seq, { minLength: 6, findReverse: true });
        const revOrf = results.find(orf => orf.strand === -1);

        expect(revOrf).toBeDefined();
        expect(revOrf?.strand).toBe(-1);
    });
    it('should handle run-off ORFs (no stop codon)', () => {
        const seq = "ATG AA AA AA AA"; // No stop
        const results = findORFs(seq);
        // Should return nothing if no closure
        expect(results).toHaveLength(0);
    });

    it('should detect nested ORFs', () => {
        const seq = "ATGCCCTAA" + "A" + "ATGCCCTAA";
        const results = findORFs(seq, { minLength: 9 });
        expect(results.length).toBeGreaterThanOrEqual(2);
    });
});


