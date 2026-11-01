import type { WriteCalcLineRequest } from '@easyesg/contracts';

/**
 * What an import hands the board: the lines to queue, and the file they came from, for the notice. Here rather than
 * beside the panel because the mapping arm the panel renders reads it too, and a type the child imported back from
 * its parent was a cycle (`no-circular`).
 */
export interface ImportedLines {
  readonly lines: readonly WriteCalcLineRequest[];
  readonly file: string;
}
