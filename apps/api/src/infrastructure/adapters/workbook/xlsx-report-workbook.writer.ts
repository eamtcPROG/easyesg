import { Injectable } from '@nestjs/common';
import { type CellNote, CELL_VALUE_KIND, type CellWrite, patchWorkbook } from '@easyesg/xlsx-patch';
import type { DigitalTemplate } from '@api/contracts/digital-template-registry.port';
import { offsetCell, TEMPLATE_NOTES } from '@api/contracts/digital-template-map';
import type { ReportWorkbook, ReportWorkbookWriter, WorkbookNote } from '@api/contracts/report-workbook.port';
import { documentWords } from '../document/document-words';
import { workbookNoteText } from './workbook-note-text';

/**
 * The application the file names as its writer (`docProps/app.xml`), and the author of its cell notes — the platform,
 * which is true, and which is what makes LibreOffice compute the template's formulas on open (`architecture.md`
 * §12.5.6's task-46 row (4)). A product name rather than a word, so it is not a catalogue's.
 */
const WORKBOOK_APPLICATION = 'EasyESG';

/** Two notes on one figure read as one footnote, sentence after sentence. */
const SENTENCE = ' ';

/**
 * `REPORT_WORKBOOK_WRITER` over `@easyesg/xlsx-patch` (task 46; FR-50, AD-10): the report's values written into the
 * template's own cells, its notes worded in the export's language and laid out as the template permits —
 * **footnote rows on EFRAG's Footnotes sheet** where it has one (`1.3.0`, task-46 row (2)), each naming its element from
 * EFRAG's own list and its dimension, the notes on one figure joined into one; **a cell note on the figure's cell**
 * where it has none (`1.2.0`, row (9)) — and the file's own facts as its document properties (rows (4), (7)).
 *
 * Synchronous and stateless: the patch is CPU over bytes in hand, a fraction of a second for a full report.
 */
@Injectable()
export class XlsxReportWorkbookWriter implements ReportWorkbookWriter {
  write(input: { readonly template: DigitalTemplate; readonly workbook: ReportWorkbook }): Uint8Array {
    const { template, workbook } = input;
    const words = documentWords(workbook.facts.locale);
    const worded = workbook.notes.map((note) => ({ note, text: workbookNoteText(note.says, words) })).filter(({ text }) => text !== '');

    const footnotes: CellWrite[] = [];
    const notes: CellNote[] = [];
    if (template.map.notes.kind === TEMPLATE_NOTES.FOOTNOTES) {
      const { text, dimension, concept, labels, rowsPerNote, capacity } = template.map.notes;
      const blocks = footnoteBlocks(perFigure(worded), rowsPerNote);
      if (blocks.length > capacity) {
        throw new Error(`template ${template.version}'s Footnotes sheet holds ${capacity} footnotes, and the report needs ${blocks.length}`);
      }
      blocks.forEach((block, index) => {
        const first = index * rowsPerNote;
        footnotes.push({ at: offsetCell(text, { row: first }), value: { kind: CELL_VALUE_KIND.TEXT, value: block.text } });
        block.figures.forEach((figure, line) => {
          const label = labels[figure.element];
          if (label === undefined) throw new Error(`EFRAG's footnote list in ${template.version} names no cell for ${figure.element}`);
          footnotes.push({ at: offsetCell(concept, { row: first + line }), value: { kind: CELL_VALUE_KIND.TEXT, value: label } });
          if (figure.dimension !== '') {
            footnotes.push({ at: offsetCell(dimension, { row: first + line }), value: { kind: CELL_VALUE_KIND.TEXT, value: figure.dimension } });
          }
        });
      });
    } else {
      notes.push(...worded.map(({ note, text: sentence }) => ({ at: note.at, text: sentence })));
    }

    return patchWorkbook({
      template: template.content,
      writes: [...workbook.writes, ...footnotes],
      notes,
      noteAuthor: WORKBOOK_APPLICATION,
      properties: {
        application: WORKBOOK_APPLICATION,
        language: workbook.facts.locale,
        modified: workbook.facts.generatedAt,
        ...(workbook.facts.generatedBy === null ? {} : { lastModifiedBy: workbook.facts.generatedBy }),
      },
    });
  }
}

/**
 * EFRAG's footnotes: **one per distinct text, naming every figure it explains** — up to a block's rows each, a longer
 * list continued in the next block — so the factor set both B3 scopes were calculated with is one footnote, as a reader
 * of the sheet would write it.
 */
function footnoteBlocks(
  figures: readonly { readonly note: WorkbookNote; readonly text: string }[],
  rowsPerNote: number,
): { text: string; figures: Pick<WorkbookNote, 'element' | 'dimension'>[] }[] {
  const byText = new Map<string, Pick<WorkbookNote, 'element' | 'dimension'>[]>();
  for (const { note, text } of figures) byText.set(text, [...(byText.get(text) ?? []), { element: note.element, dimension: note.dimension }]);
  return [...byText].flatMap(([text, explained]) =>
    Array.from({ length: Math.ceil(explained.length / rowsPerNote) }, (_, block) => ({
      text,
      figures: explained.slice(block * rowsPerNote, (block + 1) * rowsPerNote),
    })),
  );
}

/** One note per figure — its element and dimension — its notes' sentences in the order they were made. */
function perFigure(worded: readonly { readonly note: WorkbookNote; readonly text: string }[]): { note: WorkbookNote; text: string }[] {
  const byFigure = new Map<string, { note: WorkbookNote; text: string }>();
  for (const entry of worded) {
    const key = `${entry.note.element}|${entry.note.dimension}`;
    const earlier = byFigure.get(key);
    byFigure.set(key, earlier === undefined ? { ...entry } : { note: earlier.note, text: `${earlier.text}${SENTENCE}${entry.text}` });
  }
  return [...byFigure.values()];
}
