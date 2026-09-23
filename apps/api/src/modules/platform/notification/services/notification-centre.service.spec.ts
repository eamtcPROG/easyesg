import { translate } from '@api/app/messages/catalogue';
import { runInRequestContext } from '@api/infrastructure/persistence/request-context';
import type { CountUnreadNotifications } from '../use-cases/count-unread-notifications.use-case';
import type { DismissNotification } from '../use-cases/dismiss-notification.use-case';
import type { ListNotifications } from '../use-cases/list-notifications.use-case';
import type { MarkAllNotificationsRead } from '../use-cases/mark-all-notifications-read.use-case';
import type { MarkNotificationRead } from '../use-cases/mark-notification-read.use-case';
import { NotificationCentreService } from './notification-centre.service';

jest.mock('@api/app/messages/catalogue', () => ({ translate: jest.fn() }));

/**
 * Where a notice becomes words (task 50.1.2; §12.5.6's task-50.1 row (10), and the task-50.2 row (3) for the name and
 * the action text). **The catalogue is a stub**: no category has in-app wording until 50.3, so what is pinned here is
 * the question the service asks — which key, in which language, with which parameters — and that an unanswered key
 * leaves its part absent. The e2e holds the same absence over HTTP.
 */
describe('NotificationCentreService (tasks 50.1.2, 50.2.1)', () => {
  const entry = {
    notificationId: 'n-1',
    categoryKey: 'identity.invitation',
    deepLink: '/reports/r-1',
    params: { organizationName: 'Brutăria' },
    receivedAt: new Date('2026-09-22T08:00:00Z'),
    readAt: null,
  } as const;

  const service = () =>
    new NotificationCentreService(
      {
        execute: () => Promise.resolve({ entries: [entry], matched: 1, total: 4 }),
      } as unknown as ListNotifications,
      {} as CountUnreadNotifications,
      {} as MarkNotificationRead,
      {} as DismissNotification,
      {} as MarkAllNotificationsRead,
      // The list reads; it hints nothing (task 148).
      { hint: () => Promise.resolve() },
    );
  const query = { readState: null, categories: [], newestFirst: true, skip: 0, take: 25 };
  const translated = jest.mocked(translate);

  afterEach(() => translated.mockReset());

  it("resolves each notice's wording and its category's name, in the request's language", async () => {
    translated.mockImplementation((_locale, key) => `«${key}»`);

    const page = await runInRequestContext({ correlationId: 'c-1', locale: 'ru' }, () => service().list(query));

    // The name is the category's and takes no parameters; the three in-app parts are this notice's and do.
    expect(translated).toHaveBeenCalledWith('ru', 'notification.identity.invitation.name');
    expect(translated).toHaveBeenCalledWith('ru', 'notification.identity.invitation.in_app.title', entry.params);
    expect(translated).toHaveBeenCalledWith('ru', 'notification.identity.invitation.in_app.body', entry.params);
    expect(translated).toHaveBeenCalledWith('ru', 'notification.identity.invitation.in_app.action', entry.params);
    expect(page).toEqual({
      items: [
        {
          notificationId: 'n-1',
          categoryKey: 'identity.invitation',
          deepLink: '/reports/r-1',
          receivedAt: entry.receivedAt,
          readAt: null,
          categoryName: '«notification.identity.invitation.name»',
          title: '«notification.identity.invitation.in_app.title»',
          body: '«notification.identity.invitation.in_app.body»',
          actionLabel: '«notification.identity.invitation.in_app.action»',
        },
      ],
      matched: 1,
      total: 4,
    });
  });

  // The parameters are what the words interpolate; they never travel on as data of their own.
  it('leaves a part absent when its category has no wording, and never carries the parameters on', async () => {
    translated.mockReturnValue(undefined);

    const page = await runInRequestContext({ correlationId: 'c-1', locale: 'ro' }, () => service().list(query));

    expect(page.items[0]).toMatchObject({
      categoryName: undefined,
      title: undefined,
      body: undefined,
      actionLabel: undefined,
    });
    expect(page.items[0]).not.toHaveProperty('params');
  });
});
