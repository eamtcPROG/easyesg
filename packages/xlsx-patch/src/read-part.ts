import { entryContent } from './zip/entry-content.js';
import { readZip } from './zip/read-zip.js';

/**
 * One part of a workbook as text, or `null` where the archive has no such part — `xl/sharedStrings.xml`, say.
 *
 * **For reading a template, not for patching it.** `apps/api`'s artefact spec reads which taxonomy a registered
 * binary names in its own shared strings, and the golden corpus (task 46.4) reads values back from an export; neither
 * needs a zip reader of its own, and two would be two places a part could be read differently.
 */
export function readPart(workbook: Uint8Array, part: string): string | null {
  const entry = readZip(workbook).entries.find((candidate) => candidate.name === part);
  return entry === undefined ? null : new TextDecoder('utf-8', { fatal: true }).decode(entryContent(entry));
}
