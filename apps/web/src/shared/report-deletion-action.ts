'use server';

import { revalidatePath } from 'next/cache';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { HOME_PATH, PERIODS_PATH, REPORTS_PATH } from '@/lib/revalidate-paths';
import { api } from '@/server/api/api-client';

/**
 * UC-213's one write (task 192; FR-210), as a Server Action — the report's ⋯ on S-06 and on S-07 both reach it, so it
 * sits in `shared/` beside the hook both read. **Every rule is the api's**: the role, the lock and the exports are judged
 * in the statement that marks the report (`architecture.md` §12.5.6's task-192 row (2)), and a refusal changes nothing,
 * so only a deletion redraws — the list, the home's overview and the entity's periods each stop showing it.
 */
export async function deleteReportAction(input: { readonly reportId: string }): Promise<ApiOutcome<undefined>> {
  const outcome = await api.delete(`/reports/${input.reportId}`);
  if (outcome.status === API_OUTCOME.Ok) {
    revalidatePath(REPORTS_PATH, 'page');
    revalidatePath(HOME_PATH, 'page');
    revalidatePath(PERIODS_PATH, 'layout');
  }
  return outcome;
}
