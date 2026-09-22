import 'server-only';
import type { Member, Report } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api/api-client';

/**
 * What S-16's reminder panel chooses from (task 50.3): every member and every report of the organization, read in
 * parallel, each `null` where it could not be read — the panel's own *partial* state, since the list above it does
 * not depend on either. Which of them can be offered is the feature's rule (`access/tools/reminder.ts`).
 */
export async function readReminderChoices(): Promise<{
  readonly members: readonly Member[] | null;
  readonly reports: readonly Report[] | null;
}> {
  const [members, reports] = await Promise.all([api.getList<Member>('/members'), api.getList<Report>('/reports')]);
  return {
    members: members.status === API_OUTCOME.Ok ? members.value.items : null,
    reports: reports.status === API_OUTCOME.Ok ? reports.value.items : null,
  };
}
