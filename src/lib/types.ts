
import { AB1Data } from "./parsers/ab1Parser";
import { GenBankData } from "./parsers/genbankParser";
import { FastaSequence } from "./parsers/fastaParser";

export interface HistoryState {
    past: string[];
    future: string[];
}

export type ActiveFile =
    | { type: 'text'; path: string; content: string }
    | { type: 'ab1'; path: string; data: AB1Data }
    | { type: 'genbank'; path: string; data: GenBankData }
    | { type: 'fasta'; path: string; data: FastaSequence[] }
    | { type: 'json'; path: string; content: string };

export type FileViewState = {
    viewMode: 'viewer' | 'alignment';
    selectedAlignmentIds: string[];
    showMap: boolean;
    showSequence: boolean;
    showEnzymes: boolean;
    showORFs: boolean;
};

export interface AlignableSequence {
    id: string;
    name: string;
    sequence: string;
    chromatogramData?: AB1Data;
    metadata?: {
        date?: string;
        bases?: number;
        filePath?: string;
    };
}
