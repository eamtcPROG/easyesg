import type { Locale } from '@easyesg/i18n';
import type { CellValue } from '@easyesg/xlsx-patch';
import type { DigitalTemplate } from './digital-template-registry.port';
import type { TemplateCell } from './digital-template-map';

/**
 * The report as the EFRAG Digital Template takes it — every value and the cell it goes in, every note and what it says
 * — and the port that writes it into the template (task 46; FR-50, AD-10; `architecture.md` §12.5.6's task-46 row).
 *
 * **The model is decided, the file is written.** `core/export` assembles it from the report and the template's map
 * (`assembleReportWorkbook`), so where a value goes and when a figure needs a note is one pure function with its cases;
 * the adapter words each note in the export's language and patches the template (`@easyesg/xlsx-patch`), laying a note
 * out as the template permits — a footnote row on `1.3.0`, a cell note on `1.2.0` (task-46 rows (2), (9)).
 *
 * In the port surface because `core/export` and the adapter at the edge both read it, as `report-document.port.ts` is.
 */
export const REPORT_WORKBOOK_WRITER = Symbol('REPORT_WORKBOOK_WRITER');

export interface ReportWorkbookWriter {
  /** The template with the report written into it — a new array; the template's bytes are not modified. */
  write(input: { readonly template: DigitalTemplate; readonly workbook: ReportWorkbook }): Uint8Array;
}

/** One value and its cell. */
export interface WorkbookWrite {
  readonly at: TemplateCell;
  readonly value: CellValue;
}

/** What one note says, by the kind of thing it is — worded by the adapter in the export's language. */
export const WORKBOOK_NOTE = {
  /** UX-43's company estimate: the undertaking's figure, the one it replaced, the reason and the person (FR-36). */
  OVERRIDE: 'override',
  /** FR-32's deliberate non-answer, with its reason — the template has no state for it (task-46 row (2)). */
  NOT_AVAILABLE: 'not_available',
  /** An unresolved finding on the field, by its *what happened* (FR-44, NFR-79). */
  FINDING: 'finding',
  /** The undertaking's own figure for one the template computes by its own formula (task-46 row (3)). */
  OWN_FIGURE: 'own_figure',
  /** A figure written in another unit than it was stored in, because the cell's unit governs others (row (6)). */
  CONVERTED: 'converted',
  /** A figure stored with no unit, written beside a unit chosen for the others the cell governs. */
  NO_UNIT: 'no_unit',
  /** A second figure for one row, where the template has one cell for the two — B7's mass beside a volume. */
  ALSO: 'also',
  /** Members of a set the template's list has no entry for — B1's unchanged sections (row (3)). */
  NOT_LISTED: 'not_listed',
  /** The emission factor set a calculated figure was computed with (NFR-22; row (7)). */
  FACTOR_SET: 'factor_set',
  /** Task 46.3's statement: the wording in this language is the platform's own, with no EFRAG standing (T-14). */
  LABELS: 'labels',
} as const;

/** A figure as a note quotes it: the decimal stored, the places it is shown to, and its unit's code. */
export interface NotedFigure {
  readonly value: string;
  readonly places: number | null;
  readonly unit: string | null;
}

export type WorkbookNoteText =
  | {
      readonly kind: typeof WORKBOOK_NOTE.OVERRIDE;
      readonly figure: NotedFigure;
      readonly superseded: string | null;
      readonly reason: string | null;
      readonly person: string | null;
    }
  | { readonly kind: typeof WORKBOOK_NOTE.NOT_AVAILABLE; readonly reason: string | null }
  | { readonly kind: typeof WORKBOOK_NOTE.FINDING; readonly message: string; readonly params: Readonly<Record<string, string>> }
  | { readonly kind: typeof WORKBOOK_NOTE.OWN_FIGURE; readonly figure: NotedFigure }
  | { readonly kind: typeof WORKBOOK_NOTE.CONVERTED; readonly figure: NotedFigure; readonly written: string }
  | { readonly kind: typeof WORKBOOK_NOTE.NO_UNIT; readonly figure: NotedFigure }
  | { readonly kind: typeof WORKBOOK_NOTE.ALSO; readonly figure: NotedFigure }
  | { readonly kind: typeof WORKBOOK_NOTE.NOT_LISTED; readonly members: readonly string[] }
  | { readonly kind: typeof WORKBOOK_NOTE.FACTOR_SET; readonly label: string }
  | { readonly kind: typeof WORKBOOK_NOTE.LABELS };

/**
 * One note on one figure: the element and the dimension it belongs to — what a footnote names — and the cell the figure
 * occupies, which a cell note is attached to.
 */
export interface WorkbookNote {
  readonly element: string;
  /** The member's key, a typed row's identifier, or `''` for an undimensioned figure. */
  readonly dimension: string;
  readonly at: TemplateCell;
  readonly says: WorkbookNoteText;
}

/** The file's own facts (NFR-22; task-46 row (7)): its language, when it was made and for whom. */
export interface WorkbookFacts {
  readonly locale: Locale;
  readonly generatedAt: Date;
  /** The person who asked, by the name they are shown under (UX-137) — `null` where the account is gone. */
  readonly generatedBy: string | null;
}

export interface ReportWorkbook {
  readonly writes: readonly WorkbookWrite[];
  readonly notes: readonly WorkbookNote[];
  readonly facts: WorkbookFacts;
}
