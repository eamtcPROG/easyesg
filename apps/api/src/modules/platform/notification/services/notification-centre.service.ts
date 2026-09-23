import { Inject, Injectable } from '@nestjs/common';
import { PUSH_EVENT, PUSH_HINTS, type PushHints } from '@api/contracts/push.port';
import type { Locale } from '@easyesg/i18n';
import { DEFAULT_ON_PAGE } from '@api/app/constants/pagination.constants';
import { translate } from '@api/app/messages/catalogue';
import type { ListQueryInput } from '@api/contracts/types/list-query';
import { requestContext, requestLocale } from '@api/infrastructure/persistence/request-context';
import { toNotificationCentreQuery } from '../domain/notification-centre-query';
import type {
  NotificationCentreEntry,
  NotificationCentreItem,
  NotificationCentreItemPage,
  NotificationCentreQuery,
} from '../models/notification-centre.model';
import { CountUnreadNotifications } from '../use-cases/count-unread-notifications.use-case';
import { DismissNotification } from '../use-cases/dismiss-notification.use-case';
import { ListNotifications } from '../use-cases/list-notifications.use-case';
import { MarkAllNotificationsRead } from '../use-cases/mark-all-notifications-read.use-case';
import { MarkNotificationRead } from '../use-cases/mark-notification-read.use-case';

/**
 * The Nest-aware seam between the centre's controller and its use cases (task 50.1.2), and **where a notice becomes
 * words** (§12.5.6's task-50.1 row (10)).
 *
 * The wording is resolved here because this is the layer that holds the request's negotiated language, and the
 * use cases stay framework-free without it. Each entry's title, body and action text are the category's in-app
 * entries under `notification.<category>.in_app` in `packages/i18n`, and its category's name is
 * `notification.<category>.name` (task 50.2.1, §12.5.6's task-50.2 row (3)) — beside that category's email wording, so
 * a category's words have one home for both channels — interpolating the notice's own parameters, which never reach
 * the wire. A key with no entry leaves its part absent rather than printing the key, the problem document's rule: a
 * notice from a category whose in-app wording nobody has written yet still lists, with its link, and says nothing
 * false.
 */
@Injectable()
export class NotificationCentreService {
  constructor(
    private readonly listNotifications: ListNotifications,
    private readonly countUnread: CountUnreadNotifications,
    private readonly markNotificationRead: MarkNotificationRead,
    private readonly dismissNotification: DismissNotification,
    private readonly markAllNotificationsRead: MarkAllNotificationsRead,
    @Inject(PUSH_HINTS) private readonly hints: PushHints,
  ) {}

  /**
   * The reader's count changed (task 148; §12.5.6's task-148 row (2)) — their own other tabs show it too. Hinted on the
   * request's transaction; a request bound to no organization or actor has no centre to hint about.
   */
  private async unreadChanged(): Promise<void> {
    const context = requestContext();
    if (!context?.organizationId || !context.actorId) return;
    await this.hints.hint({
      event: PUSH_EVENT.NOTIFICATION_UNREAD_CHANGED,
      organizationId: context.organizationId,
      accountIds: [context.actorId],
    });
  }

  /** The parsed list query, narrowed to what the centre can be asked — the read model's decision, not HTTP's. */
  narrow(list: ListQueryInput): NotificationCentreQuery {
    return toNotificationCentreQuery({ list, fallbackTake: DEFAULT_ON_PAGE });
  }

  async list(query: NotificationCentreQuery): Promise<NotificationCentreItemPage> {
    const page = await this.listNotifications.execute(query);
    const locale = requestLocale();
    return {
      items: page.entries.map((entry) => inWords({ entry, locale })),
      matched: page.matched,
      total: page.total,
    };
  }

  unreadCount(): Promise<{ readonly unread: number }> {
    return this.countUnread.execute();
  }

  async markRead(command: { readonly notificationId: string }): Promise<void> {
    await this.markNotificationRead.execute(command);
    await this.unreadChanged();
  }

  async dismiss(command: { readonly notificationId: string }): Promise<void> {
    await this.dismissNotification.execute(command);
    await this.unreadChanged();
  }

  async markAllRead(): Promise<void> {
    await this.markAllNotificationsRead.execute();
    await this.unreadChanged();
  }
}

/** One entry in the request's language: its category named and its in-app wording resolved, parameters dropped. */
const inWords = (input: {
  readonly entry: NotificationCentreEntry;
  readonly locale: Locale;
}): NotificationCentreItem => {
  const { params, ...entry } = input.entry;
  const category = `notification.${entry.categoryKey}`;
  return {
    ...entry,
    categoryName: translate(input.locale, `${category}.name`),
    title: translate(input.locale, `${category}.in_app.title`, params),
    body: translate(input.locale, `${category}.in_app.body`, params),
    actionLabel: translate(input.locale, `${category}.in_app.action`, params),
  };
};
