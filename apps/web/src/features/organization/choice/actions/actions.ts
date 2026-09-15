'use server';

import type { SwitchActiveOrganizationRequest } from '@easyesg/contracts';
import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/navigation';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { APP_LAYOUT_PATH } from '@/lib/revalidate-paths';
import { api } from '@/server/api/api-client';
import { choiceExit } from '../tools/choice-exit';

/**
 * S-37's one write (task 83.3): the session acts for the organization chosen, and the reader goes on.
 *
 * **Every rule stays on the API** — that the organization is one of the reader's, and still is. This
 * sends what the list offered; a removal may have landed between that render and the click, and the
 * refusal comes back as received, for the list to show in the API's own words.
 *
 * **On success it revalidates the `(app)` layout before it redirects**, for `createOrganizationAction`'s
 * measured reason: the global tier above every authenticated screen reads the memberships, and the client
 * router cache would otherwise hand the band back as it was — naming no organization — on the screen the
 * reader lands on.
 *
 * **It answers only a failure.** A success leaves by `redirect`, and the caller's `await` never returns from
 * it: Next 16.3 rejects that promise for its `RedirectBoundary`, which remounts S-37 away. The `undefined` in
 * the type is TypeScript's reading of a function that ends in `redirect`, not a value any caller receives.
 * **Redirecting is right here and was wrong for the switch** (task 83.2): S-37 unmounts on the way out, and
 * the switch's provider, living in the `(app)` layout, does not.
 */
export async function chooseOrganizationAction(command: {
  readonly organizationId: string;
  /** The address S-37 was reached with — the reader's to edit, so judged by `choiceExit`. */
  readonly returnTo?: string;
}): Promise<ApiFailure | undefined> {
  const outcome = await api.put<SwitchActiveOrganizationRequest, undefined>('/session/organization', {
    organizationId: command.organizationId,
  });
  if (outcome.status !== API_OUTCOME.Ok) return outcome;

  revalidatePath(APP_LAYOUT_PATH, 'layout');
  const exit = choiceExit(command.returnTo);
  redirect({ href: exit.href, locale: exit.locale ?? (await getLocale()) });
}
