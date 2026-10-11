import { posix } from 'node:path';
import { type CellTarget, resolveCellTarget } from './cell-target.js';
import { PATCH_REFUSAL, XlsxPatchRefusedError } from './patch-refusal.js';
import { formatCell } from './workbook/cell-reference.js';
import type { CellValue } from './workbook/cell-value.js';
import { sheetNotes, type SheetNote, withNoteContentTypes } from './workbook/cell-notes.js';
import { type DocumentProperties, PROPERTY_RELATIONSHIP, withApplication, withCoreProperties } from './workbook/document-properties.js';
import { type OpenedWorkbook, openWorkbook } from './workbook/open-workbook.js';
import { patchSheet } from './workbook/patch-sheet.js';
import { CALC_CHAIN_RELATIONSHIP, withFullCalcOnLoad, withoutOverride, withoutRelationships } from './workbook/recalculate-on-open.js';
import { relationshipsPartOf, resolveTarget, targetOf } from './workbook/workbook-parts.js';
import { replaceContent } from './zip/entry-content.js';
import { newEntry } from './zip/new-entry.js';
import type { ZipArchive, ZipEntry } from './zip/read-zip.js';
import { writeZip } from './zip/write-zip.js';

/** One value, and the cell it goes in. */
export interface CellWrite {
  readonly at: CellTarget;
  readonly value: CellValue;
}

/** One note, and the cell it is attached to — a cell the template computes as readily as one it asks for. */
export interface CellNote {
  readonly at: CellTarget;
  readonly text: string;
}

export interface PatchWorkbookCommand {
  /** The registered template's bytes, as `config/efrag/` holds them. Never modified; the result is a new array. */
  readonly template: Uint8Array;
  readonly writes: readonly CellWrite[];
  /**
   * Notes on cells, for a template with no Footnotes sheet of its own (task 46; `architecture.md` §12.5.6's task-46
   * row (9)). Several on one cell are joined, in the order given, into one.
   */
  readonly notes?: readonly CellNote[];
  /** Whose the notes are — the comments part's one author. Required where there are notes. */
  readonly noteAuthor?: string;
  /** The file's own facts (task-46 rows (4), (7)). */
  readonly properties?: DocumentProperties;
}

const CONTENT_TYPES = '[Content_Types].xml';
const ROOT_RELATIONSHIPS = '_rels/.rels';
const ENCODER = new TextEncoder();
/** Two notes on one cell read as two paragraphs. */
const NOTE_SEPARATOR = '\n\n';

/**
 * The template with the values written into its own cells — tasks 45.1 and 45.2, FR-50, AD-10.
 *
 * **A patch with nothing to write is the template, byte for byte** (45.1), and it is reached through the same read and
 * write as any other patch rather than by returning the input: what makes a no-op provably a no-op is that the codec
 * underneath reproduces the archive exactly, which the round-trip spec holds of every committed EFRAG binary.
 *
 * **A patch with values changes these parts and no others** (45.2): each worksheet a value is written into, in the
 * written cells' elements alone; the workbook part, in its `calcPr` alone; the workbook's relationships and the content
 * types, by the calc chain's entry in each; and the calc chain, which is dropped. **Since task 46** a patch given
 * document properties also changes the property parts in those elements alone, and one given notes changes each noted
 * sheet by its `legacyDrawing`, its relationships, and the content types, and adds a comments part and a drawing for
 * it. Every other part — styles, shared strings, the other sheets, the drawings already there, the Licence sheet EFRAG's
 * MIT notice lives on — leaves as the compressed bytes it arrived as.
 */
