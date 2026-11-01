import type { NotificationRecipientsPort } from '@api/contracts/notification-recipients.port';
import { maskedAddress } from '../domain/masked-address';
import { unsubscribable } from '../domain/unsubscribable';
import type { NotificationCategoryBehaviours } from '../interfaces/notification-category-behaviours.interface';
import type { UnsubscribeSubject, UnsubscribeTokens } from '../interfaces/unsubscribe-tokens.interface';

/**
 * What a followed unsubscribe link may switch off, and whose (task 52.2.2, amended at task 52's close) — the step S-38's
 * read and its switch share, so the page and the button cannot disagree about a link.
 *
 * `null` for a link that may switch off nothing: one this platform did not sign, one whose category may no longer be
 * switched off (`unsubscribable`), and **one whose account no longer exists** — a deleted account has nobody to stop
 * writing to. The recipient comes back masked, for S-38 to name whose emails the link stops, since the reader may not be
 * the person the email was sent to.
 */
export interface FollowedLink {
  readonly subject: UnsubscribeSubject;
  /** `maskedAddress` of the account's address — safe to show whoever holds the link. */
  readonly recipient: string;
}

export const followLink = async (input: {
  readonly token: string;
  readonly tokens: UnsubscribeTokens;
  readonly categories: NotificationCategoryBehaviours;
  readonly recipients: NotificationRecipientsPort;
}): Promise<FollowedLink | null> => {
  const subject = unsubscribable({
    subject: input.tokens.read(input.token),
    behaviourOf: (categoryKey) => input.categories.behaviourOf({ categoryKey }),
  });
  if (subject === null) return null;

  const [account] = await input.recipients.resolve({ userIds: [subject.accountId] });
  return account === undefined ? null : { subject, recipient: maskedAddress(account.email) };
};
