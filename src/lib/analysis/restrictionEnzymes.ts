/**
 * Restriction Enzyme Database and Analysis Module
 * Contains common enzymes used in molecular biology with their recognition sites
 */

export interface RestrictionEnzyme {
    name: string;
    recognitionSite: string; // 5' to 3', use ^ for cut position
    cutPosition: number;     // Distance from 5' end on top strand
    overhang: 'blunt' | '5prime' | '3prime';
    methylationSensitive: boolean;
    commercial: string[];    // Vendors (e.g., NEB, Thermo)
}

// Common restriction enzymes database
export const ENZYME_DATABASE: RestrictionEnzyme[] = [
    // 6-cutters (common cloning enzymes)
    { name: 'EcoRI', recognitionSite: 'G^AATTC', cutPosition: 1, overhang: '5prime', methylationSensitive: true, commercial: ['NEB', 'Thermo'] },
    { name: 'BamHI', recognitionSite: 'G^GATCC', cutPosition: 1, overhang: '5prime', methylationSensitive: true, commercial: ['NEB', 'Thermo'] },
    { name: 'HindIII', recognitionSite: 'A^AGCTT', cutPosition: 1, overhang: '5prime', methylationSensitive: true, commercial: ['NEB', 'Thermo'] },
    { name: 'XbaI', recognitionSite: 'T^CTAGA', cutPosition: 1, overhang: '5prime', methylationSensitive: false, commercial: ['NEB', 'Thermo'] },
    { name: 'SalI', recognitionSite: 'G^TCGAC', cutPosition: 1, overhang: '5prime', methylationSensitive: true, commercial: ['NEB', 'Thermo'] },
    { name: 'PstI', recognitionSite: 'CTGCA^G', cutPosition: 5, overhang: '3prime', methylationSensitive: false, commercial: ['NEB', 'Thermo'] },
    { name: 'SphI', recognitionSite: 'GCATG^C', cutPosition: 5, overhang: '3prime', methylationSensitive: false, commercial: ['NEB', 'Thermo'] },
    { name: 'KpnI', recognitionSite: 'GGTAC^C', cutPosition: 5, overhang: '3prime', methylationSensitive: false, commercial: ['NEB', 'Thermo'] },
    { name: 'SacI', recognitionSite: 'GAGCT^C', cutPosition: 5, overhang: '3prime', methylationSensitive: false, commercial: ['NEB', 'Thermo'] },
    { name: 'XhoI', recognitionSite: 'C^TCGAG', cutPosition: 1, overhang: '5prime', methylationSensitive: true, commercial: ['NEB', 'Thermo'] },

    // 8-cutters (rare cutters)
    { name: 'NotI', recognitionSite: 'GC^GGCCGC', cutPosition: 2, overhang: '5prime', methylationSensitive: true, commercial: ['NEB', 'Thermo'] },
    { name: 'SfiI', recognitionSite: 'GGCCNNNN^NGGCC', cutPosition: 8, overhang: '3prime', methylationSensitive: false, commercial: ['NEB', 'Thermo'] },
    { name: 'AscI', recognitionSite: 'GG^CGCGCC', cutPosition: 2, overhang: '5prime', methylationSensitive: true, commercial: ['NEB'] },
    { name: 'PacI', recognitionSite: 'TTAAT^TAA', cutPosition: 5, overhang: '3prime', methylationSensitive: false, commercial: ['NEB', 'Thermo'] },

    // 4-cutters (frequent cutters)
    { name: 'MspI', recognitionSite: 'C^CGG', cutPosition: 1, overhang: '5prime', methylationSensitive: false, commercial: ['NEB', 'Thermo'] },
    { name: 'HaeIII', recognitionSite: 'GG^CC', cutPosition: 2, overhang: 'blunt', methylationSensitive: true, commercial: ['NEB', 'Thermo'] },
    { name: 'AluI', recognitionSite: 'AG^CT', cutPosition: 2, overhang: 'blunt', methylationSensitive: true, commercial: ['NEB', 'Thermo'] },
    { name: 'TaqI', recognitionSite: 'T^CGA', cutPosition: 1, overhang: '5prime', methylationSensitive: false, commercial: ['NEB', 'Thermo'] },
    { name: 'DpnI', recognitionSite: 'GA^TC', cutPosition: 2, overhang: 'blunt', methylationSensitive: false, commercial: ['NEB', 'Thermo'] },

    // Blunt cutters
    { name: 'SmaI', recognitionSite: 'CCC^GGG', cutPosition: 3, overhang: 'blunt', methylationSensitive: true, commercial: ['NEB', 'Thermo'] },
    { name: 'EcoRV', recognitionSite: 'GAT^ATC', cutPosition: 3, overhang: 'blunt', methylationSensitive: true, commercial: ['NEB', 'Thermo'] },
    { name: 'StuI', recognitionSite: 'AGG^CCT', cutPosition: 3, overhang: 'blunt', methylationSensitive: false, commercial: ['NEB', 'Thermo'] },
    { name: 'NruI', recognitionSite: 'TCG^CGA', cutPosition: 3, overhang: 'blunt', methylationSensitive: true, commercial: ['NEB', 'Thermo'] },
    { name: 'PvuII', recognitionSite: 'CAG^CTG', cutPosition: 3, overhang: 'blunt', methylationSensitive: true, commercial: ['NEB', 'Thermo'] },
];

