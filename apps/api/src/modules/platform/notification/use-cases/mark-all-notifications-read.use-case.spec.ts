import type { NotificationCentreStore } from '../interfaces/notification-centre-store.interface';
import { MarkAllNotificationsRead } from './mark-all-notifications-read.use-case';

/** S-26's *Mark all as read* (task 50.2.1): one store call, and an empty centre is not a refusal. */
describe('MarkAllNotificationsRead (task 50.2.1)', () => {
  const answering = (marked: number) => {
    const markAllRead = jest.fn().mockResolvedValue(marked);
    return { useCase: new MarkAllNotificationsRead({ markAllRead } as unknown as NotificationCentreStore), markAllRead };
  };

  it("marks the recipient's unread notices read", async () => {
    const { useCase, markAllRead } = answering(3);
    await expect(useCase.execute()).resolves.toBeUndefined();
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it('succeeds when nothing is unread', async () => {
    await expect(answering(0).useCase.execute()).resolves.toBeUndefined();
  });
});
