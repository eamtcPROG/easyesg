'use server';

import { revalidatePath } from 'next/cache';
import type { ApiOutcome } from '@/lib/api-outcome';
import { HOME_PATH } from '@/lib/revalidate-paths';
import { api } from '@/server/api/api-client';

/**
 * S-05's *not now* on the second-factor prompt (task 190; `architecture.md` §12.5.6's task-190 rows (5), (6)).
 *
 * The answer is the account's, for good, until the factor is turned off — so the api keeps it and the screen
 * re-reads: S-05 is revalidated, and the prompt is gone because the read now says so, not because the browser hid it.
 */
export async function dismissEnrolmentPromptAction(): Promise<ApiOutcome<undefined>> {
  const outcome = await api.post<undefined, undefined>('/account/totp/prompt-dismissal', undefined);
  revalidatePath(HOME_PATH, 'page');
  return outcome;
}
