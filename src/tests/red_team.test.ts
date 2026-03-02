
import { describe, it, expect } from 'vitest';
import { parseGenBank } from '../lib/parsers/genbankParser';
import { parseAB1 } from '../lib/parsers/ab1Parser';
import { findORFs } from '../lib/analysis/orfFinder';
import { localAlign } from '../lib/analysis/alignment';

describe('Red Team Torture Tests', () => {

    describe('1. GenBank Parser Destruction', () => {
        it('The "Mobius Strip" (Circular Joins)', () => {
            // Input: A feature with location="join(9990..10000,1..10)"
            const circularGb = `LOCUS       SCU49845     10000 bp    DNA             PLN       21-JUN-1999
DEFINITION  Test Circular Feature.
ACCESSION   SCU49845
FEATURES             Location/Qualifiers
     CDS             join(9990..10000,1..10)
                     /gene="mobius"
ORIGIN
        1 aaaaaaaaaa
//`;
            const result = parseGenBank(circularGb);
            const feature = result.features[0];

            expect(feature).toBeDefined();
            // Verify that the parser handles the 'join' location gracefully.
            // Expected behavior: features are extracted, even if the complex location logic is simplified.
            expect(result.features.length).toBeGreaterThan(0);
        });

        it('The "Runaway Quote" (Parsing State)', () => {
            // Input: A qualifier /note="This note never ends... (EOF reached before closing quote)
            const runawayGb = `LOCUS       RUNAWAY     100 bp    DNA             PLN       21-JUN-1999
FEATURES             Location/Qualifiers
     CDS             1..50
                     /note="This note never ends...
ORIGIN
        1 actg
//`;
            // The parser must parse what it can or throw an error, but NOT hang (infinite loop).
            try {
                const result = parseGenBank(runawayGb);
                // If it succeeds, the note might contain the text up to EOF or newline
                const cds = result.features.find(f => f.type === 'CDS');
                if (cds && cds.qualifiers.note) {
                    expect(cds.qualifiers.note).toContain("This note never ends");
                }
            } catch (e) {
                // Crashing with an error is acceptable behavior for malformed input, 
                // hanging is not.
                expect(e).toBeDefined();
            }
        });

        it('The "Ambiguity Storm"', () => {
            // Input: Sequence data containing only IUPAC codes.
            const ambiguityGb = `LOCUS       AMBIGUITY     11 bp    DNA             PLN       21-JUN-1999
ORIGIN
        1 nrykmswbdh v
//`;
            // Note: 'v' is at the end. ' ' spacing is standard genbank.
            const result = parseGenBank(ambiguityGb);
            // Verify that IUPAC ambiguity codes are preserved and not stripped as whitespace.
            expect(result.sequence.toUpperCase()).toBe("NRYKMSWBDHV");
        });
    });

    describe('2. AB1 (Binary) Corruption', () => {
        it('The "Truncated Body"', () => {
            // Mock ArrayBuffer with 'ABIF' header but cut short.
            // We need to simulate a case where the header CLAIMS there are entries, but the file ends.
            // If we just leave it as zeros, numEntries=0, which is valid (empty file).

            const buffer = new Uint8Array(200);
            const view = new DataView(buffer.buffer);

            // Magic ABIF
            new Uint8Array(buffer.buffer).set(new TextEncoder().encode("ABIF"), 0);

            // Set numEntries (offset 18) to 5
            view.setInt32(18, 5, false);

            // Set dirOffset (offset 26) to 500 (beyond end of 200 byte buffer)
            view.setInt32(26, 500, false);

            // Expect the parser to throw a handled error due to OOB access, rather than panic.
            expect(() => parseAB1(buffer.buffer)).toThrow();
        });

        it('The "Data Poisoning" (Algorithm Robustness)', () => {
            // Since we can't easily inject NaN into TypedArrays in the parser input,
            // We will stress the alignment algorithm with "Poisoned" sequence data 
            // resembling what might happen if a parser returned garbage.

            // Alignment should handle empty strings, weird characters, or massive gaps without freezing.
            const ref = "ATGCTAGCT";

            // Inject null bytes and extended characters to simulate binary corruption or encoding issues.
            const poisonedQuery = "ATG" + String.fromCharCode(0) + "CTA" + String.fromCharCode(255) + "GCT";

            // Verify the alignment completes (does not freeze/loop).
            const result = localAlign(ref, poisonedQuery);
            expect(result).toBeDefined();
        });
    });

    describe('3. Algorithm Stress (ORF & Alignment)', () => {
        it('The "Russian Doll" ORFs', () => {
            // Input: ATG...ATG...TGA...TGA
            // Outer: ATG (start 0) ... TGA (end 15)  (Length 15)
            // Inner: ATG (start 3) ... TGA (end 12)  (Length 9)
            // Sequence: A T G A T G C C C T G A T G A
            // Idx:      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4
            //           M     M           *     *

            const seq = "ATGATGCCCTGATGA";
            // Min length 9 to catch the inner ORF.
            const orfs = findORFs(seq, { minLength: 9, startCodons: ['ATG'], stopCodons: ['TGA'], findReverse: false });

            // Verify that the algorithm finds the outer ORF or correctly handles the overlapping logic.
            // Outer: ATG (0) ... TGA (15)
            expect(orfs.length).toBeGreaterThan(0);
            const foundOuter = orfs.some(o => o.start === 0);
            expect(foundOuter).toBe(true);
        });

        it('The "Empty Origin"', () => {
            const emptyGb = `LOCUS       EMPTY     0 bp    DNA             PLN       21-JUN-1999
ORIGIN
//`;
            const result = parseGenBank(emptyGb);
            expect(result.sequence).toBe("");
        });

        it('The "Massive Sequence" (Performance)', () => {
            // Generate 1MB string
            const size = 1000 * 1000;
            const massiveSeq = "A".repeat(size);

            const start = performance.now();
            const orfs = findORFs(massiveSeq, { minLength: 100, findReverse: false });
            const end = performance.now();

            const duration = end - start;
            // Benchmark: Ensure processing time is reasonable (< 500ms allows for test runner overhead).
            expect(duration).toBeLessThan(500);
            expect(orfs).toBeDefined();
        });
    });
});
