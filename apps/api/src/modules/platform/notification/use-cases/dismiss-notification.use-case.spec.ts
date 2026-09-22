import { NotificationNotFoundError } from '../errors/notification.errors';
import type { NotificationCentreStore } from '../interfaces/notification-centre-store.interface';
import { DismissNotification } from './dismiss-notification.use-case';

/** UC-167's dismissal (task 50.1.2): the store's answer decides between done and not found. */
describe('DismissNotification (task 50.1.2)', () => {
  const answering = (found: boolean) => {
    const dismiss = jest.fn().mockResolvedValue(found);
    return { useCase: new DismissNotification({ dismiss } as unknown as NotificationCentreStore), dismiss };
  };

  it('dismisses the recipient’s own notice', async () => {
    const { useCase, dismiss } = answering(true);
    await expect(useCase.execute({ notificationId: 'n-1' })).resolves.toBeUndefined();
    expect(dismiss).toHaveBeenCalledWith({ notificationId: 'n-1' });
  });

  it('refuses a notice the recipient holds no delivery of as not found', async () => {
    await expect(answering(false).useCase.execute({ notificationId: 'n-1' })).rejects.toBeInstanceOf(
      NotificationNotFoundError,
    );
  });
});
