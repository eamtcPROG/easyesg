'use server';

import type { Organization, UpdateOrganizationRequest } from '@easyesg/contracts';
import { revalidatePath } from 'next/cache';
import { mapOutcome, type ApiOutcome } from '@/lib/api-outcome';
import { APP_LAYOUT_PATH } from '@/lib/revalidate-paths';
import { api } from '@/server/api-client';

/**
 * UC-50 — edit the organization profile (FR-15, FR-16).
 *
 * **It revalidates the `(app)` layout, like the founding action in `../creation/actions.ts` and for
 * a subset of its reason.**
 * The global tier names the active organization on every authenticated screen, so a change to
 * `name` goes stale everywhere at once rather than on this page. Revalidating the page as well
 * would be redundant — a layout revalidation refetches every segment beneath it.
 *
 * **The organization comes back and the screen re-seeds its form from it**, which is what makes
 * the save/discard pair honest: the API normalises (a trimmed name, an upper-cased country and
 * LEI), so a form left holding what the reader typed would show a dirty field they cannot clean.
 */
export async function updateOrganizationProfileAction(
  patch: UpdateOrganizationRequest,
): Promise<ApiOutcome<Organization>> {
  const outcome = await api.patch<UpdateOrganizationRequest, Organization>('/organization', patch);
  revalidatePath(APP_LAYOUT_PATH, 'layout');
  return mapOutcome(outcome, (organization) => organization);
}
