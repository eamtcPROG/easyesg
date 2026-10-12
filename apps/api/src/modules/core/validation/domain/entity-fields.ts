import { ENTITY_FIELD, type FieldValue } from '@easyesg/validation';

/** The module the template asks for the undertaking's identifier in (row (1)): B1, its basis for preparation. */
const IDENTIFIER_MODULE = 'B1';

/**
 * **The report's scope, with the fields the entity's record answers** (task 210; FR-16 behaviour 6; `architecture.md`
 * §12.5.6's task-210 row (1), (g)) — each placed in B1, so the roll-up counts it there and S-08 lists a finding on it
 * there, as it would a disclosure field's.
 *
 * **Only where the report lists B1**, which every report does today (FR-177): a field placed in a module the report
 * does not list would be counted in the report and in no module, and the two would disagree.
 *
 * The run, the read and the browser's rules each widen the scope by this one function, so a finding the run raised is
 * never dropped by a read for having left a scope it was never in (182/26).
 */
export function withEntityFields(input: {
  readonly scope: ReadonlyMap<string, readonly string[]>;
  /** The modules the report lists — the roll-up's, waiting ones included. */
  readonly modules: readonly string[];
}): ReadonlyMap<string, readonly string[]> {
  if (!input.modules.includes(IDENTIFIER_MODULE)) return input.scope;
  return new Map([...input.scope, [ENTITY_FIELD.IDNO, [IDENTIFIER_MODULE]]]);
}

/**
 * **What the entity's record answers, as rows the interpreter reads** — the IDNO where the entity holds one, at the
 * field's only address. None where it holds none: an unanswered field is a missing row, as a disclosure's is.
 */
export function entityFieldValues(input: { readonly idno: string | null }): readonly FieldValue[] {
  return input.idno === null ? [] : [{ elementKey: ENTITY_FIELD.IDNO, dimensionKey: '', ordinal: 0, valueText: input.idno }];
}
