import { Injectable } from '@nestjs/common';
import { SOURCE_LOCALE, type Locale } from '@easyesg/i18n';
import { DEFAULT_ON_PAGE } from '@api/app/constants/pagination.constants';
import { translate } from '@api/app/messages/catalogue';
import type { ListQueryInput } from '@api/contracts/types/list-query';
import { requestContext } from '@api/infrastructure/persistence/request-context';
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
import { MarkNotificationRead } from '../use-cases/mark-notification-read.use-case';

/**
 * The Nest-aware seam between the centre's controller and its use cases (task 50.1.2), and **where a notice becomes
 * words** (§12.5.6's task-50.1 row (10)).
 *
 * The wording is resolved here because this is the layer that holds the request's negotiated language, and the
 * use cases stay framework-free without it. Each entry's title and body are the category's in-app entries under
 * `notification.<category>.in_app` in `packages/i18n` — beside that category's email wording, so a category's words
 * have one home for both channels — interpolating the notice's own parameters, which never reach the wire. A key
 * with no entry leaves its part absent rather than printing the key, the problem document's rule: a notice from a
 * category whose in-app wording nobody has written yet still lists, with its link, and says nothing false.
 */
@Injectable()
export class NotificationCentreService {
  constructor(
    private readonly listNotifications: ListNotifications,
    private readonly countUnread: CountUnreadNotifications,
    private readonly markNotificationRead: MarkNotificationRead,
    private readonly dismissNotification: DismissNotification,
  ) {}

  /** The parsed list query, narrowed to what the centre can be asked — the read model's decision, not HTTP's. */
  narrow(list: ListQueryInput): NotificationCentreQuery {
    return toNotificationCentreQuery({ list, fallbackTake: DEFAULT_ON_PAGE });
  }

  async list(query: NotificationCentreQuery): Promise<NotificationCentreItemPage> {
    const page = await this.listNotifications.execute(query);
    const locale = requestContext()?.locale ?? SOURCE_LOCALE;
    return {
      items: page.entries.map((entry) => inWords({ entry, locale })),
      matched: page.matched,
      total: page.total,
    };
  }

  unreadCount(): Promise<{ readonly unread: number }> {
    return this.countUnread.execute();
  }

  markRead(command: { readonly notificationId: string }): Promise<void> {
    return this.markNotificationRead.execute(command);
  }

  dismiss(command: { readonly notificationId: string }): Promise<void> {
    return this.dismissNotification.execute(command);
  }
}

/** One entry in the request's language: title and body from the category's in-app wording, parameters dropped. */
const inWords = (input: {
  readonly entry: NotificationCentreEntry;
  readonly locale: Locale;
}): NotificationCentreItem => {
  const { params, ...entry } = input.entry;
  const wording = `notification.${entry.categoryKey}.in_app`;
  return {
    ...entry,
    title: translate(input.locale, `${wording}.title`, params),
    body: translate(input.locale, `${wording}.body`, params),
  };
};
