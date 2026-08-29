'use server';

import type {
  CreateReportingEntityRequest,
  NaceCodeMatch,
  ReportingEntity,
  UpdateReportingEntityRequest,
} from '@easyesg/contracts';
import { revalidatePath } from 'next/cache';
import { API_OUTCOME, mapOutcome, type ApiOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api-client';

/**
 * S-13's writes (UC-52, UC-53, UC-55; FR-17, FR-18, FR-20), as Server Actions — task 20's transport
 * decision, unchanged: the browser posts to the Next server tier, which calls the public API as the
 * ordinary client AD-9 says it is.
 *
 * **Every write revalidates the entities path rather than the `(app)` layout.** S-15's does the
 * layout because the organization's name is in the global tier on every screen; an entity's name is
 * not, so the smaller invalidation is the correct one — and the list and the record are the same
 * path family, so one call covers both.
 */
const ENTITIES_PATH = '/[locale]/(app)/(workspace)/entities';

const revalidateEntities = (): void => {
  revalidatePath(ENTITIES_PATH, 'layout');
};

/** UC-52 — create a reporting entity. */
export async function createEntityAction(
  input: CreateReportingEntityRequest,
): Promise<ApiOutcome<ReportingEntity>> {
  const outcome = await api.post<CreateReportingEntityRequest, ReportingEntity>('/entities', input);
  revalidateEntities();
  return mapOutcome(outcome, (entity) => entity);
}

/** UC-53 — edit master data. FR-18 keeps it point-in-time, so a closed period's report still
 *  renders the values in force when it was prepared; the screen says so before the save. */
export async function updateEntityAction(input: {
  readonly entityId: string;
  readonly patch: UpdateReportingEntityRequest;
}): Promise<ApiOutcome<ReportingEntity>> {
  const outcome = await api.patch<UpdateReportingEntityRequest, ReportingEntity>(
    `/entities/${input.entityId}`,
    input.patch,
  );
  revalidateEntities();
  return mapOutcome(outcome, (entity) => entity);
}

/** UC-55 — archive (FR-20). Never a delete: prior filings must stay retrievable after an entity is
 *  sold, merged or dissolved, which is why no route removes one. */
export async function archiveEntityAction(input: {
  readonly entityId: string;
}): Promise<ApiOutcome<null>> {
  const outcome = await api.post(`/entities/${input.entityId}/archive`, {});
  revalidateEntities();
  return mapOutcome(outcome, () => null);
}

/**
 * The activity picker's search (task 30.4.1), reached from a Client Component.
 *
 * **A Server Action rather than the `/api/[...path]` pass-through**, for task 20's stated reason:
 * this is an ordinary read the Next server tier makes as the API's client, and the pass-through
 * stays scoped to traffic that cannot come through here — byte streams, the offline drain, polls.
 * It is also what keeps the session cookie out of the browser's reach on a keystroke path.
 */
export async function searchActivityCodesAction(query: string): Promise<readonly NaceCodeMatch[]> {
  const outcome = await api.getList<NaceCodeMatch>(
    `/entities/nace-codes?q=${encodeURIComponent(query)}`,
  );
  // The combobox shows its empty state either way; a failed search is not worth a callout over a
  // control the reader is still typing into.
  return outcome.status === API_OUTCOME.Ok ? outcome.value.items : [];
}
