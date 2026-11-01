'use server';

import type { Report, ReportScope, UpdateReportRequest, Validation } from '@easyesg/contracts';
import { mapOutcome, type ApiOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';

/**
 * *Check my report* — UC-40's run (task 42.2; FR-43, UX-24; `architecture.md` §12.5.6's task-42 row (d)):
 * `POST /reports/{id}/validation/runs`, which evaluates the report at whatever completeness it stands and replaces its
 * findings and roll-up.
 *
 * **A Server Action, not the queue**, for the calculator run's reason (§12.5.6's task-39 row (2)): a run is a request the
 * reader makes and watches, and the control has already sent what the wizard held unsent before calling it (row (d)).
 * **Nothing is revalidated here**: the control refreshes the step it sits on, which re-reads the run with the step,
 * the list and the heading — one transition, so the panel stays busy until the new counts are drawn. The refusal
 * travels as the api composed it (NFR-79).
 */
export async function runValidationAction(input: { readonly reportId: string }): Promise<ApiOutcome<null>> {
  const outcome = await api.post<undefined, Validation>(`/reports/${input.reportId}/validation/runs`, undefined);
  return mapOutcome(outcome, () => null);
}

/**
 * UC-192 — the report's scope raised or lowered on S-07 (task 78.3; FR-177; `architecture.md` §12.5.6's task-78 row
 * (2)): `PATCH /reports/{id}`, which keeps every answer and moves B1's stored basis for preparation with the scope.
 *
 * **Nothing is revalidated here**: both callers navigate once it answers — raising to C1, lowering to the report's
 * resume point — and every wizard address is read afresh, so the new list is drawn by the page the reader lands on. The
 * refusal travels as the api composed it (NFR-79).
 */
export async function changeScopeAction(input: {
  readonly reportId: string;
  readonly scope: ReportScope;
}): Promise<ApiOutcome<null>> {
  const outcome = await api.patch<UpdateReportRequest, Report>(`/reports/${input.reportId}`, { scope: input.scope });
  return mapOutcome(outcome, () => null);
}
