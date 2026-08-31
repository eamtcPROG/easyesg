'use server';

import type {
  OpenReportingPeriodRequest,
  ReopenPeriodRequest,
  ReportingPeriod,
  UpdateReportingPeriodRequest,
} from '@easyesg/contracts';
import { revalidatePath } from 'next/cache';
import { mapOutcome, type ApiOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api-client';

/**
 * S-14's writes (UC-56, UC-57, UC-58; FR-21, FR-22), as Server Actions — task 20's transport
 * decision, unchanged.
 *
 * **Four writes and no delete, which is the API's own surface.** Nothing in UC-56 … UC-58 removes a
 * period: a period that has been reported against is the record of a filing, so FR-22 locks it and
 * UC-58's reopening is a *recorded* correction. `PeriodsController` does not expose the route rather
 * than exposing one that refuses, and this file matches it.
 *
 * **Neither the acting user nor the timestamp is a field here.** FR-22 records who locked and who
 * reopened, and the API resolves both from the session — *"an attribution the caller could name is
 * not an attribution"*. A Server Action that accepted an actor would be that attribution, named by
 * the caller, one tier further out.
 */
const PERIODS_PATH = '/[locale]/(app)/(workspace)/entities/[entityId]/periods';

/** The list and the record are one path family, so one call covers both. */
const revalidatePeriods = (): void => {
  revalidatePath(PERIODS_PATH, 'layout');
};

/** UC-56 — open a period. The version pin and the prior-period link are the system's (FR-45,
 *  FR-66, DR-4), so neither is a field on the request; the API resolves both. */
export async function openPeriodAction(
  input: OpenReportingPeriodRequest,
): Promise<ApiOutcome<ReportingPeriod>> {
  const outcome = await api.post<OpenReportingPeriodRequest, ReportingPeriod>('/periods', input);
  revalidatePeriods();
  return mapOutcome(outcome, (period) => period);
}

/** Edit the shell. `templateVersion` and `taxonomyVersion` are absent from the request type by
 *  construction — DR-4 moves a pin only by an explicit migration run (FR-69). */
export async function updatePeriodAction(input: {
  readonly periodId: string;
  readonly patch: UpdateReportingPeriodRequest;
}): Promise<ApiOutcome<ReportingPeriod>> {
  const outcome = await api.patch<UpdateReportingPeriodRequest, ReportingPeriod>(
    `/periods/${input.periodId}`,
    input.patch,
  );
  revalidatePeriods();
  return mapOutcome(outcome, (period) => period);
}

/**
 * UC-57 — lock. **Irreversible-class under UX-71**, and the screen states the compensating
 * mechanism before it happens: reopening is the only route back through, and it is recorded.
 *
 * The lock refuses *every* subsequent write including an administrator's (FR-22 as amended,
 * `architecture.md` §12.5.6's task-31.2 row) — so the screen must not describe it as something an
 * administrator can simply undo.
 */
export async function lockPeriodAction(input: {
  readonly periodId: string;
}): Promise<ApiOutcome<ReportingPeriod>> {
  const outcome = await api.post<Record<string, never>, ReportingPeriod>(
    `/periods/${input.periodId}/lock`,
    {},
  );
  revalidatePeriods();
  return mapOutcome(outcome, (period) => period);
}

/**
 * UC-58 — reopen, with the stated reason UX-72 displays thereafter.
 *
 * The reason is the feature rather than a formality: an amendment must be visible as an amendment,
 * and the record it writes is append-only, so a second reopening cannot overwrite the first.
 */
export async function reopenPeriodAction(input: {
  readonly periodId: string;
  readonly reason: string;
}): Promise<ApiOutcome<ReportingPeriod>> {
  const outcome = await api.post<ReopenPeriodRequest, ReportingPeriod>(
    `/periods/${input.periodId}/reopening`,
    { reason: input.reason },
  );
  revalidatePeriods();
  return mapOutcome(outcome, (period) => period);
}
