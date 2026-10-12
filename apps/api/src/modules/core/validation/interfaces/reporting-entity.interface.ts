/**
 * The reporting entity's IDNO, by the report (task 210; FR-16 behaviour 6; `architecture.md` §12.5.6's task-210 row) —
 * the field the entity's record answers for a run, which a rule requires as it requires an answer.
 *
 * **The entity as it stands, never the period's snapshot** (row (a)): the Excel export writes the entity's own
 * identifiers (task 46.1), so the rule says whether the file a bank opens carries one — and the snapshot holds none.
 */
export interface ReportingEntityRecord {
  /** The IDNO of the report's entity — `null` where it holds none, or where there is no such report in the bound organization. */
  idnoOf(query: { readonly reportId: string }): Promise<string | null>;
}

export const REPORTING_ENTITY_RECORD = Symbol('REPORTING_ENTITY_RECORD');
