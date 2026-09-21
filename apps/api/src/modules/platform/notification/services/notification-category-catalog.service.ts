import { Injectable, Logger } from '@nestjs/common';
import { MANDATORY_NOTIFICATION_CATEGORIES, type NotificationCategoryKey } from '@api/contracts/notification.port';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { NOTIFICATION_CATEGORY_CONFIG_KIND } from '../constants/notification-category.constants';
import { readNotificationCategory } from '../domain/notification-category';
import {
  NOTIFICATION_CLASSIFICATION,
  type NotificationCategoryBehaviour,
} from '../models/notification-category.model';

/**
 * The notification category catalogue, over the configuration store (task 49.1; FR-173, UC-176).
 *
 * **This is what makes a category's behaviour change with no redeploy**: each read asks the store what is in
 * force now, and the store's poll is how a publication from A-17 (task 67.10) reaches every replica. Nothing
 * here caches, because the store already does and a second cache would be a second answer to *what is in
 * force*.
 *
 * **It fails closed** (§12.5.6's task-49.1 row (5)): an absent or malformed artefact answers no behaviour,
 * and says so at `error` naming the revision to replace — per read, so an operator fixing it sees the line
 * stop. **What raising a category with no behaviour does is task 49.3's**, where dispatch is decided; this
 * reader only refuses to guess, since a guessed channel list for a transactional notice is a verification
 * email sent nowhere or somewhere nobody chose.
 *
 * **A mandatory category classified `optional` is refused too** (task 49.3): code declares which categories
 * nobody may turn off (`MANDATORY_NOTIFICATION_CATEGORIES`), and an artefact that says otherwise is an operator
 * error, not a decision this reader may carry out. It reads as no behaviour, which dispatch answers with the
 * mandatory floor.
 */
@Injectable()
export class NotificationCategoryCatalog {
  private readonly logger = new Logger(NotificationCategoryCatalog.name);

  constructor(private readonly configurationStore: ConfigurationStore) {}

  behaviourOf(query: {
    readonly categoryKey: NotificationCategoryKey;
  }): NotificationCategoryBehaviour | null {
    const artefact = `${NOTIFICATION_CATEGORY_CONFIG_KIND}/${query.categoryKey}`;
    const entry = this.configurationStore.get({
      kind: NOTIFICATION_CATEGORY_CONFIG_KIND,
      scope: query.categoryKey,
    });

    if (!entry) {
      this.logger.error(`No ${artefact} is in force; the category has no behaviour until one is published`);
      return null;
    }

    const behaviour = readNotificationCategory(entry.payload);
    if (behaviour === null) {
      this.logger.error(
        `Configuration entry ${artefact} (revision ${entry.revision}) is malformed — it needs a non-empty list of distinct channels and a classification; the category has no behaviour until it is replaced`,
      );
      return null;
    }
    if (
      MANDATORY_NOTIFICATION_CATEGORIES.has(query.categoryKey) &&
      behaviour.classification === NOTIFICATION_CLASSIFICATION.OPTIONAL
    ) {
      this.logger.error(
        `Configuration entry ${artefact} (revision ${entry.revision}) classifies a mandatory category as optional, which code does not allow; the category has no behaviour until it is replaced`,
      );
      return null;
    }
    return behaviour;
  }
}