export interface CutSite {
    enzyme: string;
    position: number;  // 0-based position in sequence
    strand: 1 | -1;
    recognitionStart: number;  // Start of recognition sequence
    recognitionEnd: number;    // End of recognition sequence
    topSnip?: number;          // Cut position on forward strand
    bottomSnip?: number;       // Cut position on reverse strand
}

/**
 * Get the clean recognition pattern (without cut marker)
 */
function getCleanPattern(site: string): string {
    return site.replace('^', '').toUpperCase();
}

/**
 * Convert recognition site to regex pattern
 * Handles ambiguous bases (N, R, Y, etc.)
 */
function siteToRegex(site: string): RegExp {
    const ambiguity: Record<string, string> = {
        'N': '[ACGT]',
        'R': '[AG]',
        'Y': '[CT]',
        'M': '[AC]',
        'K': '[GT]',
        'S': '[GC]',
        'W': '[AT]',
        'H': '[ACT]',
        'B': '[CGT]',
        'V': '[ACG]',
        'D': '[AGT]'
    };

    const cleanSite = getCleanPattern(site);
    let pattern = '';

    for (const base of cleanSite) {
        pattern += ambiguity[base] || base;
    }

    return new RegExp(pattern, 'gi');
}

/**
 * Find all cut sites for a given enzyme in a sequence
 */
export function findCutSites(sequence: string, enzyme: RestrictionEnzyme): CutSite[] {
    const sites: CutSite[] = [];
    const seq = sequence.toUpperCase();
    const regex = siteToRegex(enzyme.recognitionSite);
    const patternLength = getCleanPattern(enzyme.recognitionSite).length;

    let match;
    while ((match = regex.exec(seq)) !== null) {
        const topSnip = match.index + enzyme.cutPosition;
        // Symmetric cut logic for palindromes:
        // Distance from 3' end of top strand = Distance from 5' end of top strand (cutPos)
        // Bottom cut (on reverse strand 5'->3') happens at same distance.
        // Mapped to top strand index: 
        const bottomSnip = match.index + (patternLength - enzyme.cutPosition);

        sites.push({
            enzyme: enzyme.name,
            position: topSnip, // Default position is top cut
            strand: 1,
            recognitionStart: match.index,
            recognitionEnd: match.index + patternLength, // Exclusive end index for slice
            topSnip: topSnip,
            bottomSnip: bottomSnip
        });
        // Prevent infinite loops with zero-length matches
        if (match.index === regex.lastIndex) {
            regex.lastIndex++;
        }
    }

    return sites;
}

/**
 * Analyze a sequence for all enzymes in the database
 */
export function analyzeRestrictionSites(
    sequence: string,
    enzymes: RestrictionEnzyme[] = ENZYME_DATABASE
): Map<string, CutSite[]> {
    const results = new Map<string, CutSite[]>();

    for (const enzyme of enzymes) {
        const sites = findCutSites(sequence, enzyme);
        if (sites.length > 0) {
            results.set(enzyme.name, sites);
        }
    }

    return results;
}

/**
 * Get enzymes that cut exactly N times (useful for cloning)
 */
export function getEnzymesWithCutCount(
    sequence: string,
    cutCount: number,
    enzymes: RestrictionEnzyme[] = ENZYME_DATABASE
): { enzyme: RestrictionEnzyme; sites: CutSite[] }[] {
    const results: { enzyme: RestrictionEnzyme; sites: CutSite[] }[] = [];

    for (const enzyme of enzymes) {
        const sites = findCutSites(sequence, enzyme);
        if (sites.length === cutCount) {
            results.push({ enzyme, sites });
        }
    }

    return results;
}

/**
 * Get enzymes that DO NOT cut (useful for selecting cloning vectors)
 */
export function getNonCutters(
    sequence: string,
    enzymes: RestrictionEnzyme[] = ENZYME_DATABASE
): RestrictionEnzyme[] {
    return enzymes.filter(enzyme => findCutSites(sequence, enzyme).length === 0);
}
