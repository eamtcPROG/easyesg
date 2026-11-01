import 'server-only';
import type { AccountProfile, NotificationPreferences } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import type { ProfileRecord } from '@/features/profile/tools/profile-fields';
import { api } from '../api/api-client';

/**
 * S-27's read (task 52.3) — the profile and the notification preferences, two owners' routes the one Record draws.
 * Fetched **in parallel**, since neither feeds the other (`async-parallel`).
 *
 * **Both, or the screen is unreachable**: S-27 is one Record with one save, and a form drawn over half a read would
 * save the half it has while the other half's fields showed nothing to change — a Record that could not say what it
 * holds. `null` is that answer.
 */
export async function readProfile(): Promise<ProfileRecord | null> {
  const [profile, preferences] = await Promise.all([
    api.get<AccountProfile>('/account/profile'),
    api.get<NotificationPreferences>('/account/notification-preferences'),
  ]);

  if (profile.status !== API_OUTCOME.Ok || profile.value === null) return null;
  if (preferences.status !== API_OUTCOME.Ok || preferences.value === null) return null;
  return { profile: profile.value, preferences: preferences.value };
}
