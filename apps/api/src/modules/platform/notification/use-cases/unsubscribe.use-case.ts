import { unsubscribable } from '../domain/unsubscribable';
import { UnsubscribeLinkUnusableError } from '../errors/notification.errors';
import type { NotificationCategoryBehaviours } from '../interfaces/notification-category-behaviours.interface';
import type { NotificationPreferenceStore } from '../interfaces/notification-preference-store.interface';
import type { UnsubscribeTokens } from '../interfaces/unsubscribe-tokens.interface';
import { UNSUBSCRIBE_STANDING, type UnsubscribePreview } from '../models/unsubscribe.model';
import type { UnsubscribeTokenQuery } from './preview-unsubscribe.use-case';

/**
 * FR-169's one-click unsubscribe — S-38's button and RFC 8058's `POST` alike (task 52.2.2; UC-173; §12.5.6's task-52.2
 * row (2)): the token's category switched off on its channel for the person it names, and nothing else.
 *
 * **A link that may switch off nothing is refused and writes nothing** — `unsubscribable`'s answer, the one S-38's
 * read gives. **One already switched off succeeds**, since a second press, or a mail client posting after the person
 * pressed the page's button, is the same wish rather than an error; the store's `switchOff` keeps the first time.
 * **It sets one pair and touches no other**, which is why it is `switchOff` and not 52.1's replace: the person chose
 * one category on one channel, and the rest of what they chose on S-27 stands.
 */
export class Unsubscribe {
  constructor(
    private readonly tokens: UnsubscribeTokens,
    private readonly categories: NotificationCategoryBehaviours,
    private readonly store: NotificationPreferenceStore,
  ) {}

  async execute(command: UnsubscribeTokenQuery): Promise<UnsubscribePreview> {
    const subject = unsubscribable({
      subject: this.tokens.read(command.token),
      behaviourOf: (categoryKey) => this.categories.behaviourOf({ categoryKey }),
    });
    if (subject === null) throw new UnsubscribeLinkUnusableError();

    await this.store.switchOff({
      accountId: subject.accountId,
      pair: { categoryKey: subject.categoryKey, channel: subject.channel },
    });
    return { standing: UNSUBSCRIBE_STANDING.SWITCHED_OFF, categoryKey: subject.categoryKey };
  }
}
