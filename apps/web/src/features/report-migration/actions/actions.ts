'use server';

import { revalidatePath } from 'next/cache';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { REPORT_MIGRATION_PATH } from '@/lib/revalidate-paths';
import { api } from '@/server/api/api-client';

/**
 * S-49's two decisions (task 67.20; UC-79; 182/43) — each a POST with no body, answered 204. **A decision that succeeded
 * revalidates the screen**, so a later visit draws *nothing to decide* as the api now holds it.
 */
const settle = (outcome: ApiOutcome<null>): ApiOutcome<null> => {
  if (outcome.status === API_OUTCOME.Ok) revalidatePath(REPORT_MIGRATION_PATH, 'page');
  return outcome;
};

export async function keepMigratedReportAction(input: { readonly reportId: string }): Promise<ApiOutcome<null>> {
  return settle(await api.post<Record<string, never>, null>(`/reports/${input.reportId}/migration/acceptance`, {}));
}

export async function putReportBackAction(input: { readonly reportId: string }): Promise<ApiOutcome<null>> {
  return settle(await api.post<Record<string, never>, null>(`/reports/${input.reportId}/migration/decline`, {}));
}
