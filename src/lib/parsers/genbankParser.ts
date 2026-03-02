/**
 * GenBank File Parser
 * 
 * Parses GenBank flat file format (.gb, .gbk) to extract:
 * - Sequence metadata (LOCUS, DEFINITION, ACCESSION)
 * - Feature annotations (CDS, gene, promoter, etc.)
 * - Sequence data (ORIGIN block)
 */

export interface GenBankFeature {
    /** Feature type (CDS, gene, promoter, etc.) */
    type: string;
    /** Feature location */
    location: {
        start: number;
        end: number;
        strand: 1 | -1;
        complement: boolean;
    };
    /** Feature qualifiers (/gene, /product, /note, etc.) */
    qualifiers: Record<string, string>;
}

export interface GenBankData {
    /** Locus name */
    locus: string;
    /** Sequence length */
    length: number;
    /** Molecule type (DNA, RNA, etc.) */
    moleculeType: string;
    /** Topology (linear, circular) */
    topology: 'linear' | 'circular';
    /** Definition/description */
    definition: string;
    /** Accession number */
    accession: string;
    /** Version */
    version: string;
    /** Organism */
    organism: string;
    /** Feature annotations */
    features: GenBankFeature[];
    /** DNA/RNA sequence */
    sequence: string;
}

/**
 * Parse a GenBank file from text content
 */
export function parseGenBank(content: string): GenBankData {
    const lines = content.split('\n');

    const result: GenBankData = {
        locus: '',
        length: 0,
        moleculeType: 'DNA',
        topology: 'linear',
        definition: '',
        accession: '',
        version: '',
        organism: '',
        features: [],
        sequence: ''
    };

    let currentSection = '';
    let currentFeature: GenBankFeature | null = null;
    let currentQualifier = '';
    let qualifierValue = '';
    let inOrigin = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip empty lines in most sections
        if (!line.trim() && !inOrigin) continue;

        // Check for section headers
        if (line.startsWith('LOCUS')) {
            parseLocus(line, result);
            currentSection = 'LOCUS';
        } else if (line.startsWith('DEFINITION')) {
            result.definition = line.substring(12).trim();
            currentSection = 'DEFINITION';
        } else if (line.startsWith('ACCESSION')) {
            result.accession = line.substring(12).trim();
            currentSection = 'ACCESSION';
        } else if (line.startsWith('VERSION')) {
            result.version = line.substring(12).trim();
            currentSection = 'VERSION';
        } else if (line.startsWith('  ORGANISM')) {
            result.organism = line.substring(12).trim();
            currentSection = 'ORGANISM';
        } else if (line.startsWith('FEATURES')) {
            currentSection = 'FEATURES';
            currentFeature = null;
        } else if (line.startsWith('ORIGIN')) {
            currentSection = 'ORIGIN';
            inOrigin = true;
            // Save any pending feature
            if (currentFeature) {
                result.features.push(currentFeature);
                currentFeature = null;
            }
        } else if (line.startsWith('//')) {
            // End of record
            break;
        } else if (currentSection === 'DEFINITION' && line.startsWith('            ')) {
            // Continuation of definition
            result.definition += ' ' + line.trim();
        } else if (currentSection === 'FEATURES') {
            // Parse features
            if (line.match(/^     [A-Za-z_]+/)) {
                // New feature line
                if (currentFeature) {
                    // Save qualifier value
                    if (currentQualifier) {
                        currentFeature.qualifiers[currentQualifier] = qualifierValue.replace(/^"|"$/g, '');
                    }
                    result.features.push(currentFeature);
                }

                // Parse new feature
                const featureMatch = line.match(/^     ([A-Za-z_]+)\s+(.+)$/);
                if (featureMatch) {
                    const location = parseLocation(featureMatch[2]);
                    currentFeature = {
                        type: featureMatch[1],
                        location,
                        qualifiers: {}
                    };
                    currentQualifier = '';
                    qualifierValue = '';
                }
            } else if (line.match(/^\s+\/[A-Za-z_]+/) && currentFeature) {
                // New qualifier
                if (currentQualifier) {
                    currentFeature.qualifiers[currentQualifier] = qualifierValue.replace(/^"|"$/g, '');
                }

                const qualMatch = line.match(/^\s+\/([A-Za-z_]+)(?:=(.*))?$/);
                if (qualMatch) {
                    currentQualifier = qualMatch[1];
                    qualifierValue = qualMatch[2] || 'true';
                }
            } else if (line.startsWith('                     ') && currentFeature && currentQualifier) {
                // Continuation of qualifier value
                qualifierValue += line.trim();
            }
        } else if (inOrigin) {
            // Parse sequence from ORIGIN block
            // Format: "   123 acgtacgt acgtacgt..."
            const seqMatch = line.match(/^\s*\d+\s+(.+)$/);
            if (seqMatch) {
                result.sequence += seqMatch[1].replace(/\s/g, '').toUpperCase();
            }
        }
    }

    // Save any final pending feature
    if (currentFeature) {
        if (currentQualifier) {
            currentFeature.qualifiers[currentQualifier] = qualifierValue.replace(/^"|"$/g, '');
        }
        result.features.push(currentFeature);
    }

    result.length = result.sequence.length;

    return result;
}

