import { NotificationNotFoundError } from '../errors/notification.errors';
import type { NotificationCentreStore } from '../interfaces/notification-centre-store.interface';
import { MarkNotificationRead } from './mark-notification-read.use-case';

/** UC-167's read mark (task 50.1.2): the store's answer decides between done and not found. */
describe('MarkNotificationRead (task 50.1.2)', () => {
  const answering = (found: boolean) => {
    const markRead = jest.fn().mockResolvedValue(found);
    return { useCase: new MarkNotificationRead({ markRead } as unknown as NotificationCentreStore), markRead };
  };

  it('marks the recipient’s own notice read', async () => {
    const { useCase, markRead } = answering(true);
    await expect(useCase.execute({ notificationId: 'n-1' })).resolves.toBeUndefined();
    expect(markRead).toHaveBeenCalledWith({ notificationId: 'n-1' });
  });

  // A colleague's notice is invisible to the recipient's policies, so it arrives here exactly as a missing one does.
  it('refuses a notice the recipient holds no delivery of as not found', async () => {
    await expect(answering(false).useCase.execute({ notificationId: 'n-1' })).rejects.toBeInstanceOf(
      NotificationNotFoundError,
    );
  });
});