export function patchWorkbook(command: PatchWorkbookCommand): Uint8Array {
  const workbook = openWorkbook(command.template);
  const notes = command.notes ?? [];
  if (command.writes.length === 0 && notes.length === 0 && command.properties === undefined) return writeZip(workbook.archive);

  const replaced = new Map<string, string>();
  const removed = new Set<string>();
  const added: { name: string; text: string }[] = [];
  const text = (part: string): string => replaced.get(part) ?? workbook.text(part) ?? '';

  if (command.writes.length > 0) {
    for (const [part, group] of grouped(workbook, command.writes, (write, resolved) => ({ cell: resolved.cell, value: write.value }), true)) {
      replaced.set(part, patchSheet({ sheet: group.sheet, xml: text(part), writes: group.items }));
    }
    const { parts } = workbook;
    replaced.set(parts.workbook, withFullCalcOnLoad(text(parts.workbook)));
    const relationships = withoutRelationships(text(parts.relationships), CALC_CHAIN_RELATIONSHIP);
    const dropped = relationships.targets.map((target) => resolveTarget(posix.dirname(parts.workbook), target));
    replaced.set(parts.relationships, relationships.xml);
    replaced.set(CONTENT_TYPES, dropped.reduce((xml, part) => withoutOverride(xml, part), text(CONTENT_TYPES)));
    dropped.forEach((part) => removed.add(part));
  }

  if (notes.length > 0) {
    if (command.noteAuthor === undefined) {
      throw new XlsxPatchRefusedError(PATCH_REFUSAL.MALFORMED_TEXT, 'notes are given with no author to attribute them to');
    }
    const commentsParts: string[] = [];
    let index = 0;
    for (const [part, group] of grouped(workbook, notes, (note, resolved) => ({ cell: resolved.cell, text: note.text }), false)) {
      index += 1;
      const relationshipsPart = relationshipsPartOf(part);
      const patch = sheetNotes({
        sheet: group.sheet,
        sheetPart: part,
        sheetXml: text(part),
        relationshipsXml: replaced.get(relationshipsPart) ?? workbook.text(relationshipsPart),
        notes: joined(group.items),
        author: command.noteAuthor,
        index,
      });
      replaced.set(part, patch.sheetXml);
      if (workbook.text(relationshipsPart) === null) added.push({ name: relationshipsPart, text: patch.relationshipsXml });
      else replaced.set(relationshipsPart, patch.relationshipsXml);
      added.push({ name: patch.comments.part, text: patch.comments.xml }, { name: patch.drawing.part, text: patch.drawing.xml });
      commentsParts.push(patch.comments.part);
    }
    replaced.set(CONTENT_TYPES, withNoteContentTypes(text(CONTENT_TYPES), commentsParts));
  }

  if (command.properties !== undefined) {
    const { application, ...core } = command.properties;
    const rootRelationships = workbook.text(ROOT_RELATIONSHIPS) ?? '';
    if (application !== undefined) {
      const part = targetOf(rootRelationships, PROPERTY_RELATIONSHIP.EXTENDED, '') ?? refuseMissing('extended properties');
      replaced.set(part, withApplication(text(part), application));
    }
    if (Object.values(core).some((value) => value !== undefined)) {
      const part = targetOf(rootRelationships, PROPERTY_RELATIONSHIP.CORE, '') ?? refuseMissing('core properties');
      replaced.set(part, withCoreProperties(text(part), core));
    }
  }

  return writeZip(rewritten({ workbook, replaced, removed, added }));
}

const refuseMissing = (what: string): never => {
  throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNSUPPORTED_WORKBOOK, `the package names no ${what} part`);
};

/**
 * Items grouped by the worksheet part their cell is on. **A cell written twice is refused** — which value wins would be
 * an accident of order — and a cell noted twice is not, since both notes are kept.
 */
function grouped<T extends { readonly at: CellTarget }, U>(
  workbook: OpenedWorkbook,
  items: readonly T[],
  toItem: (item: T, resolved: ReturnType<typeof resolveCellTarget>) => U,
  unique: boolean,
): Map<string, { sheet: string; items: U[] }> {
  const bySheet = new Map<string, { sheet: string; items: U[] }>();
  const seen = new Set<string>();
  for (const item of items) {
    const resolved = resolveCellTarget(workbook, item.at);
    const key = `${resolved.part}!${formatCell(resolved.cell)}`;
    if (unique && seen.has(key)) {
      throw new XlsxPatchRefusedError(PATCH_REFUSAL.DUPLICATE_WRITE, `${resolved.sheet}!${formatCell(resolved.cell)} is written twice`);
    }
    seen.add(key);
    const group = bySheet.get(resolved.part) ?? { sheet: resolved.sheet, items: [] };
    group.items.push(toItem(item, resolved));
    bySheet.set(resolved.part, group);
  }
  return bySheet;
}

/** One note per cell, several joined in the order given. */
function joined(notes: readonly SheetNote[]): readonly SheetNote[] {
  const byCell = new Map<string, SheetNote>();
  for (const note of notes) {
    const key = formatCell(note.cell);
    const earlier = byCell.get(key);
    byCell.set(key, earlier === undefined ? note : { cell: note.cell, text: `${earlier.text}${NOTE_SEPARATOR}${note.text}` });
  }
  return [...byCell.values()];
}

/**
 * The archive with some parts' content replaced, some removed and some added; every other entry the very object read.
 *
 * **A part whose text came out unchanged keeps its entry**, so it is not deflated again — a workbook with no calc
 * chain leaves its relationships and its content types exactly as they arrived. **An added part is laid out last**,
 * its timestamp the workbook part's, so one export made twice is one file twice.
 */
function rewritten(command: {
  readonly workbook: OpenedWorkbook;
  readonly replaced: ReadonlyMap<string, string>;
  readonly removed: ReadonlySet<string>;
  readonly added: readonly { readonly name: string; readonly text: string }[];
}): ZipArchive {
  const { workbook, replaced, removed, added } = command;
  const kept = workbook.archive.entries
    .filter((entry) => !removed.has(entry.name))
    .map((entry) => {
      const text = replaced.get(entry.name);
      return text === undefined || text === workbook.text(entry.name) ? entry : replaceContent(entry, ENCODER.encode(text));
    });
  const like = workbook.archive.entries.find((entry) => entry.name === workbook.parts.workbook) as ZipEntry;
  const last = Math.max(...workbook.archive.entries.map((entry) => entry.localOffset));
  const fresh = added.map((part, n) => newEntry({ name: part.name, content: ENCODER.encode(part.text), like, after: last + n + 1 }));
  return { ...workbook.archive, entries: [...kept, ...fresh] };
}
