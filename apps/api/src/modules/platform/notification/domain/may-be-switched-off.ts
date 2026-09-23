import { MANDATORY_NOTIFICATION_CATEGORIES, type NotificationCategoryKey } from '@api/contracts/notification.port';
import {
  NOTIFICATION_CLASSIFICATION,
  type NotificationCategoryBehaviour,
} from '../models/notification-category.model';

/**
 * Whether a person may switch a category off — FR-163's *suppression only for categories classified optional*
 * (task 52.2; BR-NOT-2; §12.5.6's task-52.2 row).
 *
 * **Two conditions, and both are needed.** Code declares the categories nobody may turn off, whatever an artefact
 * says (task 49.3); and a category code does not declare is switchable only where its behaviour in force is
 * classified `optional` — so one an operator publishes as `transactional` is locked, and one whose behaviour cannot
 * be read is not a switch anyone is offered. **One predicate for every reader**: the preferences' read and write,
 * dispatch's opt-out, and the unsubscribe footer, which is what keeps them from disagreeing about one category.
 */
export const mayBeSwitchedOff = (input: {
  readonly categoryKey: NotificationCategoryKey;
  readonly behaviour: NotificationCategoryBehaviour | null;
}): boolean =>
  !MANDATORY_NOTIFICATION_CATEGORIES.has(input.categoryKey) &&
  input.behaviour?.classification === NOTIFICATION_CLASSIFICATION.OPTIONAL;
