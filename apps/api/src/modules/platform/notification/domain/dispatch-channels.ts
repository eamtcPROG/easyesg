import {
  NOTIFICATION_CHANNEL,
  type NotificationCategoryBehaviour,
  type NotificationChannel,
} from '../models/notification-category.model';

/**
 * The channels a notice goes out on, or `null` when it may go out on none (task 49.3; §12.5.6's task-49.3 row
 * (2)).
 *
 * **A readable behaviour is obeyed.** An unreadable one — absent, malformed, or a mandatory category classified
 * optional, which the catalogue refuses — is answered by the category's kind, which code declares: a
 * **mandatory** category still goes by email, the floor, because nobody may turn it off and a broken artefact is
 * not somebody choosing to; an **optional** one gets `null`, and its job fails rather than sending on a channel
 * nobody chose.
 */
export const dispatchChannels = (input: {
  readonly behaviour: NotificationCategoryBehaviour | null;
  readonly mandatory: boolean;
}): readonly NotificationChannel[] | null => {
  if (input.behaviour !== null) return input.behaviour.channels;
  return input.mandatory ? [NOTIFICATION_CHANNEL.EMAIL] : null;
};
