'use server';

import type { SwitchActiveOrganizationRequest } from '@easyesg/contracts';
import { revalidatePath } from 'next/cache';
import { API_OUTCOME, mapOutcome, type ApiOutcome } from '@/lib/api-outcome';
import { APP_LAYOUT_PATH } from '@/lib/revalidate-paths';
import { ROUTES } from '@/lib/routes';
import { api } from '@/server/api/api-client';
import { isPermissionRefusal } from '@/server/data/tenant-read';
import { PROBE_SHAPE, switchLanding, type SwitchLanding } from '../tools/switch-landing';

/**
 * The organization switch (task 83.2; UC-16, FR-12, UX-3): the session acts for the organization chosen,
 * and the answer is where the reader lands there.
 *
 * **The api decides twice.** Whether the organization is the reader's is 83.1's route; whether the new
 * role opens the equivalent screen is that screen's own read, asked right after the switch — a permission
 * refusal lands the reader home. A table of roles here would be a second copy of the api's, free to drift.
 *
 * **It answers the landing rather than redirecting to it, and that is measured, not a preference.** Next
 * 16.3 hands a redirecting action's caller a *rejected* promise, for its `RedirectBoundary` to catch and
 * remount the calling component — its own source says so beside the `reject`. The caller here is the
 * switch's provider in the `(app)` layout, which no such remount reaches, so its transition was left
 * pending and the switcher stayed busy after every switch that had landed; the compact journey found it,
 * reopening the drawer onto a trigger still marked busy. Answered instead, the provider navigates in its
 * own transition and the transition ends when the landing screen commits. S-37's choice still redirects:
 * S-37 unmounts on the way out, which is the case the boundary exists for.
 *
 * **It revalidates the `(app)` layout before answering**, for `createOrganizationAction`'s measured reason:
 * the band names what the client router last cached, and a switch is the one write whose whole point is that
 * the band changes — including a landing on the address the reader is already on.
 */
export async function switchOrganizationAction(command: {
  readonly organizationId: string;
  /** The address switched on, without its locale — `switchLanding`'s input. */
  readonly from: string;
}): Promise<ApiOutcome<{ readonly href: string }>> {
  const outcome = await api.put<SwitchActiveOrganizationRequest, undefined>('/session/organization', {
    organizationId: command.organizationId,
  });
  if (outcome.status !== API_OUTCOME.Ok) return outcome;

  const landing = switchLanding(command.from);
  const refused = landing.probe !== null && isPermissionRefusal(await probe(landing.probe));
  revalidatePath(APP_LAYOUT_PATH, 'layout');
  return mapOutcome(outcome, () => ({ href: refused ? ROUTES.HOME : landing.href }));
}

/** The landing screen's own read, as that screen makes it. Not exported: a `'use server'` module's exports are endpoints. */
const probe = (read: NonNullable<SwitchLanding['probe']>): Promise<ApiOutcome<unknown>> =>
  read.shape === PROBE_SHAPE.LIST ? api.getList<unknown>(read.path) : api.get<unknown>(read.path);
