import { Injectable, Logger } from '@nestjs/common';
import {
  MANDATORY_NOTIFICATION_CATEGORIES,
  type NotificationCategoryKey,
} from '@api/contracts/notification.port';
import { dispatchChannels } from '../domain/dispatch-channels';
import { NOTIFICATION_CHANNEL, type NotificationChannel } from '../models/notification-category.model';
import { NotificationCategoryCatalog } from './notification-category-catalog.service';

/**
 * The channels a notice goes out on, decided once per notice from its category (task 49.3; §12.5.6's task-49.3
 * row (2)).
 *
 * The catalogue says what is in force; `dispatchChannels` says what an unreadable behaviour means; this is the
 * seam that asks both and makes the refusal a thrown error, so a job that may go out on nothing **fails** — it
 * lands in the queue's failed set, named, rather than completing as though it had been sent. A mandatory
 * category reaching the email floor is said at `warn`, beside the catalogue's own `error` naming the revision.
 *
 * **In-app is refused here too, until task 50.1's store** (row (5)): a category travelling in-app fails its job
 * before anything is sent, rather than delivering its email half and losing the other silently. Here rather than
 * in each delivery path because both call this — the category email the outbox handlers ask for and a raised
 * notice — and 50.1 lifts the refusal in one place.
 */
@Injectable()
export class CategoryChannels {
  private readonly logger = new Logger(CategoryChannels.name);

  constructor(private readonly catalog: NotificationCategoryCatalog) {}

  channelsFor(query: { readonly categoryKey: NotificationCategoryKey }): readonly NotificationChannel[] {
    const behaviour = this.catalog.behaviourOf(query);
    const channels = dispatchChannels({
      behaviour,
      mandatory: MANDATORY_NOTIFICATION_CATEGORIES.has(query.categoryKey),
    });

    if (channels === null) {
      throw new Error(
        `Notification category ${query.categoryKey} is optional and has no readable behaviour, so it is sent on nothing; the job fails until its artefact is published`,
      );
    }
    if (channels.includes(NOTIFICATION_CHANNEL.IN_APP)) {
      throw new Error(
        `Notification category ${query.categoryKey} travels in-app, which has no store until task 50.1; nothing was sent`,
      );
    }
    if (behaviour === null) {
      this.logger.warn(
        `Notification category ${query.categoryKey} is mandatory and has no readable behaviour; sending by email, the floor`,
      );
    }
    return channels;
  }
}
