import { posix } from 'node:path';
import { type CellTarget, resolveCellTarget } from './cell-target.js';
import { PATCH_REFUSAL, XlsxPatchRefusedError } from './patch-refusal.js';
import { formatCell } from './workbook/cell-reference.js';
import type { CellValue } from './workbook/cell-value.js';
import { type OpenedWorkbook, openWorkbook } from './workbook/open-workbook.js';
import { patchSheet, type SheetWrite } from './workbook/patch-sheet.js';
import { CALC_CHAIN_RELATIONSHIP, withFullCalcOnLoad, withoutOverride, withoutRelationships } from './workbook/recalculate-on-open.js';
import { resolveTarget } from './workbook/workbook-parts.js';
import { replaceContent } from './zip/entry-content.js';
import type { ZipArchive } from './zip/read-zip.js';
import { writeZip } from './zip/write-zip.js';

/** One value, and the cell it goes in. */
export interface CellWrite {
  readonly at: CellTarget;
  readonly value: CellValue;
}

export interface PatchWorkbookCommand {
  /** The registered template's bytes, as `config/efrag/` holds them. Never modified; the result is a new array. */
  readonly template: Uint8Array;
  readonly writes: readonly CellWrite[];
}

const CONTENT_TYPES = '[Content_Types].xml';
const ENCODER = new TextEncoder();

/**
 * The template with the values written into its own cells — tasks 45.1 and 45.2, FR-50, AD-10.
 *
 * **A patch with no writes is the template, byte for byte** (45.1), and it is reached through the same read and
 * write as any other patch rather than by returning the input: what makes a no-op provably a no-op is that the codec
 * underneath reproduces the archive exactly, which the round-trip spec holds of every committed EFRAG binary.
 *
 * **A patch with writes changes these parts and no others** (45.2): each worksheet a value is written into, in the
 * written cells' elements alone; the workbook part, in its `calcPr` alone; the workbook's relationships and the content
 * types, by the calc chain's entry in each; and the calc chain, which is dropped. Every other part — styles, shared
 * strings, the other sheets, the drawings, the Licence sheet EFRAG's MIT notice lives on — leaves as the compressed
 * bytes it arrived as.
 */
export function patchWorkbook(command: PatchWorkbookCommand): Uint8Array {
  const workbook = openWorkbook(command.template);
  if (command.writes.length === 0) return writeZip(workbook.archive);

  const bySheet = new Map<string, { sheet: string; writes: SheetWrite[] }>();
  const seen = new Set<string>();
  for (const write of command.writes) {
    const resolved = resolveCellTarget(workbook, write.at);
    const key = `${resolved.part}!${formatCell(resolved.cell)}`;
    if (seen.has(key)) {
      throw new XlsxPatchRefusedError(PATCH_REFUSAL.DUPLICATE_WRITE, `${resolved.sheet}!${formatCell(resolved.cell)} is written twice`);
    }
    seen.add(key);
    const group = bySheet.get(resolved.part) ?? { sheet: resolved.sheet, writes: [] };
    group.writes.push({ cell: resolved.cell, value: write.value });
    bySheet.set(resolved.part, group);
  }

  const replaced = new Map<string, string>();
  for (const [part, group] of bySheet) {
    replaced.set(part, patchSheet({ sheet: group.sheet, xml: workbook.text(part) ?? '', writes: group.writes }));
  }

  const { parts } = workbook;
  replaced.set(parts.workbook, withFullCalcOnLoad(workbook.text(parts.workbook) ?? ''));
  const relationships = withoutRelationships(workbook.text(parts.relationships) ?? '', CALC_CHAIN_RELATIONSHIP);
  const dropped = relationships.targets.map((target) => resolveTarget(posix.dirname(parts.workbook), target));
  replaced.set(parts.relationships, relationships.xml);
  replaced.set(CONTENT_TYPES, dropped.reduce((xml, part) => withoutOverride(xml, part), workbook.text(CONTENT_TYPES) ?? ''));

  return writeZip(rewritten({ workbook, replaced, removed: new Set(dropped) }));
}

/**
 * The archive with some parts' content replaced and some removed; every other entry the very object read.
 *
 * **A part whose text came out unchanged keeps its entry**, so it is not deflated again — a workbook with no calc
 * chain leaves its relationships and its content types exactly as they arrived.
 */
function rewritten(command: {
  readonly workbook: OpenedWorkbook;
  readonly replaced: ReadonlyMap<string, string>;
  readonly removed: ReadonlySet<string>;
}): ZipArchive {
  const { workbook, replaced, removed } = command;
  return {
    ...workbook.archive,
    entries: workbook.archive.entries
      .filter((entry) => !removed.has(entry.name))
      .map((entry) => {
        const text = replaced.get(entry.name);
        return text === undefined || text === workbook.text(entry.name) ? entry : replaceContent(entry, ENCODER.encode(text));
      }),
  };
}
