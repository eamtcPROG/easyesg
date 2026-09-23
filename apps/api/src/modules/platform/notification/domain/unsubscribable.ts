import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { UnsubscribeSubject } from '../interfaces/unsubscribe-tokens.interface';
import type { NotificationCategoryBehaviour } from '../models/notification-category.model';
import { mayBeSwitchedOff } from './may-be-switched-off';

/**
 * The subject a followed unsubscribe link may switch off, or `null` where it may switch off nothing (task 52.2.2;
 * FR-169, FR-163) — S-38's read and the switch itself both ask this, so the page and the button cannot disagree.
 *
 * `null` for a token this platform did not sign, **and for one whose category may no longer be switched off**:
 * the token was minted while the category was optional, and FR-163 locks what is not optional whatever a link
 * minted earlier said. `mayBeSwitchedOff` is the one predicate for that, as for S-27 and for dispatch.
 */
export const unsubscribable = (input: {
  readonly subject: UnsubscribeSubject | null;
  readonly behaviourOf: (categoryKey: NotificationCategoryKey) => NotificationCategoryBehaviour | null;
}): UnsubscribeSubject | null => {
  const { subject } = input;
  if (subject === null) return null;
  const behaviour = input.behaviourOf(subject.categoryKey);
  return mayBeSwitchedOff({ categoryKey: subject.categoryKey, behaviour }) ? subject : null;
};
