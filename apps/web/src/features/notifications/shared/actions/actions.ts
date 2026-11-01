'use server';

import { revalidatePath } from 'next/cache';
import { mapOutcome } from '@/lib/api-outcome';
import { NOTIFICATIONS_PATH } from '@/lib/revalidate-paths';
import { api } from '@/server/api/api-client';
import type { NoticeActionResult } from './action-results';

/**
 * The recipient's own read state, written from S-26 and the panel (tasks 50.2.1, 50.2.2; UC-167; §12.5.6's task-50.2
 * row (2)) — as Server Actions, on task 20's transport decision.
 *
 * **In `shared/` on one test: is it read by more than one surface?** S-26 marks, dismisses and marks all; the panel
 * marks all.
 *
 * **Every rule stays on the API**: that the notice is the caller's, that a read time is kept once, that a dismissed
 * notice leaves the centre. What the screen offered is what the last render showed; a notice another tab has
 * already dismissed answers as the API answers it.
 *
 * **Each revalidates S-26**, so the next render lists and counts what is now true rather than the control
 * reconciling a guess. The band's count and the panel's list are the browser's queries, which the control invalidates
 * beside this.
 */
const post = async (path: string): Promise<NoticeActionResult> => {
  const outcome = await api.post<undefined, undefined>(path, undefined);
  revalidatePath(NOTIFICATIONS_PATH, 'page');
  return mapOutcome(outcome, () => null);
};

/** Records the notice read for the caller alone; a second mark keeps the first time. */
export async function markNotificationReadAction(input: {
  readonly notificationId: string;
}): Promise<NoticeActionResult> {
  return post(`/notifications/${encodeURIComponent(input.notificationId)}/read`);
}

/** Takes the notice out of the caller's centre and count, and records no reading. */
export async function dismissNotificationAction(input: {
  readonly notificationId: string;
}): Promise<NoticeActionResult> {
  return post(`/notifications/${encodeURIComponent(input.notificationId)}/dismiss`);
}

/** Records read every notice the caller's unread count counts. */
export async function markAllNotificationsReadAction(): Promise<NoticeActionResult> {
  return post('/notifications/read');
}
