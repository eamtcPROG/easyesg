import type { NotificationCancellationStore } from '../interfaces/notification-cancellation-store.interface';
import { CancelNotification } from './cancel-notification.use-case';

/** FR-167's withdrawal (task 50.1.3): the key and the time reach the store whole. Its rules are the store's e2e. */
describe('CancelNotification (task 50.1.3)', () => {
  it('hands the store the key and the cancellation time', async () => {
    const cancel = jest.fn().mockResolvedValue(undefined);
    const command = {
      organizationId: '44444444-4444-4444-8444-444444444444',
      categoryKey: 'identity.invitation',
      subjectRef: 'invitation:1',
      recipientScope: 'default',
      cancelledAt: new Date('2026-09-22T09:00:00Z'),
    } as const;

    const store: NotificationCancellationStore = { cancel };
    await new CancelNotification(store).execute(command);

    expect(cancel).toHaveBeenCalledWith(command);
  });
});
