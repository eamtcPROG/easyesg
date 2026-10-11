import { posix } from 'node:path';
import { PATCH_REFUSAL, XlsxPatchRefusedError } from '../patch-refusal.js';
import { type CellPosition, formatCell } from './cell-reference.js';
import { CELL_VALUE_KIND, cellBody, escapeCellText } from './cell-value.js';
import { attributeOf, escapeXml, readAttributes, startTags } from './xml-text.js';

/** One sheet's notes, each on one cell — several on one cell already joined by the caller. */
export interface SheetNote {
  readonly cell: CellPosition;
  readonly text: string;
}

/** What a sheet's notes change and add. */
export interface SheetNotesPatch {
  readonly sheetXml: string;
  readonly relationshipsXml: string;
  readonly comments: { readonly part: string; readonly xml: string };
  readonly drawing: { readonly part: string; readonly xml: string };
}

export const NOTE_PART = {
  COMMENTS_RELATIONSHIP: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
  DRAWING_RELATIONSHIP: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing',
  COMMENTS_CONTENT_TYPE: 'application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml',
  DRAWING_CONTENT_TYPE: 'application/vnd.openxmlformats-officedocument.vmlDrawing',
  /** The extension a drawing part is named with, which `[Content_Types].xml` declares once for every one of them. */
  DRAWING_EXTENSION: 'vml',
} as const;

const RELATIONSHIPS_NAMESPACE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const EMPTY_RELATIONSHIPS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
/** What follows `legacyDrawing` in a worksheet, in the schema's order (ECMA-376 Part 1, §18.3.1.99). */
const AFTER_LEGACY_DRAWING = ['legacyDrawingHF', 'drawingHF', 'picture', 'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst'];

const refuse = (message: string): never => {
  throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNSUPPORTED_WORKBOOK, message);
};

/**
 * A sheet's notes as Excel keeps them (task 46; `architecture.md` §12.5.6's task-46 row (9)): a comments part holding
 * the text, a VML drawing holding the shape each note opens in, both related from the sheet, and a `legacyDrawing`
 * in the sheet naming the drawing — the four pieces Excel reads a note from, and LibreOffice too.
 *
 * **Only a template without a Footnotes sheet reaches this** — EFRAG's `1.2.0` — which is why it refuses rather than
 * merges where a sheet already carries a legacy drawing: no registered template does, and merging shapes into a
 * drawing someone else wrote is machinery for a template nobody has registered.
 *
 * `index` numbers this sheet's two new parts and its shapes' id block, unique across the workbook's notes.
 */
export function sheetNotes(input: {
  readonly sheet: string;
  readonly sheetPart: string;
  readonly sheetXml: string;
  readonly relationshipsXml: string | null;
  readonly notes: readonly SheetNote[];
  readonly author: string;
  readonly index: number;
}): SheetNotesPatch {
  const { sheet, sheetXml, notes, author, index } = input;
  if (startTags(sheetXml, 'legacyDrawing').length > 0) refuse(`${sheet} already carries a legacy drawing`);
  const root = startTags(sheetXml, 'worksheet')[0] ?? refuse(`${sheet} has no worksheet element`);
  const prefix =
    readAttributes(root.tag).find((attribute) => attribute.name.startsWith('xmlns:') && attribute.value === RELATIONSHIPS_NAMESPACE)
      ?.name.slice('xmlns:'.length) ?? refuse(`${sheet} binds no prefix to the relationships namespace`);

  const relationships = input.relationshipsXml ?? EMPTY_RELATIONSHIPS;
  const taken = startTags(relationships, 'Relationship').map(({ tag }) => attributeOf(tag, 'Id') ?? '');
  const freeId = (after: number): string => {
    for (let n = after; ; n += 1) if (!taken.includes(`rId${n}`)) return `rId${n}`;
  };
  const commentsId = freeId(taken.length + 1);
  taken.push(commentsId);
  const drawingId = freeId(taken.length + 1);

  const directory = posix.dirname(input.sheetPart);
  const comments = { part: posix.join(posix.dirname(directory), `comments${index}.xml`), xml: commentsXml(notes, author) };
  const drawing = { part: posix.join(posix.dirname(directory), 'drawings', `vmlDrawing${index}.${NOTE_PART.DRAWING_EXTENSION}`), xml: drawingXml(notes, index) };
  const relationship = (id: string, type: string, part: string) =>
    `<Relationship Id="${id}" Type="${type}" Target="${posix.relative(directory, part)}"/>`;
  const relationshipsXml = relationships.replace(
    '</Relationships>',
    relationship(commentsId, NOTE_PART.COMMENTS_RELATIONSHIP, comments.part) +
      relationship(drawingId, NOTE_PART.DRAWING_RELATIONSHIP, drawing.part) +
      '</Relationships>',
  );

  return { sheetXml: withLegacyDrawing(sheetXml, `<legacyDrawing ${prefix}:id="${drawingId}"/>`), relationshipsXml, comments, drawing };
}

