export const CODON_TABLE: Record<string, string> = {
    'ATA': 'I', 'ATC': 'I', 'ATT': 'I', 'ATG': 'M',
    'ACA': 'T', 'ACC': 'T', 'ACG': 'T', 'ACT': 'T',
    'AAC': 'N', 'AAT': 'N', 'AAA': 'K', 'AAG': 'K',
    'AGC': 'S', 'AGT': 'S', 'AGA': 'R', 'AGG': 'R',
    'CTA': 'L', 'CTC': 'L', 'CTG': 'L', 'CTT': 'L',
    'CCA': 'P', 'CCC': 'P', 'CCG': 'P', 'CCT': 'P',
    'CAC': 'H', 'CAT': 'H', 'CAA': 'Q', 'CAG': 'Q',
    'CGA': 'R', 'CGC': 'R', 'CGG': 'R', 'CGT': 'R',
    'GTA': 'V', 'GTC': 'V', 'GTG': 'V', 'GTT': 'V',
    'GCA': 'A', 'GCC': 'A', 'GCG': 'A', 'GCT': 'A',
    'GAC': 'D', 'GAT': 'D', 'GAA': 'E', 'GAG': 'E',
    'GGA': 'G', 'GGC': 'G', 'GGG': 'G', 'GGT': 'G',
    'TCA': 'S', 'TCC': 'S', 'TCG': 'S', 'TCT': 'S',
    'TTC': 'F', 'TTT': 'F', 'TTA': 'L', 'TTG': 'L',
    'TAC': 'Y', 'TAT': 'Y', 'TAA': '*', 'TAG': '*',
    'TGC': 'C', 'TGT': 'C', 'TGA': '*', 'TGG': 'W',
};

export const START_CODONS = ['ATG'];
export const STOP_CODONS = ['TAA', 'TAG', 'TGA'];

export const COMPLEMENT_MAP: Record<string, string> = {
    'A': 'T', 'T': 'A', 'U': 'A',
    'G': 'C', 'C': 'G',
    'N': 'N', 'R': 'Y', 'Y': 'R', 'M': 'K', 'K': 'M', 'S': 'S', 'W': 'W', 'H': 'D', 'B': 'V', 'V': 'B', 'D': 'H',
    // Lowercase
    'a': 't', 't': 'a', 'u': 'a',
    'g': 'c', 'c': 'g',
    'n': 'n'
};
