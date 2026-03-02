
/**
 * Represents an Open Reading Frame (ORF) found in a DNA sequence.
 * 
 * @property start - 0-based start index (inclusive) relative to the forward strand
 * @property end - 0-based end index (exclusive) relative to the forward strand
 * @property length - Length of the ORF in nucleotides
 * @property strand - The strand direction (1 for Forward, -1 for Reverse)
 * @property frame - The reading frame (0, 1, 2) relative to the strand
 * @property sequence - The DNA sequence of the ORF
 * @property protein - The translated amino acid sequence
 */
export interface ORF {
    start: number; // 0-based inclusive
    end: number;   // 0-based exclusive (length = end - start)
    length: number;
    strand: 1 | -1; // 1 for forward, -1 for reverse
    frame: number;  // 0, 1, 2
    sequence: string; // DNA sequence of the ORF
    protein: string;  // Translated protein sequence
}

import { getReverseComplement as reverseComplement, translate } from '../utils/dnaUtils';

interface ORFOptions {
    minLength?: number; // Minimum length in bp (default: 75 / 25aa)
    startCodons?: string[]; // Default: ['ATG']
    stopCodons?: string[];  // Default: ['TAA', 'TAG', 'TGA']
    findReverse?: boolean;   // Default: true
}



/**
 * Scans a DNA sequence for Open Reading Frames (ORFs) on both strands.
 * 
 * @param sequence - The input DNA sequence string (case-insensitive)
 * @param options - Configuration options
 * @param options.minLength - Minimum length in base pairs (default: 75)
 * @param options.startCodons - Array of start codon triplets (default: ['ATG'])
 * @param options.stopCodons - Array of stop codon triplets (default: ['TAA', 'TAG', 'TGA'])
 * @param options.findReverse - Whether to search the reverse complement strand (default: true)
 * 
 * @returns Array of found ORFs, sorted by length (descending)
 */
export function findORFs(sequence: string, options: ORFOptions = {}): ORF[] {
    const {
        minLength = 75, // 25 amino acids
        startCodons = ['ATG'],
        stopCodons = ['TAA', 'TAG', 'TGA'],
        findReverse = true
    } = options;

    const seq = sequence.toUpperCase();
    const len = seq.length;
    const orfs: ORF[] = [];

    // Helper to search one strand
    const searchStrand = (strandSeq: string, strand: 1 | -1) => {
        // Check all 3 frames
        for (let frame = 0; frame < 3; frame++) {
            let openReading = false;
            let startIndex = -1;

            // Scan codons
            for (let i = frame; i < strandSeq.length - 2; i += 3) {
                const codon = strandSeq.substring(i, i + 3);

                if (!openReading) {
                    if (startCodons.includes(codon)) {
                        openReading = true;
                        startIndex = i;
                    }
                } else {
                    if (stopCodons.includes(codon)) {
                        openReading = false;
                        const endIndex = i + 3; // Include stop codon
                        const orfSeq = strandSeq.substring(startIndex, endIndex);

                        if (orfSeq.length >= minLength) {
                            // Determine genomic coordinates based on strand
                            let genomicStart = 0;
                            let genomicEnd = 0;

                            if (strand === 1) {
                                genomicStart = startIndex;
                                genomicEnd = endIndex;
                            } else {
                                genomicStart = len - endIndex;
                                genomicEnd = len - startIndex;
                            }

                            orfs.push({
                                start: genomicStart,
                                end: genomicEnd,
                                length: endIndex - startIndex,
                                strand,
                                frame: frame,
                                sequence: orfSeq,
                                protein: translate(orfSeq)
                            });
                        }
                    }
                }
            }
        }
    };

    // 1. Forward Strand
    searchStrand(seq, 1);

    // 2. Reverse Strand
    if (findReverse) {
        const revSeq = reverseComplement(seq);
        searchStrand(revSeq, -1);
    }

    return orfs.sort((a, b) => b.length - a.length); // Sort by length desc
}
