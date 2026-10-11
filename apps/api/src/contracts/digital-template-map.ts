/**
 * Where the Excel export writes each value of a report into one EFRAG Digital Template release (task 46.1; FR-50,
 * AD-4; `architecture.md` §12.5.6's task-46 row (1)) — the `vsme_digital_template_map` artefact's shape.
 *
 * **Configuration, generated from the binary** by `tools/extract-vsme-template-map.mjs`: EFRAG names an element's
 * cells after the element, offers its choices as the English strings of its dropdowns, and computes some figures by
 * formula, and the map is that read once and checked. An EFRAG release is a new map, not a code change.
 *
 * In the port surface because `platform/taxonomy` reads it from the store and `core/export` interprets it, and the two
 * may not import each other.
 */
import type { CellTarget } from '@easyesg/xlsx-patch';

/**
 * A cell of the template: a defined name with an offset into its range, or a sheet and an A1 address — the package's
 * own target, so what the map names is what a patch writes. The artefact spells it without the `kind`, which its reader
 * supplies from the shape.
 */
export type TemplateCell = CellTarget;

/** How a value is written in a template cell. */
export const TEMPLATE_ENCODING = {
  NUMBER: 'number',
  TEXT: 'text',
  /** A TRUE/FALSE cell — what the template's checkboxes and its `OR(x=TRUE,x=FALSE)` validations hold. */
  BOOLEAN: 'boolean',
  /** A yes/no written as EFRAG's own words — its `YES`/`NO` dropdown. */
  WORDS: 'words',
  /** A member written as the string EFRAG's dropdown holds for it, from one of the map's `lists`. */
  LIST: 'list',
} as const;

export type TemplateEncoding =
  | { readonly as: typeof TEMPLATE_ENCODING.NUMBER }
  | { readonly as: typeof TEMPLATE_ENCODING.TEXT }
  | { readonly as: typeof TEMPLATE_ENCODING.BOOLEAN }
  | { readonly as: typeof TEMPLATE_ENCODING.WORDS; readonly true: string; readonly false: string }
  | { readonly as: typeof TEMPLATE_ENCODING.LIST; readonly list: string };

/** The cell a figure's unit is chosen in, and the list naming each unit code's string. */
export interface TemplateUnit {
  readonly at: TemplateCell;
  readonly list: string;
  /** One unit per table row — B7's waste and materials — rather than one cell for every figure that names it. */
  readonly perRow: boolean;
}

/** Where one element's values go. */
export const TEMPLATE_PLACEMENT = {
  /** One cell. */
  CELL: 'cell',
  /** One cell per member of a breakdown, or the undimensioned figure of B3's reporting scopes (`''`). */
  MEMBERS: 'members',
  /** One cell per row of a table — a typed axis's rows, or a classification's. */
  ROWS: 'rows',
  /** An enumeration set as a column of rows, one member each — B1's NACE codes. */
  LIST: 'list',
  /** An enumeration set as a row of yes/no columns, one per member — B2's sustainability issues. */
  COLUMNS: 'columns',
  /** B1's omitted disclosures, which the template computes from its ToC checkboxes (FR-31). */
  OMISSION: 'omission',
  /** A figure the template computes by formula (182/32): written by nobody. */
  COMPUTED: 'computed',
} as const;

export type TemplatePlacement =
  | {
      readonly kind: typeof TEMPLATE_PLACEMENT.CELL;
      readonly at: TemplateCell;
      readonly encoding: TemplateEncoding;
      readonly unit: TemplateUnit | null;
    }
  | {
      readonly kind: typeof TEMPLATE_PLACEMENT.MEMBERS;
      /** Every member's cell, keyed by the dimension the store holds — a computed member's too, for its note. */
      readonly cells: Readonly<Record<string, TemplateCell>>;
      /** The members whose cell the template computes. */
      readonly computed: readonly string[];
      /** Whether the platform derives the figure from the very inputs the export writes (task-46 row (3)). */
      readonly derived: boolean;
      readonly encoding: TemplateEncoding;
    }
  | {
      readonly kind: typeof TEMPLATE_PLACEMENT.ROWS;
      /** The table — one of the map's `groups` — whose rows this element's column runs down. */
      readonly group: string;
      /** The element's column: its first row is the table's first. */
      readonly at: TemplateCell;
      readonly encoding: TemplateEncoding;
      readonly unit: TemplateUnit | null;
    }
  | {
      readonly kind: typeof TEMPLATE_PLACEMENT.LIST;
      readonly at: TemplateCell;
      readonly rows: number;
      readonly encoding: TemplateEncoding;
    }
  | {
      readonly kind: typeof TEMPLATE_PLACEMENT.COLUMNS;
      readonly at: TemplateCell;
      /** Each member's column, counted from the range's first. */
      readonly columns: Readonly<Record<string, number>>;
      readonly encoding: TemplateEncoding;
    }
  | { readonly kind: typeof TEMPLATE_PLACEMENT.OMISSION }
  | {
      readonly kind: typeof TEMPLATE_PLACEMENT.COMPUTED;
      /** The computed cell — or, with `group`, the first of its column — which a cell note is attached to. */
      readonly at: TemplateCell;
      readonly group?: string;
      readonly derived: boolean;
      /** The unit cell the template's own computation reads, where the export answers it — B7's hazardous mass total. */
      readonly unit?: TemplateUnit;
    };

/** How a table's rows are given out. */
export const TEMPLATE_GROUP = {
  /** One row per ordinal, the template's own ID already in its key column — B1's sites, subsidiaries, B7's materials. */
  ORDINAL: 'ordinal',
  /** Rows filled from the top, each keyed by the ordinal it describes, counted from 1 — B5's sites. */
  KEYED: 'keyed',
  /** Rows filled from the top, each keyed by its member's string in the template's list — pollutants, waste, countries. */
  CLASSIFIED: 'classified',
} as const;

