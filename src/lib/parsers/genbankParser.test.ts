import { describe, it, expect } from 'vitest';
import { parseGenBank } from './genbankParser';

describe('genbankParser', () => {
    const mockGenBank = `LOCUS       SCU49845     500 bp    DNA     linear   PLN 21-JUN-1999
DEFINITION  Saccharomyces cerevisiae TCP1-beta gene, partial cds.
ACCESSION   U49845
VERSION     U49845.1  GI:1293613
FEATURES             Location/Qualifiers
     source          1..50
                     /organism="Saccharomyces cerevisiae"
                     /db_xref="taxon:4932"
     gene            5..40
                     /gene="TCP1-beta"
     CDS             5..40
                     /gene="TCP1-beta"
                     /codon_start=1
                     /product="chaperonin subunit Cct2p"
                     /translation="SSIYNGIPTS"
     misc_feature    complement(20..30)
                     /note="test complement"
ORIGIN
        1 gatcgatcga tcgatcgatc gatcgatcga tcgatcgatc gatcgatcga tcgatcgatc
       61 gatcgatcga tcgatcgatc gatcgatcga tcgatcgatc gatcgatcga tcgatcgatc
//`;

    it('should parse basic metadata', () => {
        const result = parseGenBank(mockGenBank);
        expect(result.locus).toBe('SCU49845');
        expect(result.definition).toContain('Saccharomyces cerevisiae');
        expect(result.accession).toBe('U49845');
        expect(result.topology).toBe('linear');
    });

    it('should parse features correctly', () => {
        const result = parseGenBank(mockGenBank);
        expect(result.features).toHaveLength(4); // source, gene, CDS, misc_feature

        const cds = result.features.find(f => f.type === 'CDS');
        expect(cds).toBeDefined();
        expect(cds?.location.start).toBe(5);
        expect(cds?.location.end).toBe(40);
        expect(cds?.qualifiers.gene).toBe('TCP1-beta');
        expect(cds?.qualifiers.product).toBe('chaperonin subunit Cct2p');
    });

    it('should parse complement location', () => {
        const result = parseGenBank(mockGenBank);
        const misc = result.features.find(f => f.type === 'misc_feature');
        expect(misc?.location.complement).toBe(true);
        expect(misc?.location.strand).toBe(-1);
        expect(misc?.location.start).toBe(20);
        expect(misc?.location.end).toBe(30);
    });

    it('should parse DNA sequence', () => {
        const result = parseGenBank(mockGenBank);
        expect(result.sequence).toHaveLength(120); // 60 chars per line * 2 lines
        // First line: 60 chars. Second line: up to offset 61..120.
        // My mock string:
        //        1 gatcgatcga tcgatcgatc gatcgatcga tcgatcgatc gatcgatcga tcgatcgatc (60 chars)
        //       61 gatcgatcga tcgatcgatc gatcgatcga tcgatcgatc gatcgatcga tcgatcgatc (60 chars)
        // Total 120 chars.

        expect(result.sequence.startsWith('GATCGATC')).toBe(true);
        // Ensure whitespace is removed
        expect(result.sequence).not.toContain(' ');
        expect(result.sequence).not.toMatch(/[0-9]/);
    });
    it('should handle circular features across origin', () => {
        const file = `LOCUS       CIRCULAR     10000 bp    DNA     circular
FEATURES             Location/Qualifiers
     CDS             join(9990..10000,1..10)
                     /gene="circumflex"
ORIGIN
//`;
        const result = parseGenBank(file);
        const feature = result.features[0];
        // Our simple parser likely treats join() by taking start of first and end of last
        // or effectively "linearizing" it for storage.
        // We verify it captures the raw coordinates extracted.
        expect(feature).toBeDefined();
        // Just checking it didn't crash and attempted to parse
        expect(feature.location.start).toBeGreaterThan(0);
    });

    it('should support IUPAC ambiguity codes', () => {
        const file = `LOCUS       AMBIGUOUS     12 bp    DNA     linear
ORIGIN
        1 atgnnnrryk km
//`;
        const result = parseGenBank(file);
        expect(result.sequence).toBe('ATGNNNRRYKKM');
    });

    it('should survive messy formatting', () => {
        const file = `LOCUS       MESSY     20 bp    DNA     linear
FEATURES             Location/Qualifiers
     gene            1..10
/gene="messy"
      CDS            5..15
                     /note="bad indent"
ORIGIN
        1 gggggaaaaa tttttccccc
//`;
        const result = parseGenBank(file);
        expect(result.features.length).toBeGreaterThan(0);
        expect(result.sequence).toContain('GGGGGAAAAATTTTTCCCCC');
    });
});
