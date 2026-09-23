import {
  NOTIFICATION_CLASSIFICATION,
  type NotificationCategoryBehaviour,
} from '../models/notification-category.model';
import {
  PUBLICATION_CONSEQUENCE,
  type PublicationConsequence,
  type SwitchOffCounts,
} from '../models/category-console.model';

/**
 * What putting a behaviour in force changes for recipients — A-17's scope disclosure (task 67.10; UX-123, UX-65,
 * FR-163; §12.5.6's task-67.10 row (2)). Empty where nothing changes for anyone.
 *
 * **Against what is in force, or against nothing**: a category with no behaviour in force reaches nobody, so every
 * channel published is added. The counts are the switch-offs the preferences hold, which only an optional category's
 * recipients can have made — so the override names the people it reaches again, and a channel added names those who
 * switched it off there before, whose choice holds again (task 52.1 row (4)).
 */
export const publicationConsequences = (input: {
  readonly current: NotificationCategoryBehaviour | null;
  readonly proposed: NotificationCategoryBehaviour;
  readonly switchOffs: SwitchOffCounts;
}): readonly PublicationConsequence[] => {
  const { current, proposed, switchOffs } = input;
  const consequences: PublicationConsequence[] = [];
  const wasOptional = current?.classification === NOTIFICATION_CLASSIFICATION.OPTIONAL;
  const isOptional = proposed.classification === NOTIFICATION_CLASSIFICATION.OPTIONAL;

  if (wasOptional && !isOptional && switchOffs.people > 0) {
    consequences.push({ kind: PUBLICATION_CONSEQUENCE.SWITCH_OFFS_OVERRIDDEN, people: switchOffs.people });
  }
  if (!wasOptional && isOptional) consequences.push({ kind: PUBLICATION_CONSEQUENCE.BECOMES_SWITCHABLE });

  const before = current?.channels ?? [];
  for (const channel of before) {
    if (!proposed.channels.includes(channel)) consequences.push({ kind: PUBLICATION_CONSEQUENCE.CHANNEL_REMOVED, channel });
  }
  for (const channel of proposed.channels) {
    if (!before.includes(channel)) {
      consequences.push({
        kind: PUBLICATION_CONSEQUENCE.CHANNEL_ADDED,
        channel,
        stayingOff: isOptional ? switchOffs.byChannel[channel] : 0,
      });
    }
  }
  return consequences;
};
