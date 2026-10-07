import type { CalcFactorSource } from '@easyesg/contracts';
import { cellIn, IMPORT_FIELD, type ImportTable } from './import-columns';
import { holdsWords, matchText } from './import-text';

/**
 * Each value the source, unit and site columns hold, matched once to one of the calculator's own (task 204.2;
 * FR-211; `architecture.md` §12.5.6's task-204 row (2)) — so a sheet that says `Gaz` or `mc` is matched by the
 * reporter in one choice, however many rows say it, and needs no renaming.
 *
 * **A value is its cell's text, exactly**: two spellings are two values, each matched once, because a reporter who
 * wrote both may have meant two things. **An option is proposed only where the value reads as one**: its name in the
 * reporter's language, or — for a source and a unit — its code, which is how an export from another tool may write
 * it. Failing that, the one option whose name holds the value as whole words, or whose words the value holds — and
 * only where exactly one does: `Gaz` against three gas sources proposes nothing, which is right, because guessing
 * would put a row on the wrong line with nothing on screen saying so. A site is never proposed by its code: its code
 * is a position, and a cell saying `1` would land on the *second* site.
 */
export const MATCHED_FIELDS = [IMPORT_FIELD.SOURCE, IMPORT_FIELD.UNIT, IMPORT_FIELD.SITE] as const;
export type MatchedField = (typeof MATCHED_FIELDS)[number];

export interface ImportOption {
  /** What the line carries: a source's key, a unit's code, a site's ordinal as text. */
  readonly value: string;
  /** What the reporter reads: the name S-09 shows. */
  readonly label: string;
}

/** The values a column holds, each once, in the order they first appear. */
export function distinctValues(input: { readonly table: ImportTable; readonly column: number }): string[] {
  const seen = new Set<string>();
  for (const row of input.table.rows) {
    const value = cellIn({ row, column: input.column });
    if (value !== null) seen.add(value);
  }
  return [...seen];
}

export function proposeOption(input: {
  readonly value: string;
  readonly options: readonly ImportOption[];
  /** Whether an option's code may match — a source's or a unit's may; a site's, a position, may not. */
  readonly byCode: boolean;
}): string | null {
  const value = matchText(input.value);
  if (value === '') return null;
  const exact = input.options.find(
    (option) => matchText(option.label) === value || (input.byCode && matchText(option.value) === value),
  );
  if (exact !== undefined) return exact.value;
  const near = input.options.filter((option) => {
    const label = matchText(option.label);
    return holdsWords({ text: label, phrase: value }) || holdsWords({ text: value, phrase: label });
  });
  return near.length === 1 ? near[0].value : null;
}

/**
 * Every unit the factor set admits, each once, in the order its sources name them — what a unit value may be matched
 * to. Whether a row's own source admits the unit is the plan's question, asked per row.
 */
export const unitsOf = (sources: readonly CalcFactorSource[]): string[] => [
  ...new Set(sources.flatMap((source) => source.units)),
];
