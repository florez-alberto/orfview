import { CODON_TABLE, COMPLEMENT_MAP } from '../constants/codonTable';

/**
 * Returns the complementary DNA base or sequence map
 */
export function getComplementSequence(seq: string): string {
    return seq.split('').map(base => COMPLEMENT_MAP[base] || base).join('');
}

/**
 * Returns the reverse complement of a DNA sequence
 */
export function getReverseComplement(seq: string): string {
    return seq.toUpperCase().split('').reverse().map(base => COMPLEMENT_MAP[base] || base).join('');
}

/**
 * Translates a DNA sequence to a protein sequence
 */
export function translate(dnaSeq: string): string {
    let protein = "";
    const cleanSeq = dnaSeq.toUpperCase().replace(/U/g, "T"); // Handle RNA
    for (let i = 0; i < cleanSeq.length - 2; i += 3) {
        const codon = cleanSeq.substring(i, i + 3);
        const aa = CODON_TABLE[codon] || "X"; // X for unknown
        if (aa === "_") return protein; // Stop codon marker if different
        protein += aa;
    }
    return protein;
}

/**
 * Returns a color for a given nucleotide base
 */
export function getBaseColor(base: string): string {
    const b = base.toUpperCase();
    switch (b) {
        case 'A': return '#66ff66'; // Green
        case 'T': return '#ff6666'; // Red
        case 'G': return '#ffcc00'; // Yellow
        case 'C': return '#66b3ff'; // Blue
        case '-': return '#e0e0e0'; // Gap
        default: return '#bdbdbd';  // Grey
    }
}