function parseLocus(line: string, result: GenBankData): void {
    // LOCUS       name    length bp    type    topology
    // Example: LOCUS       pBR322    4361 bp    DNA     circular
    const parts = line.split(/\s+/);

    result.locus = parts[1] || '';

    for (let i = 2; i < parts.length; i++) {
        const part = parts[i];
        if (part === 'bp' || part === 'aa') {
            result.length = parseInt(parts[i - 1], 10) || 0;
        } else if (part === 'DNA' || part === 'RNA' || part === 'mRNA') {
            result.moleculeType = part;
        } else if (part === 'circular' || part === 'linear') {
            result.topology = part as 'linear' | 'circular';
        }
    }
}

function parseLocation(locationStr: string): GenBankFeature['location'] {
    let start = 0;
    let end = 0;
    let strand: 1 | -1 = 1;
    let complement = false;

    // Handle complement
    if (locationStr.startsWith('complement(')) {
        complement = true;
        strand = -1;
        locationStr = locationStr.slice(11, -1);
    }

    // Handle join (take first..last)
    if (locationStr.startsWith('join(')) {
        const parts = locationStr.slice(5, -1).split(',');
        const firstMatch = parts[0].match(/(\d+)/);
        const lastMatch = parts[parts.length - 1].match(/\.\.(\d+)|(\d+)$/);
        start = firstMatch ? parseInt(firstMatch[1], 10) : 0;
        end = lastMatch ? parseInt(lastMatch[1] || lastMatch[2], 10) : 0;
    } else {
        // Simple location: 123..456 or 123
        const match = locationStr.match(/<?(\d+)(?:\.\.>?(\d+))?/);
        if (match) {
            start = parseInt(match[1], 10);
            end = match[2] ? parseInt(match[2], 10) : start;
        }
    }

    return { start, end, strand, complement };
}

/**
 * Convert GenBank features to SeqViz annotation format
 */
export function genBankToSeqVizAnnotations(features: GenBankFeature[]) {
    return features.map((f) => ({
        name: f.qualifiers.gene || f.qualifiers.product || f.qualifiers.label || f.type,
        start: f.location.start - 1, // SeqViz uses 0-indexed
        end: f.location.end,
        direction: f.location.strand,
        color: getFeatureColor(f.type),
        type: f.type
    }));
}

function getFeatureColor(type: string): string {
    const colors: Record<string, string> = {
        CDS: '#4CAF50',
        gene: '#2196F3',
        promoter: '#FF9800',
        terminator: '#F44336',
        primer_bind: '#9C27B0',
        misc_feature: '#607D8B',
        rep_origin: '#795548',
        regulatory: '#00BCD4',
    };
    return colors[type] || '#9E9E9E';
}

/**
 * Serialize GenBankData back to a GenBank file format string
 */
export function serializeGenBank(data: GenBankData): string {
    const lines: string[] = [];
    const date = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(/,/g, '');

    // LOCUS line
    // Fixed width formatting is important for some parsers but flexible for others.
    // We'll aim for standard column positions.
    // Columns: LOCUS (0), Name (12), Length (29?), Type (44?), Topology (55?), Date (68)
    const locusName = data.locus.padEnd(16);
    const lengthStr = `${data.sequence.length} bp`.padStart(11);
    const molecule = data.moleculeType.padEnd(7);
    const topology = data.topology.padEnd(9);
    // Construct LOCUS line manually to match standard spacing roughly
    lines.push(`LOCUS       ${locusName} ${lengthStr}    ${molecule}     ${topology} ${date}`);

    lines.push(`DEFINITION  ${data.definition || '.'}`);
    lines.push(`ACCESSION   ${data.accession || '.'}`);
    lines.push(`VERSION     ${data.version || '.'}`);
    if (data.organism) {
        lines.push(`  ORGANISM  ${data.organism}`);
    }

    // FEATURES
    lines.push('FEATURES             Location/Qualifiers');

    // Sort features by start position generally
    const sortedFeatures = [...data.features].sort((a, b) => a.location.start - b.location.start);

    for (const f of sortedFeatures) {
        // Location string
        let locStr = '';
        if (f.location.start === f.location.end) {
            locStr = `${f.location.start}`;
        } else {
            locStr = `${f.location.start}..${f.location.end}`;
        }

        if (f.location.complement) {
            locStr = `complement(${locStr})`;
        }

        lines.push(`     ${f.type.padEnd(16)}${locStr}`);

        // Qualifiers
        for (const [key, val] of Object.entries(f.qualifiers)) {
            let qVal = val;
            // Quote value if needed or always? Standard usually quotes text.
            if (!/^\d+$/.test(qVal) && qVal !== 'true') {
                qVal = `"${qVal}"`;
            } else if (qVal === 'true') {
                qVal = ''; // boolean flags like /pseudo need no value? Or empty string.
            }

            // Wrap long qualifier values? For now basic.
            if (qVal) {
                lines.push(`                     /${key}=${qVal}`);
            } else {
                lines.push(`                     /${key}`);
            }
        }
    }

    // ORIGIN
    lines.push('ORIGIN');
    const seq = data.sequence.toLowerCase();
    for (let i = 0; i < seq.length; i += 60) {
        const chunk = seq.slice(i, i + 60);
        // Format: number (9 chars right aligned) sequence blocks of 10
        const lineNum = (i + 1).toString().padStart(9);
        const blocks = chunk.match(/.{1,10}/g)?.join(' ') || '';
        lines.push(`${lineNum} ${blocks}`);
    }

    lines.push('//');

    return lines.join('\n');
}
