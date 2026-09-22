'use server';

import { revalidatePath } from 'next/cache';
import { mapOutcome } from '@/lib/api-outcome';
import { NOTIFICATIONS_PATH } from '@/lib/revalidate-paths';
import { api } from '@/server/api/api-client';
import type { CentreActionResult } from './action-results';

/**
 * The recipient's own read state, written from S-26 (task 50.2.1; UC-167; §12.5.6's task-50.2 row (2)) — as Server
 * Actions, on task 20's transport decision.
 *
 * **Every rule stays on the API**: that the notice is the caller's, that a read time is kept once, that a dismissed
 * notice leaves the centre. What the screen offered is what the last render showed; a notice another tab has
 * already dismissed answers as the API answers it.
 *
 * **Each revalidates S-26**, so the next render lists and counts what is now true rather than the control
 * reconciling a guess. The band's count is the browser's poll, which the control invalidates beside this.
 */
const post = async (path: string): Promise<CentreActionResult> => {
  const outcome = await api.post<undefined, undefined>(path, undefined);
  revalidatePath(NOTIFICATIONS_PATH, 'page');
  return mapOutcome(outcome, () => null);
};

/** Records the notice read for the caller alone; a second mark keeps the first time. */
export async function markNotificationReadAction(input: {
  readonly notificationId: string;
}): Promise<CentreActionResult> {
  return post(`/notifications/${encodeURIComponent(input.notificationId)}/read`);
}

/** Takes the notice out of the caller's centre and count, and records no reading. */
export async function dismissNotificationAction(input: {
  readonly notificationId: string;
}): Promise<CentreActionResult> {
  return post(`/notifications/${encodeURIComponent(input.notificationId)}/dismiss`);
}

/** Records read every notice the caller's unread count counts. */
export async function markAllNotificationsReadAction(): Promise<CentreActionResult> {
  return post('/notifications/read');
}
