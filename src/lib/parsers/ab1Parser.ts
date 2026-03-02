import { invoke } from "@tauri-apps/api/core";

/**
 * AB1/ABIF File Parser for Sanger Sequencing Data
 * 
 * ABIF (Applied Biosystems Inc. Format) is a binary format for storing
 * genetic analysis data including chromatogram traces and base calls.
 * 
 * File Structure:
 * - 128-byte header (starts with "ABIF")
 * - Directory of tag entries
 * - Data sections referenced by tags
 * 
 * Key Tags:
 * - DATA9-12: Trace channels (order varies by instrument)
 * - PBAS1: Base calls (sequence)
 * - PCON1: Quality values (phred scores)
 * - PLOC1: Peak locations
 * - FWO_1: Channel to base mapping
 */

export interface AB1Data {
    /** The called DNA sequence */
    sequence: string;
    /** Quality scores (phred) for each base */
    quality: number[];
    /** Peak positions for each base call */
    peakLocations: number[];
    /** Trace data for each channel */
    traces: {
        A: number[];
        C: number[];
        G: number[];
        T: number[];
    };
    /** Sample name from file */
    sampleName: string;
    /** Number of trace data points */
    traceLength: number;
}

interface DirectoryEntry {
    tagName: string;
    tagNumber: number;
    elementType: number;
    elementSize: number;
    numElements: number;
    dataSize: number;
    dataOffset: number;
}

/**
 * Parse an AB1/ABIF file from a binary buffer.
 * Extracts sequence, quality scores, peak locations, and trace data.
 * 
 * @param buffer - The raw file content as an ArrayBuffer
 * @returns The parsed AB1 data object
 * @throws {Error} If the file does not have a valid 'ABIF' header
 */
export function parseAB1(buffer: ArrayBuffer): AB1Data {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Verify ABIF magic bytes
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== "ABIF") {
        throw new Error("Invalid AB1 file: missing ABIF header");
    }

    // Read header information (all big-endian)
    // Byte 4-5: version
    // Byte 6-9: directory tag name ("tdir")
    // Byte 10-13: directory tag number (should be 1)
    // Byte 14-15: element type (1023)
    // Byte 16-17: element size (28 bytes per entry)
    // Byte 18-21: number of directory entries
    // Byte 22-25: total data size
    // Byte 26-29: data offset (or inline if <=4 bytes)

    const numEntries = view.getInt32(18, false); // big-endian
    const dirOffset = view.getInt32(26, false);

    // Parse directory entries
    const directory: DirectoryEntry[] = [];
    for (let i = 0; i < numEntries; i++) {
        const entryOffset = dirOffset + (i * 28);
        if (entryOffset + 28 > view.byteLength) {
            throw new Error(`Invalid AB1 file: Directory entry ${i + 1}/${numEntries} at offset ${entryOffset} exceeds file size ${view.byteLength}`);
        }
        const entry = parseDirectoryEntry(view, bytes, entryOffset);
        directory.push(entry);
    }

    // Helper to find entry by tag name and number
    const findEntry = (name: string, num: number = 1): DirectoryEntry | undefined => {
        return directory.find(e => e.tagName === name && e.tagNumber === num);
    };

    // Get channel order (FWO_1 tag contains the order like "GATC")
    let channelOrder = "GATC"; // default
    const fwoEntry = findEntry("FWO_", 1);
    if (fwoEntry) {
        channelOrder = readString(bytes, fwoEntry.dataOffset, 4);
    }

    // Read trace data (DATA 9-12)
    const traces: { A: number[]; C: number[]; G: number[]; T: number[] } = {
        A: [], C: [], G: [], T: []
    };

    for (let i = 0; i < 4; i++) {
        const dataEntry = findEntry("DATA", 9 + i);
        if (dataEntry) {
            const channel = channelOrder[i] as 'A' | 'C' | 'G' | 'T';
            traces[channel] = readShortArray(view, dataEntry.dataOffset, dataEntry.numElements);
        }
    }

    // Read base calls (PBAS1)
    let sequence = "";
    const pbasEntry = findEntry("PBAS", 1);
    if (pbasEntry) {
        sequence = readString(bytes, pbasEntry.dataOffset, pbasEntry.numElements);
    }

    // Read quality values (PCON1)
    let quality: number[] = [];
    const pconEntry = findEntry("PCON", 1);
    if (pconEntry) {
        quality = readByteArray(bytes, pconEntry.dataOffset, pconEntry.numElements);
    }

    // Read peak locations (PLOC1)
    let peakLocations: number[] = [];
    const plocEntry = findEntry("PLOC", 1);
    if (plocEntry) {
        peakLocations = readShortArray(view, plocEntry.dataOffset, plocEntry.numElements);
    }

    // Read sample name (SMPL1)
    let sampleName = "";
    const smplEntry = findEntry("SMPL", 1);
    if (smplEntry) {
        sampleName = readPascalString(bytes, smplEntry.dataOffset);
    }

    // Determine trace length from first non-empty channel
    const traceLength = traces.A.length || traces.C.length || traces.G.length || traces.T.length;

    return {
        sequence,
        quality,
        peakLocations,
        traces,
        sampleName,
        traceLength
    };
}

function parseDirectoryEntry(view: DataView, bytes: Uint8Array, offset: number): DirectoryEntry {
    const tagName = String.fromCharCode(
        bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]
    );
    const tagNumber = view.getInt32(offset + 4, false);
    const elementType = view.getInt16(offset + 8, false);
    const elementSize = view.getInt16(offset + 10, false);
    const numElements = view.getInt32(offset + 12, false);
    const dataSize = view.getInt32(offset + 16, false);

    // If data size <= 4, the data is stored inline in the offset field
    let dataOffset: number;
    if (dataSize <= 4) {
        dataOffset = offset + 20;
    } else {
        dataOffset = view.getInt32(offset + 20, false);
    }

    // Safety check: ensure the data offset point is within the view
    if (dataOffset > view.buffer.byteLength) {
        throw new Error(`Invalid AB1 file: Entry ${tagName} points to offset ${dataOffset} outside file bounds (${view.buffer.byteLength})`);
    }

    return {
        tagName,
        tagNumber,
        elementType,
        elementSize,
        numElements,
        dataSize,
        dataOffset
    };
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
    let result = "";
    for (let i = 0; i < length; i++) {
        const charCode = bytes[offset + i];
        if (charCode === 0) break;
        result += String.fromCharCode(charCode);
    }
    return result;
}

function readPascalString(bytes: Uint8Array, offset: number): string {
    const length = bytes[offset];
    return readString(bytes, offset + 1, length);
}

function readByteArray(bytes: Uint8Array, offset: number, length: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < length; i++) {
        result.push(bytes[offset + i]);
    }
    return result;
}

function readShortArray(view: DataView, offset: number, length: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < length; i++) {
        result.push(view.getInt16(offset + (i * 2), false));
    }
    return result;
}

/**
 * Read an AB1 file from the local file system via the Rust backend.
 * 
 * @param path - Absolute file path to the .ab1 file
 * @returns Promise resolution to the parsed AB1Data
 * @throws {Error} If file reading fails or parsing fails
 */
export async function loadAB1File(path: string): Promise<AB1Data> {
    // We need a Rust command to read binary files
    const bytes = await invoke<number[]>("read_binary_file", { path });
    const buffer = new Uint8Array(bytes).buffer;

    return parseAB1(buffer);
}
