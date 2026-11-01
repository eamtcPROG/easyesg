'use server';

import type { CreateReportRequest, Report } from '@easyesg/contracts';
import { revalidatePath } from 'next/cache';
import { mapOutcome, type ApiOutcome } from '@/lib/api-outcome';
import { PERIODS_PATH, REPORTS_PATH } from '@/lib/revalidate-paths';
import { api } from '@/server/api/api-client';

/**
 * S-06's one write (UC-18, FR-26; task 32.3), as a Server Action — task 20's transport decision,
 * unchanged.
 *
 * **One field on the request, and the omissions are the point.** `CreateReportRequest` carries
 * `reportingPeriodId` and an optional `scope`, and nothing else: the template and taxonomy versions
 * are **copied from the period**, which pinned them when it was opened (FR-66, DR-4), so neither is
 * a field a caller could name. Task 31.3 recorded why re-resolving them at creation gives one
 * filing two disagreeing pins with nothing failing, and `esg_app` holds no `UPDATE` on either
 * column — this seam simply has nothing to send.
 *
 * **`scope` is sent since task 78.4**, as S-39 chose it — Basic unless the reader chose otherwise (FR-177's *settable
 * at creation*; §12.5.6's task-182 report-authoring row (9)), which closes task 32.3's recorded deferral. The api applies
 * the same default to a request naming none.
 */
export async function createReportAction(
  input: CreateReportRequest,
): Promise<ApiOutcome<Report>> {
  const outcome = await api.post<CreateReportRequest, Report>('/reports', input);
  // The index and the entity's periods both show what exists; a new report changes both answers.
  revalidatePath(REPORTS_PATH, 'page');
  // **Imported, not restated.** A second literal copy of a route is one a move leaves behind, and
  // two occurrences sit below `sonarjs/no-duplicate-string`'s threshold of three — so nothing
  // mechanical would have seen the copy. Both live in `lib/revalidate-paths.ts` for a reason that
  // file states: a `'use server'` module may export only async functions.
  revalidatePath(PERIODS_PATH, 'layout');
  return mapOutcome(outcome, (report) => report);
}
