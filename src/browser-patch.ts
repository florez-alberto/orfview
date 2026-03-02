/**
 * Browser Compatibility Mode for Tauri App
 * 
 * This file enables the app to run in a browser without the Tauri backend.
 * It mocks the Tauri IPC bridge and provides sample data for testing.
 */

// Sample GenBank file content for demo mode
const SAMPLE_GENBANK = `LOCUS       pEGFP-N1               4733 bp ds-DNA     circular SYN
DEFINITION  Cloning vector pEGFP-N1, complete sequence.
FEATURES             Location/Qualifiers
     source          1..4733
                     /organism="synthetic DNA construct"
                     /mol_type="other DNA"
     CDS             679..1398
                     /label="EGFP"
                     /gene="EGFP"
     promoter        1..589
                     /label="CMV promoter"
     promoter        4097..4340
                     /label="SV40 promoter"
     CDS             2628..3419
                     /label="aph(3')-II (or nptII)"
     rep_origin      3895..4029
                     /label="f1 ori"
     rep_origin      1567..2370
                     /label="SV40 ori"
     misc_feature    606..678
                     /label="MCS"
ORIGIN
        1 tagttattaa tagtaatcaa ttacggggtc attagttcat agcccatata tggagttccg
       61 cgttacataa cttacggtaa atggcccgcc tggctgaccg cccaacgacc cccgcccatt
      121 gacgtcaata atgacgtatg ttcccatagt aacgccaata gggactttcc attgacgtca
      181 atgggtggag tatttacggt aaactgccca cttggcagta catcaagtgt atcatatgcc
      241 aagtacgccc cctattgacg tcaatgacgg taaatggccc gcctggcatt atgcccagta
      301 catgacctta tgggactttc ctacttggca gtacatctac gtattagtca tcgctattac
      361 catggtgatg cggttttggc agtacatcaa tgggcgtgga tagcggtttg actcacgggg
      421 atttccaagt ctccacccca ttgacgtcaa tgggagtttg ttttggcacc aaaatcaacg
      481 ggactttcca aaatgtcgta acaactccgc cccattgacg caaatgggcg gtaggcgtgt
      541 acggtgggag gtctatataa gcagagctct ctggctaact agagaaccca ctgcttactg
      601 gcttatcgaa attaatacga ctcactatag ggagacccaa gctggctagc gtttaaacgg
      661 gccctctaga ctcgagcggc cgccactgtg ctggatatct gcagaattcg cccttaagct
      721 tgaattcatg gtgagcaagg gcgaggagct gttcaccggg gtggtgccca tcctggtcga
      781 gctggacggc gacgtaaacg gccacaagtt cagcgtgtcc ggcgagggcg agggcgatgc
      841 cacctacggc aagctgaccc tgaagttcat ctgcaccacc ggcaagctgc ccgtgccctg
      901 gcccaccctc gtgaccaccc tgacctacgg cgtgcagtgc ttcagccgct accccgacca
      961 catgaagcag cacgacttct tcaagtccgc catgcccgaa ggctacgtcc aggagcgcac
     1021 catcttcttc aaggacgacg gcaactacaa gacccgcgcc gaggtgaagt tcgagggcga
     1081 caccctggtg aaccgcatcg agctgaaggg catcgacttc aaggaggacg gcaacatcct
     1141 ggggcacaag ctggagtaca actacaacag ccacaacgtc tatatcatgg ccgacaagca
     1201 gaagaacggc atcaaggtga acttcaagat ccgccacaac atcgaggacg gcagcgtgca
     1261 gctcgccgac cactaccagc agaacaccc
//
`;

// Check if running in browser (not Tauri)
const isBrowser = typeof window !== 'undefined' && !(window as any).__TAURI_INTERNALS__;

if (isBrowser) {
    console.log('[Browser Mode] Tauri not detected - enabling browser compatibility mode');

    // Disable drag-region overlays
    const style = document.createElement('style');
    style.textContent = `
        [data-tauri-drag-region] {
            pointer-events: none !important;
            -webkit-app-region: no-drag !important;
        }
        [data-tauri-drag-region] * {
            pointer-events: auto !important;
        }
    `;
    document.head.appendChild(style);

    // Mock Tauri window object
    (window as any).__TAURI__ = {
        invoke: async (cmd: string, args?: any) => {
            console.log(`[Browser Mode] Mocked invoke: ${cmd}`, args);
            return mockCommand(cmd, args);
        }
    };

    // Also mock at the INTERNALS level for newer Tauri
    (window as any).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args?: any) => {
            console.log(`[Browser Mode] Mocked invoke: ${cmd}`, args);
            return mockCommand(cmd, args);
        },
        metadata: {
            currentWindow: { label: 'main' },
            currentWebviewWindow: { label: 'main' }
        }
    };
}

// Mock command responses - now returns Promises for async file fetching
async function mockCommand(cmd: string, args?: any): Promise<any> {
    switch (cmd) {
        case 'list_files':
            // Return real file listing from public/test-data
            return [
                { name: 'pEGFP-N1.gb', path: `${args?.path || '/mock'}/pEGFP-N1.gb`, is_dir: false },
                { name: 'test-plasmid.gb', path: `${args?.path || '/mock'}/test-plasmid.gb`, is_dir: false },
                { name: 'egfp.fasta', path: `${args?.path || '/mock'}/egfp.fasta`, is_dir: false },
                { name: '52GJ06_A05_C_F.ab1', path: `${args?.path || '/mock'}/52GJ06_A05_C_F.ab1`, is_dir: false }
            ];

        case 'read_file_content':
        case 'read_file':
            // Fetch real files from public/test-data
            const fileName = args?.path?.split('/').pop();
            // Allow .gb, .gbk, and .fasta/.fa files
            if (fileName && (fileName.endsWith('.gb') || fileName.endsWith('.gbk') || fileName.endsWith('.fasta') || fileName.endsWith('.fa'))) {
                try {
                    const response = await fetch(`/test-data/${fileName}`);
                    if (response.ok) {
                        return await response.text();
                    }
                } catch (e) {
                    console.log('[Browser Mode] Failed to fetch file, using fallback:', e);
                }
                // Only use sample GenBank if we were trying to fetch a GenBank file
                if (fileName.endsWith('.gb') || fileName.endsWith('.gbk')) {
                    return SAMPLE_GENBANK;
                }
            }
            return 'Sample file content';

        case 'read_binary_file':
            // Fetch real AB1 files from public/test-data
            const binFileName = args?.path?.split('/').pop();
            if (binFileName?.endsWith('.ab1') || binFileName?.endsWith('.abi')) {
                try {
                    const response = await fetch(`/test-data/${binFileName}`);
                    if (response.ok) {
                        const arrayBuffer = await response.arrayBuffer();
                        // Convert to number[] as Tauri invoke returns
                        return Array.from(new Uint8Array(arrayBuffer));
                    }
                } catch (e) {
                    console.log('[Browser Mode] Failed to fetch AB1 file:', e);
                }
            }
            return [];

        case 'list_directory':
            // Return a mock directory listing
            return [
                { name: 'pEGFP-N1.gb', isDir: false },
                { name: 'test-plasmid.gb', isDir: false },
                { name: 'egfp.fasta', isDir: false },
                { name: '52GJ06_A05_C_F.ab1', isDir: false }
            ];

        case 'plugin:dialog|open':
            // Mock file picker - return a fake path
            return '/mock/test-folder';

        default:
            console.log(`[Browser Mode] Unknown command: ${cmd}`);
            return null;
    }
}

export { };
