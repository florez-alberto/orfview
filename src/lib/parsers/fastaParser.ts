
export interface FastaSequence {
    id: string;
    description: string;
    sequence: string;
}

/**
 * Parses a FASTA file content into an array of sequences.
 * Handles single and multi-sequence files.
 */
export function parseFasta(content: string): FastaSequence[] {
    const lines = content.split(/\r?\n/);
    const sequences: FastaSequence[] = [];

    let currentHeader = '';
    let currentSequence = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.length === 0) continue;

        if (line.startsWith('>')) {
            // If we have a previous sequence, push it
            if (currentHeader) {
                sequences.push(createSequenceObj(currentHeader, currentSequence));
            }

            currentHeader = line.substring(1); // Remove '>'
            currentSequence = '';
        } else {
            currentSequence += line.replace(/\s/g, '').toUpperCase();
        }
    }

    // Push the last sequence
    if (currentHeader) {
        sequences.push(createSequenceObj(currentHeader, currentSequence));
    } else if (currentSequence && sequences.length === 0) {
        // Handle raw sequence without header if it looks like DNA/protein
        // though tecnically not valid FASTA, useful for robustness
        sequences.push({
            id: 'Unknown',
            description: 'No header provided',
            sequence: currentSequence
        });
    }

    return sequences;
}

function createSequenceObj(header: string, sequence: string): FastaSequence {
    // Split header into id and description
    // Example: >NM_001.3 Homo sapiens mRNA
    // id: NM_001.3, description: Homo sapiens mRNA
    const firstSpace = header.indexOf(' ');
    let id = header;
    let description = '';

    if (firstSpace !== -1) {
        id = header.substring(0, firstSpace);
        description = header.substring(firstSpace + 1).trim();
    }

    return {
        id,
        description,
        sequence
    };
}
