import type { CalcFactorSource, CalcSite } from '@easyesg/contracts';
import type { SheetRow } from '@/client/spreadsheet/sheet-cells';
import { IMPORT_FIELD, proposeColumns, tableOf, type ColumnChoice, type ImportField, type ImportTable } from './import-columns';
import { planImport, type ImportPlan } from './import-plan';
import { chosenColumns, chosenOption, type ColumnChoices, type ValueChoices } from './import-state';
import { distinctValues, MATCHED_FIELDS, proposeOption, type ImportOption, type MatchedField } from './import-values';

/**
 * Everything the mapping arm shows, from one sheet and the reporter's choices (task 204.2; FR-211): the table, the
 * column each field reads, each value's match, and the plan the report and the import button both read — computed
 * once, so the selects, the report and the count on the button cannot disagree.
 *
 * **A value is listed only for a column the import reads**, and a site's only where the report holds more than one —
 * the one site takes every line otherwise. **A value is `decided`** where the reporter matched it, *none* included, or
 * the panel could propose a match; an undecided one shows its select's placeholder, and its rows are reported as
 * unmatched until it is decided.
 */
export interface ValueMatch {
  readonly value: string;
  readonly option: string | null;
  readonly decided: boolean;
}

export interface ImportView {
  readonly table: ImportTable | null;
  readonly columns: ColumnChoice;
  readonly matches: Readonly<Record<MatchedField, readonly ValueMatch[]>>;
  readonly plan: ImportPlan;
}

export function importView(input: {
  readonly rows: readonly SheetRow[];
  readonly chosen: { readonly columns: ColumnChoices; readonly values: ValueChoices };
  readonly words: Readonly<Record<ImportField, readonly string[]>>;
  readonly options: Readonly<Record<MatchedField, readonly ImportOption[]>>;
  readonly sources: readonly CalcFactorSource[];
  readonly sites: readonly CalcSite[];
}): ImportView {
  const table = tableOf(input.rows);
  const proposed = proposeColumns({ headers: table?.headers ?? [], words: input.words, sites: input.sites.length });
  const columns = chosenColumns({ proposed, chosen: input.chosen.columns });

  const matchesOf = (field: MatchedField): ValueMatch[] => {
    const column = columns[field];
    if (table === null || column === null || (field === IMPORT_FIELD.SITE && input.sites.length <= 1)) return [];
    return distinctValues({ table, column }).map((value) => {
      const chosen = input.chosen.values[field]?.[value];
      const proposal = proposeOption({ value, options: input.options[field], byCode: field !== IMPORT_FIELD.SITE });
      return {
        value,
        option: chosenOption({ values: input.chosen.values, field, value, proposed: proposal }),
        decided: chosen !== undefined || proposal !== null,
      };
    });
  };
  const matches = {
    [IMPORT_FIELD.SOURCE]: matchesOf(IMPORT_FIELD.SOURCE),
    [IMPORT_FIELD.UNIT]: matchesOf(IMPORT_FIELD.UNIT),
    [IMPORT_FIELD.SITE]: matchesOf(IMPORT_FIELD.SITE),
  };
  const lookup = new Map(
    MATCHED_FIELDS.map((field) => [field, new Map(matches[field].map((match) => [match.value, match.option]))]),
  );

  return {
    table,
    columns,
    matches,
    plan: planImport({
      table,
      columns,
      matched: ({ field, value }) => lookup.get(field)?.get(value) ?? null,
      sources: input.sources,
      sites: input.sites,
    }),
  };
}
