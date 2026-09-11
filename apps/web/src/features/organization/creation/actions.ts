'use server';

import type { CreateOrganizationRequest, Organization } from '@easyesg/contracts';
import { revalidatePath } from 'next/cache';
import { mapOutcome, type ApiOutcome } from '@/lib/api-outcome';
import { APP_LAYOUT_PATH } from '@/lib/revalidate-paths';
import { api } from '@/server/api-client';

/**
 * UC-49 — create an organization and become its Organization Administrator (FR-13, D-1).
 *
 * **It revalidates the `(app)` LAYOUT, not a page, and that is the whole difference from S-16's five
 * writes** (`../access/actions.ts`, a sibling since task 123 rather than the four lines above this
 * one). Those change a list the caller is looking at; this one creates the tenant the entire
 * session is about to be scoped to — the API grants the founding membership and points
 * `identity.session.active_organization_id` at it in the same transaction (task 29.1). So what
 * goes stale is the global tier, which reads the caller's memberships in the layout above **every**
 * authenticated screen.
 *
 * Measured rather than reasoned about: without this the browser journey founds an organization,
 * lands on `/home`, and the band above it is still empty. `(app)` is `force-dynamic`, so there is
 * no server cache to blame — it is the **client** router cache, which holds the RSC payload of a
 * layout it has already visited and has no way to know that a POST changed what that layout reads.
 *
 * The organization comes back rather than `null`, unlike `AccessActionResult`: S-04's exit states
 * the name it just created, and re-reading it would be a second round trip for a value the write
 * already answered.
 */
export async function createOrganizationAction(
  input: CreateOrganizationRequest,
): Promise<ApiOutcome<Organization>> {
  const outcome = await api.post<CreateOrganizationRequest, Organization>('/organizations', input);
  revalidatePath(APP_LAYOUT_PATH, 'layout');
  return mapOutcome(outcome, (organization) => organization);
}
