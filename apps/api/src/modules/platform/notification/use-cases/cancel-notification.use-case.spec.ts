import type { NotificationCancellationStore } from '../interfaces/notification-cancellation-store.interface';
import { CancelNotification } from './cancel-notification.use-case';

/** FR-167's withdrawal (task 50.1.3): the key and the time reach the store whole. Its rules are the store's e2e. */
describe('CancelNotification (task 50.1.3)', () => {
  const publish = jest.fn().mockResolvedValue(undefined);
  beforeEach(() => publish.mockClear());

  it('hands the store the key and the cancellation time', async () => {
    const cancel = jest.fn().mockResolvedValue({ inAppRecipientIds: [] });
    const command = {
      organizationId: '44444444-4444-4444-8444-444444444444',
      categoryKey: 'identity.invitation',
      subjectRef: 'invitation:1',
      recipientScope: 'default',
      cancelledAtMicros: 1_790_726_400_000_000,
    } as const;

    const store: NotificationCancellationStore = { cancel };
    await new CancelNotification(store, { publish }).execute(command);

    expect(cancel).toHaveBeenCalledWith(command);
    // Closed nothing held in a centre, so no count moved and nobody is hinted (task 148).
    expect(publish).not.toHaveBeenCalled();
  });

  it('hints the accounts whose centres held the withdrawn notice (task 148)', async () => {
    const cancel = jest.fn().mockResolvedValue({ inAppRecipientIds: ['11111111-1111-4111-8111-111111111111'] });
    await new CancelNotification({ cancel }, { publish }).execute({
      organizationId: '44444444-4444-4444-8444-444444444444',
      categoryKey: 'reporting.manual_reminder',
      subjectRef: 'report:1',
      recipientScope: 'default',
      cancelledAtMicros: 1_790_726_400_000_000,
    });

    expect(publish).toHaveBeenCalledWith({
      event: 'notification.unread_changed',
      organizationId: '44444444-4444-4444-8444-444444444444',
      accountIds: ['11111111-1111-4111-8111-111111111111'],
    });
  });
});
