'use server';

import type { CreateReportRequest, Report } from '@easyesg/contracts';
import { revalidatePath } from 'next/cache';
import { mapOutcome, type ApiOutcome } from '@/lib/api-outcome';
import { PERIODS_PATH, REPORTS_PATH } from '@/lib/revalidate-paths';
import { api } from '@/server/api-client';

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
 * **`scope` is not sent, and that is a recorded deferral rather than a decision the requirement
 * supports.** It defaults to `basic` at the API. FR-177's acceptance criteria say the flag is
 * *"settable at creation"*, so this leaves that clause unmet; `architecture.md` §12.5.6's task-32.3
 * row carries what is assumed meanwhile — Comprehensive is added after the fact, which FR-177's own
 * text permits and the artboard states to the reader — and what changes if that is wrong. It also
 * records the gap the deferral rests on: **whether narrowing an existing report is refused, warned
 * about, or a consequence-disclosing action is task 78.1's open question**, and no task row owns
 * the creation-surface control at all.
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
