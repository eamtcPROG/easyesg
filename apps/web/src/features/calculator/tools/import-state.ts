import type { SpreadsheetRefusal } from '@/client/spreadsheet/read-spreadsheet';
import type { Sheet } from '@/client/spreadsheet/sheet-cells';
import { IMPORT_FIELD, type ColumnChoice, type ImportField } from './import-columns';
import { MATCHED_FIELDS, type MatchedField } from './import-values';

/**
 * The spreadsheet import's own state on S-09 (task 204.2; FR-211): choosing a file, reading it, then mapping the
 * sheet — and in the last, **only what the reporter chose**. What the panel proposes for a column or a value is
 * derived from what was read, every render, and a choice is laid over it (`chosenColumns`, `chosenOption`); stored,
 * a proposal would have to be recomputed and rewritten whenever what it depends on moved.
 *
 * **A reducer, because one event moves several values**: choosing another sheet forgets every column and value chosen
 * for the last, and naming a column forgets the values matched from the column it replaced — the values belong to the
 * column, and a match made for `Gaz` in one column is not a decision about another's. **A read that arrives after
 * the reporter has moved on is dropped**: only a file still being read can be read.
 */
export const IMPORT_STAGE = { CHOOSING: 'choosing', READING: 'reading', MAPPING: 'mapping' } as const;

export type ColumnChoices = Readonly<Partial<Record<ImportField, number | null>>>;
export type ValueChoices = Readonly<Partial<Record<MatchedField, Readonly<Record<string, string | null>>>>>;

export type ImportState =
  | {
      readonly stage: typeof IMPORT_STAGE.CHOOSING;
      /** Why the last file chosen was refused, until another is chosen. */
      readonly refusal: SpreadsheetRefusal | null;
    }
  | { readonly stage: typeof IMPORT_STAGE.READING; readonly fileName: string }
  | {
      readonly stage: typeof IMPORT_STAGE.MAPPING;
      readonly fileName: string;
      readonly sheets: readonly Sheet[];
      /** The sheet read, by its position in the workbook. */
      readonly sheet: number;
      readonly columns: ColumnChoices;
      readonly values: ValueChoices;
    };

export const IMPORT_EVENT = {
  FILE_CHOSEN: 'file_chosen',
  FILE_READ: 'file_read',
  FILE_REFUSED: 'file_refused',
  SHEET_CHOSEN: 'sheet_chosen',
  COLUMN_CHOSEN: 'column_chosen',
  VALUE_MATCHED: 'value_matched',
  ANOTHER_FILE: 'another_file',
} as const;

export type ImportEvent =
  | { readonly type: typeof IMPORT_EVENT.FILE_CHOSEN; readonly fileName: string }
  | { readonly type: typeof IMPORT_EVENT.FILE_READ; readonly sheets: readonly Sheet[] }
  | { readonly type: typeof IMPORT_EVENT.FILE_REFUSED; readonly refusal: SpreadsheetRefusal }
  | { readonly type: typeof IMPORT_EVENT.SHEET_CHOSEN; readonly sheet: number }
  | { readonly type: typeof IMPORT_EVENT.COLUMN_CHOSEN; readonly field: ImportField; readonly column: number | null }
  | {
      readonly type: typeof IMPORT_EVENT.VALUE_MATCHED;
      readonly field: MatchedField;
      readonly value: string;
      readonly option: string | null;
    }
  | { readonly type: typeof IMPORT_EVENT.ANOTHER_FILE };

export const INITIAL_IMPORT_STATE: ImportState = { stage: IMPORT_STAGE.CHOOSING, refusal: null };

const isMatchedField = (field: ImportField): field is MatchedField =>
  MATCHED_FIELDS.some((matched) => matched === field);

export function importReducer(state: ImportState, event: ImportEvent): ImportState {
  switch (event.type) {
    case IMPORT_EVENT.FILE_CHOSEN:
      return { stage: IMPORT_STAGE.READING, fileName: event.fileName };
    case IMPORT_EVENT.FILE_READ:
      return state.stage === IMPORT_STAGE.READING
        ? { stage: IMPORT_STAGE.MAPPING, fileName: state.fileName, sheets: event.sheets, sheet: 0, columns: {}, values: {} }
        : state;
    case IMPORT_EVENT.FILE_REFUSED:
      return state.stage === IMPORT_STAGE.READING ? { stage: IMPORT_STAGE.CHOOSING, refusal: event.refusal } : state;
    case IMPORT_EVENT.ANOTHER_FILE:
      return INITIAL_IMPORT_STATE;
    default:
      return state.stage === IMPORT_STAGE.MAPPING ? mapped(state, event) : state;
  }
}

type Mapping = Extract<ImportState, { readonly stage: typeof IMPORT_STAGE.MAPPING }>;
type MappingEvent = Extract<
  ImportEvent,
  { readonly type: typeof IMPORT_EVENT.SHEET_CHOSEN | typeof IMPORT_EVENT.COLUMN_CHOSEN | typeof IMPORT_EVENT.VALUE_MATCHED }
>;

function mapped(state: Mapping, event: MappingEvent): Mapping {
  switch (event.type) {
    case IMPORT_EVENT.SHEET_CHOSEN:
      return event.sheet === state.sheet ? state : { ...state, sheet: event.sheet, columns: {}, values: {} };
    case IMPORT_EVENT.COLUMN_CHOSEN:
      return {
        ...state,
        columns: { ...state.columns, [event.field]: event.column },
        values: isMatchedField(event.field) ? { ...state.values, [event.field]: {} } : state.values,
      };
    case IMPORT_EVENT.VALUE_MATCHED:
      return {
        ...state,
        values: { ...state.values, [event.field]: { ...state.values[event.field], [event.value]: event.option } },
      };
  }
}

// A choice of *no column* is a choice — `null` overrides a proposal, where an absent choice leaves it standing.
const pick = (input: { readonly proposed: ColumnChoice; readonly chosen: ColumnChoices }, field: ImportField) => {
  const chosen = input.chosen[field];
  return chosen === undefined ? input.proposed[field] : chosen;
};

/** The column each field reads: the reporter's choice where they made one, the proposal otherwise. */
export const chosenColumns = (input: {
  readonly proposed: ColumnChoice;
  readonly chosen: ColumnChoices;
}): ColumnChoice => ({
  [IMPORT_FIELD.SOURCE]: pick(input, IMPORT_FIELD.SOURCE),
  [IMPORT_FIELD.FIGURE]: pick(input, IMPORT_FIELD.FIGURE),
  [IMPORT_FIELD.UNIT]: pick(input, IMPORT_FIELD.UNIT),
  [IMPORT_FIELD.SITE]: pick(input, IMPORT_FIELD.SITE),
  [IMPORT_FIELD.DESCRIPTION]: pick(input, IMPORT_FIELD.DESCRIPTION),
});

/** The option a value is matched to: the reporter's choice where they made one — *none* included — the proposal otherwise. */
export function chosenOption(input: {
  readonly values: ValueChoices;
  readonly field: MatchedField;
  readonly value: string;
  readonly proposed: string | null;
}): string | null {
  const chosen = input.values[input.field]?.[input.value];
  return chosen === undefined ? input.proposed : chosen;
}
