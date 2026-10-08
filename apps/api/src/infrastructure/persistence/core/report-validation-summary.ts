/**
 * What a report's latest validation run came to, as S-06 and S-05 draw it (task 42.2; FR-23 AC-7, FR-25 AC-3;
 * `architecture.md` §12.5.6's task-42 row (f)) — an SQL expression over the run row and its module rows, for the report
 * reads and the period reads alike, beside `readyToFileOf`.
 *
 * **A JSON object or `NULL`**: how many modules the run listed (`modulesCounted` — every module asked and not omitted,
 * waiting ones included, the roll-up's own list, task-41 row (h)), how many of them it found complete — nothing
 * outstanding and something resolved or reasoned, the roll-up's *complete* — and how many fields it left outstanding;
 * `NULL` where the report was never checked, which is not *nothing outstanding*. **Read as the run left it** (182/26),
 * exactly as readiness is, so the list's count and its status cannot disagree.
 *
 * `report` is the alias the calling statement gives `core.report`. RLS scopes both validation tables to the bound tenant.
 */
export const validationSummaryOf = (report: string): string =>
  `(SELECT jsonb_build_object(
             'outstanding', vr.outstanding,
             'modulesCounted', (SELECT count(*) FROM core.validation_module vm
                                 WHERE vm.report_id = vr.report_id AND vm.organization_id = vr.organization_id),
             'modulesComplete', (SELECT count(*) FROM core.validation_module vm
                                  WHERE vm.report_id = vr.report_id AND vm.organization_id = vr.organization_id
                                    AND vm.outstanding = 0 AND vm.resolved + vm.reasoned > 0))
      FROM core.validation_run vr
     WHERE vr.report_id = ${report}.id AND vr.organization_id = ${report}.organization_id)`;

/** The expression's shape as the driver parses it — `jsonb` arrives as an object, `count` as a JSON number. */
export interface ValidationSummaryColumn {
  readonly outstanding: number;
  readonly modulesCounted: number;
  readonly modulesComplete: number;
}
