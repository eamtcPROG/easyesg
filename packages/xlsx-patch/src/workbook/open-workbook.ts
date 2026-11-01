import { PATCH_REFUSAL, XlsxPatchRefusedError } from '../patch-refusal.js';
import { entryContent } from '../zip/entry-content.js';
import { type ZipArchive, readZip } from '../zip/read-zip.js';
import { readDefinedNames } from './defined-names.js';
import { type WorkbookParts, locateWorkbookParts } from './workbook-parts.js';

/** A workbook as a patch needs it: its archive, where its parts are, its names, and any part's text. */
export interface OpenedWorkbook {
  readonly archive: ZipArchive;
  readonly parts: WorkbookParts;
  /** Workbook-scoped defined names to their references as written. */
  readonly names: ReadonlyMap<string, string>;
  /** A part's text, or `null` where the archive has no such part. */
  text(part: string): string | null;
}

/**
 * UTF-8 decoded **with a byte-order mark kept**: `TextDecoder` strips a BOM by default, so a part carrying one would
 * be written back without it — three bytes changed outside every written cell, in a part this package promises to
 * change only where it writes. `fatal`, because a part that is not UTF-8 would round-trip as replacement characters.
 */
const DECODER = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export function openWorkbook(template: Uint8Array): OpenedWorkbook {
  const archive = readZip(template);
  const byName = new Map(archive.entries.map((entry) => [entry.name, entry]));
  const text = (part: string): string | null => {
    const entry = byName.get(part);
    if (entry === undefined) return null;
    try {
      return DECODER.decode(entryContent(entry));
    } catch (error) {
      if (error instanceof XlsxPatchRefusedError) throw error;
      throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNSUPPORTED_WORKBOOK, `${part} is not UTF-8`);
    }
  };
  const parts = locateWorkbookParts(text);
  return { archive, parts, names: readDefinedNames(text(parts.workbook) ?? ''), text };
}
