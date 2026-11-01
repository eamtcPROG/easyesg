import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The EFRAG binaries committed under `config/efrag/`, read by the specs that hold the package to them.
 *
 * **The real files, not fixtures made to look like them.** What 45.1 claims is that *these* archives round-trip byte
 * for byte, and a hand-made zip would prove the codec handles the shape its author thought of. Shared here because
 * five specs open them, and one spelling of where they live is one place to move when `config/efrag/` does.
 */
const EFRAG = resolve(import.meta.dirname, '../../../../config/efrag');

export const COMMITTED_TEMPLATE = {
  V1_2_0: '1.2.0/VSME-Digital-Template-1.2.0.xlsx',
  V1_3_0: '1.3.0/VSME-Digital-Template-1.3.0.xlsx',
  SAMPLE_1_3_0: '1.3.0/VSME-Digital-Template-Sample-1.3.0.xlsx',
} as const;
export type CommittedTemplate = (typeof COMMITTED_TEMPLATE)[keyof typeof COMMITTED_TEMPLATE];

export const committedTemplate = (file: CommittedTemplate): Uint8Array => new Uint8Array(readFileSync(resolve(EFRAG, file)));
