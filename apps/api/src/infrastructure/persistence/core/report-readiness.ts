/**
 * Whether a report's latest validation run left it ready to file (task 41.3; FR-41 item 6; `architecture.md` §12.5.6's
 * task-41 row (2), (h); 182/19) — an SQL predicate over the run row, for the report reads and the period reads alike.
 *
 * **Derived on read, never stored**: the stored status stays the period lock's, and a report reads `ready_to_file` while
 * it is open and its latest run left **nothing outstanding and something resolved or reasoned** — the roll-up's
 * *complete*, read from the counts the run stored. One predicate for both reads, so S-06 and S-05 cannot disagree.
 *
 * `report` is the alias the calling statement gives `core.report`. RLS scopes the run row to the bound tenant, as it
 * does the report it is joined to.
 */
export const readyToFileOf = (report: string): string =>
  `EXISTS (SELECT 1 FROM core.validation_run vr
             WHERE vr.report_id = ${report}.id AND vr.organization_id = ${report}.organization_id
               AND vr.outstanding = 0 AND vr.resolved + vr.reasoned > 0)`;
