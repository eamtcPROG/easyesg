'use server';

import type {
  AccountProfile,
  NotificationPreferences,
  SaveAccountProfileRequest,
  SetNotificationPreferencesRequest,
} from '@easyesg/contracts';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { ROUTES } from '@/lib/routes';
import { api } from '@/server/api/api-client';
import { readSession, rememberLocale, renewSession } from '@/server/session/session';

/**
 * S-27's two writes (task 52.3; UC-13, UC-14, UC-168). The transport rule is stated once, in
 * `identity/shared/actions/actions.ts`.
 */

/**
 * The profile half. **A saved profile changes what the session says**, so this does the two things S-36's setup
 * already does after its own profile write: `rememberLocale` — OQ-32's cookie, so the interface language just chosen is
 * the one a bare address opens in — and `renewSession`, since the api answers a refresh with the account as it stands
 * and the global tier draws the name and monogram from the session. Patching the sealed payload instead would be a
 * second copy of the account (`renewSession`'s own docblock).
 *
 * **A new interface language reloads the screen in it** (FR-10): the language is the address's (OQ-32), so the one
 * honest way to apply it is to navigate there. The reloaded screen reads the saved profile, which is its confirmation.
 */
export async function saveProfileAction(input: SaveAccountProfileRequest): Promise<ApiOutcome<AccountProfile>> {
  const outcome = await api.put<SaveAccountProfileRequest, AccountProfile>('/account/profile', input);
  if (outcome.status !== API_OUTCOME.Ok || outcome.value === null) return outcome;

  await rememberLocale(outcome.value.locale);
  const current = await readSession();
  if (current !== null) await renewSession(current);

  if (outcome.value.locale !== (await getLocale())) {
    redirect({ href: ROUTES.ACCOUNT, locale: outcome.value.locale });
  }
  return outcome;
}

/** The preferences half — the set switched off, replacing the last (task 52.1). */
export async function savePreferencesAction(
  input: SetNotificationPreferencesRequest,
): Promise<ApiOutcome<NotificationPreferences>> {
  return api.put<SetNotificationPreferencesRequest, NotificationPreferences>('/account/notification-preferences', input);
}
