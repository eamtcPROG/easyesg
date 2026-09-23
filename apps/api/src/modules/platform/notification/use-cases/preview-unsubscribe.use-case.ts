import type { NotificationRecipientsPort } from '@api/contracts/notification-recipients.port';
import { pairKey } from '../domain/offered-preferences';
import type { NotificationCategoryBehaviours } from '../interfaces/notification-category-behaviours.interface';
import type { NotificationPreferenceStore } from '../interfaces/notification-preference-store.interface';
import type { UnsubscribeTokens } from '../interfaces/unsubscribe-tokens.interface';
import { UNSUBSCRIBE_STANDING, type UnsubscribePreview } from '../models/unsubscribe.model';
import { followLink } from './followed-link';

/**
 * S-38's read — what a followed unsubscribe link would switch off, and whose, before anything is switched (task
 * 52.2.2; FR-169, UC-173; §12.5.6's task-52.2 row (2)).
 *
 * **Nothing changes on this read**, which is the whole reason S-38 is a page with a button: a mail scanner that
 * prefetches the link reaches this and no further.
 */
export class PreviewUnsubscribe {
  constructor(
    private readonly tokens: UnsubscribeTokens,
    private readonly categories: NotificationCategoryBehaviours,
    private readonly store: NotificationPreferenceStore,
    private readonly recipients: NotificationRecipientsPort,
  ) {}

  async execute(query: UnsubscribeTokenQuery): Promise<UnsubscribePreview> {
    const link = await followLink({ ...query, tokens: this.tokens, categories: this.categories, recipients: this.recipients });
    if (link === null) return { standing: UNSUBSCRIBE_STANDING.UNUSABLE };

    const off = await this.store.switchedOff({ accountId: link.subject.accountId });
    return {
      standing: off.some((pair) => pairKey(pair) === pairKey(link.subject))
        ? UNSUBSCRIBE_STANDING.SWITCHED_OFF
        : UNSUBSCRIBE_STANDING.AVAILABLE,
      categoryKey: link.subject.categoryKey,
      recipient: link.recipient,
    };
  }
}

/** Both of S-38's calls take the token alone. */
export interface UnsubscribeTokenQuery {
  readonly token: string;
}