/** The sheet with its `legacyDrawing` placed where the schema puts it: after `drawing`, before what follows it. */
function withLegacyDrawing(xml: string, element: string): string {
  const drawing = startTags(xml, 'drawing')[0];
  if (drawing !== undefined) {
    const end = drawing.tag.endsWith('/>') ? drawing.index + drawing.tag.length : xml.indexOf('</drawing>', drawing.index) + '</drawing>'.length;
    return xml.slice(0, end) + element + xml.slice(end);
  }
  const following = AFTER_LEGACY_DRAWING.map((name) => startTags(xml, name)[0]?.index).filter((at): at is number => at !== undefined);
  const at = following.length > 0 ? Math.min(...following) : xml.lastIndexOf('</worksheet>');
  return xml.slice(0, at) + element + xml.slice(at);
}

function commentsXml(notes: readonly SheetNote[], author: string): string {
  const comments = ordered(notes)
    .map((note) => {
      cellBody({ kind: CELL_VALUE_KIND.TEXT, value: note.text }); // refuses what no cell could hold, as a write would
      return `<comment ref="${formatCell(note.cell)}" authorId="0"><text><t xml:space="preserve">${escapeCellText(note.text)}</t></text></comment>`;
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<authors><author>${escapeXml(author)}</author></authors><commentList>${comments}</commentList></comments>`
  );
}

/**
 * The shapes the notes open in. **Excel reads a note's cell from `x:Row` and `x:Column`** and lays its box out again
 * when it shows it; the anchor is where a box first sits, two columns right of its cell, hidden until the cell is
 * pointed at — which is how Excel writes a note nobody has opened.
 */
function drawingXml(notes: readonly SheetNote[], index: number): string {
  const shapes = ordered(notes)
    .map((note, n) => {
      const row = note.cell.row - 1;
      const column = note.cell.column - 1;
      return (
        `<v:shape id="_x0000_s${index * 1024 + n + 1}" type="#_x0000_t202" style="position:absolute;margin-left:0;margin-top:0;` +
        'width:180pt;height:72pt;z-index:1;visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto">' +
        '<v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/>' +
        '<v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox>' +
        '<x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/>' +
        `<x:Anchor>${column + 1}, 15, ${row}, 2, ${column + 4}, 15, ${row + 5}, 2</x:Anchor>` +
        `<x:AutoFill>False</x:AutoFill><x:Row>${row}</x:Row><x:Column>${column}</x:Column></x:ClientData></v:shape>`
      );
    })
    .join('');
  return (
    '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    `<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="${index}"/></o:shapelayout>` +
    '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe">' +
    '<v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>' +
    `${shapes}</xml>`
  );
}

/** Notes in reading order — by row, then column — so one report always writes one part. */
const ordered = (notes: readonly SheetNote[]): readonly SheetNote[] =>
  [...notes].sort((a, b) => a.cell.row - b.cell.row || a.cell.column - b.cell.column);

/** `[Content_Types].xml` declaring a comments part and the VML extension — each once. */
export function withNoteContentTypes(contentTypesXml: string, commentsParts: readonly string[]): string {
  let xml = contentTypesXml;
  const insert = (element: string) => {
    xml = xml.replace('</Types>', `${element}</Types>`);
  };
  if (!startTags(xml, 'Default').some(({ tag }) => attributeOf(tag, 'Extension') === NOTE_PART.DRAWING_EXTENSION)) {
    insert(`<Default Extension="${NOTE_PART.DRAWING_EXTENSION}" ContentType="${NOTE_PART.DRAWING_CONTENT_TYPE}"/>`);
  }
  for (const part of commentsParts) insert(`<Override PartName="/${part}" ContentType="${NOTE_PART.COMMENTS_CONTENT_TYPE}"/>`);
  return xml;
}
