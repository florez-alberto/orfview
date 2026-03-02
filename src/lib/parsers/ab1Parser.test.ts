import { describe, it, expect } from 'vitest';
import { parseAB1 } from './ab1Parser';

describe('ab1Parser', () => {
    it('should throw error if file is not ABIF', () => {
        const buffer = new ArrayBuffer(100);
        expect(() => parseAB1(buffer)).toThrow("Invalid AB1 file: missing ABIF header");
    });

    it('should parse a minimal valid ABIF file with no entries', () => {
        // Construct a minimal valid header
        // Header length is 128 bytes
        const buffer = new ArrayBuffer(128);
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);

        // Magic "ABIF"
        bytes[0] = 65; // A
        bytes[1] = 66; // B
        bytes[2] = 73; // I
        bytes[3] = 70; // F

        // Num Entries (Offset 18) -> 0
        view.setInt32(18, 0, false);

        // Data Offset (Offset 26) -> 0
        view.setInt32(26, 0, false);

        const result = parseAB1(buffer);
        expect(result).toBeDefined();
        // Defaults
        expect(result.sequence).toBe("");
        expect(result.traceLength).toBe(0);
        expect(result.traces.A).toHaveLength(0);
    });

    // We can't easily mock a full complex AB1 with traces without a massive byte array.
    // But testing the header validation and graceful handling of empty directories is a good start for unit tests.
    it('should gracefully fail on truncated files', () => {
        // Valid header start, but cut off immediately
        const buffer = new ArrayBuffer(200);
        const view = new DataView(buffer);
        // Magic
        new Uint8Array(buffer).set([65, 66, 73, 70], 0);
        // Num Entries = 1
        view.setInt32(18, 1, false);
        // Offset = 500 (Way past end of 200 byte buffer)
        view.setInt32(26, 500, false);

        // Expect standard JS Error (RangeError) or explicit throw
        expect(() => parseAB1(buffer)).toThrow();
    });

    it('should handle zero-peak reads', () => {
        // Minimal valid file with 0 peaks
        const buffer = new ArrayBuffer(128);
        new Uint8Array(buffer).set([65, 66, 73, 70], 0);
        // Defaults in header (Num Entries 0, Offset 0) are 0 in empty buffer

        const result = parseAB1(buffer);
        expect(result.peakLocations.length).toBe(0);
        expect(result.sequence.length).toBe(0);
    });
});