export type TemplateGroup =
  | { readonly kind: typeof TEMPLATE_GROUP.ORDINAL; readonly axis: string; readonly rows: number }
  | { readonly kind: typeof TEMPLATE_GROUP.KEYED; readonly axis: string; readonly key: TemplateCell; readonly rows: number }
  | {
      readonly kind: typeof TEMPLATE_GROUP.CLASSIFIED;
      readonly axis: string;
      readonly member: TemplateCell;
      readonly list: string;
      readonly rows: number;
      /** A prefix that qualifies a member stored bare to the list's key — `country:` before B8's `MD`. */
      readonly qualify?: string;
    };

/** Where a note goes (task-46 rows (2), (9)). */
export const TEMPLATE_NOTES = {
  /** EFRAG's own Footnotes sheet — `1.3.0`. */
  FOOTNOTES: 'footnotes',
  /** An Excel cell note on the figure's cell — a template with no Footnotes sheet, `1.2.0`. */
  CELL_NOTES: 'cell_notes',
} as const;

export type TemplateNotes =
  | {
      readonly kind: typeof TEMPLATE_NOTES.FOOTNOTES;
      /**
       * The Footnotes sheet's three columns. **A footnote is a block of rows**: its text one merged cell at the block's
       * first row, and the cells it explains one per row beside it, each by its element and its dimension.
       */
      readonly text: TemplateCell;
      readonly dimension: TemplateCell;
      readonly concept: TemplateCell;
      /** How many rows one footnote's block spans — how many cells one footnote may explain. */
      readonly rowsPerNote: number;
      /** How many footnotes the sheet holds. */
      readonly capacity: number;
      /** Each element's entry in EFRAG's own list of the cells a footnote may be associated with. */
      readonly labels: Readonly<Record<string, string>>;
    }
  | { readonly kind: typeof TEMPLATE_NOTES.CELL_NOTES };

/**
 * How the template's own yes/no before a group is answered from the group's elements. **The question decides, not the
 * cell**: *has the undertaking obtained a certification* is answered by a description being held, while *does it have
 * sites in or near a biodiversity-sensitive area* is answered by what the per-site answers say — a report holding *no*
 * for every site must not tick *yes*. A gate no report affirms is left as EFRAG ships it.
 */
export const TEMPLATE_GATE = {
  /** Yes when the report holds any of the group's elements — holding them is the answer. */
  HELD: 'held',
  /** Yes when one of the group's held answers affirms the question: a yes, or a figure above zero. */
  AFFIRMED: 'affirmed',
  /** Yes when the group's elements are held for more than one member — B8's *more than one country*. */
  SEVERAL: 'several',
} as const;

export type TemplateGateAnswer = (typeof TEMPLATE_GATE)[keyof typeof TEMPLATE_GATE];

/** One of the template's own yes/no questions, the elements that answer it, and how they do. */
export interface TemplateGate {
  readonly at: TemplateCell;
  readonly when: readonly string[];
  readonly answer: TemplateGateAnswer;
}

/** A report day as the template asks it: a year, a month and a day, each a cell. */
export interface TemplateDay {
  readonly year: TemplateCell;
  readonly month: TemplateCell;
  readonly day: TemplateCell;
}

export interface DigitalTemplateMap {
  readonly templateVersion: string;
  readonly taxonomyVersion: string;
  /** The binary the map was read from — its file under `config/efrag/<version>/` and its SHA-256. */
  readonly template: { readonly file: string; readonly sha256: string };
  /** The language cell, and the entry that selects EFRAG's official English (182/31). */
  readonly language: { readonly at: TemplateCell; readonly value: string };
  /** The report's own block, which no taxonomy element names. */
  readonly report: {
    readonly entityName: TemplateCell;
    readonly identifierScheme: TemplateCell;
    readonly identifier: TemplateCell;
    /** The scheme's spelling of an LEI in EFRAG's list — an IDNO has none (task-46 row (5)). */
    readonly leiScheme: string;
    readonly currency: TemplateCell;
    readonly periodStart: TemplateDay;
    readonly periodEnd: TemplateDay;
  };
  readonly notes: TemplateNotes;
  /** Each element the Basic Module's export places. */
  readonly elements: Readonly<Record<string, TemplatePlacement>>;
  readonly groups: Readonly<Record<string, TemplateGroup>>;
  /** Each derivation input's cell (task 36.10), which the template's own formula reads. */
  readonly inputs: Readonly<Record<string, TemplateCell>>;
  /** The template's own yes/no questions before a group, each answered from the group's elements as it says. */
  readonly gates: readonly TemplateGate[];
  /** Each member of B1's omission domain, to the ToC checkboxes it sets (FR-31). */
  readonly omission: Readonly<Record<string, readonly TemplateCell[]>>;
  /** Each list a member is written through: the member, or unit code, to EFRAG's string. */
  readonly lists: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/**
 * A cell of a named range by its offset into the range — a table's row, a set's column. **Only a name has a range to
 * offset into**: an address names one cell, and an offset from it would be a cell the map never named, so it throws.
 */
export function offsetCell(at: TemplateCell, offset: { readonly row?: number; readonly column?: number }): TemplateCell {
  if (!('name' in at)) throw new Error(`${at.sheet}!${at.cell} names one cell, which has no rows or columns to offset into`);
  return {
    ...at,
    ...(offset.row === undefined ? {} : { row: (at.row ?? 0) + offset.row }),
    ...(offset.column === undefined ? {} : { column: (at.column ?? 0) + offset.column }),
  };
}
