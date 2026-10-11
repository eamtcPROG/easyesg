'use server';

import type { Export, MarkReportFiledRequest, Report, RequestExportRequest } from '@easyesg/contracts';
import { revalidatePath } from 'next/cache';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { REPORT_EXPORT_PATH } from '@/lib/revalidate-paths';
import { api } from '@/server/api/api-client';

/**
 * S-11's three writes (tasks 47.3 … 47.5; UC-42, UC-43; FR-41, FR-44), as Server Actions — the browser posts to the Next
 * server tier, which calls the public api as the ordinary client AD-9 says it is. Only the watch of a running export
 * goes through the pass-through (`client/exports`), because it is a poll.
 *
 * **An action is a projection and nothing more.** Every rule stays on the api: the findings' refusal and its
 * acknowledgement (FR-44), the mark waiting for a completed export (§12.5.6's task-47 row (4)), the role. **A write that
 * succeeded revalidates the screen**, so the Server Component draws the history and the mark as the api now holds them
 * rather than the caller reconciling an optimistic copy. A refusal changes nothing the screen drew, so it does not.
 */
const revalidateExports = (outcome: ApiOutcome<unknown>): void => {
  if (outcome.status === API_OUTCOME.Ok) revalidatePath(REPORT_EXPORT_PATH, 'page');
};

/** UC-42/UC-43: ask for the file — refused with the findings listed until the request acknowledges them. */
export async function requestExportAction(input: {
  readonly reportId: string;
  readonly request: RequestExportRequest;
}): Promise<ApiOutcome<Export>> {
  const outcome = await api.post<RequestExportRequest, Export>(`/reports/${input.reportId}/exports`, input.request);
  revalidateExports(outcome);
  return outcome;
}

/** FR-41: record that the report has been filed, on the day stated. */
export async function markReportFiledAction(input: {
  readonly reportId: string;
  readonly request: MarkReportFiledRequest;
}): Promise<ApiOutcome<Report>> {
  const outcome = await api.put<MarkReportFiledRequest, Report>(`/reports/${input.reportId}/filing`, input.request);
  revalidateExports(outcome);
  return outcome;
}

/** FR-41: withdraw the mark — no reason asked; the change trail keeps who and when (row (3)). */
export async function withdrawReportFilingAction(input: { readonly reportId: string }): Promise<ApiOutcome<Report>> {
  const outcome = await api.delete<undefined, Report>(`/reports/${input.reportId}/filing`);
  revalidateExports(outcome);
  return outcome;
}
