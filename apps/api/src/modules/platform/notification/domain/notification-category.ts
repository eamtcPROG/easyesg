import {
  CADENCE_MAX_DAYS,
  CADENCE_MAX_LEAD_TIMES,
  isNotificationChannel,
  isNotificationClassification,
  type NotificationCategoryBehaviour,
} from '../models/notification-category.model';

/**
 * A `notification_category` payload read as behaviour, or `null` when it cannot be (task 49.1).
 *
 * **Validated, never cast** — configuration is data someone edits, and A-17 will be where they edit it. A
 * payload is refused whole rather than read in part: a category whose channel list held one unknown word
 * among two known ones would otherwise send on a subset nobody chose. Refused are a missing or empty channel
 * list, a channel named twice, a channel or classification outside the vocabulary. **Members it does not
 * know are ignored**, so a member a later release adds can be published before every replica reads it.
 *
 * **A cadence is read where it is present and refused whole where it is malformed** (task 51.2): a repeat interval is a
 * whole number of days from 1 to a year, and lead times are distinct whole numbers of days in that range, at most
 * twelve, held longest first. Which category may keep which is not this reader's question — it reads a payload, and
 * `CADENCE_OF_CATEGORY` is enforced where a behaviour is published and where a producer reads it.
 */
export const readNotificationCategory = (
  payload: Record<string, unknown>,
): NotificationCategoryBehaviour | null => {
  const { channels, classification } = payload;
  if (!Array.isArray(channels) || channels.length === 0) return null;
  if (!channels.every(isNotificationChannel)) return null;
  if (new Set(channels).size !== channels.length) return null;
  if (!isNotificationClassification(classification)) return null;

  const { repeatIntervalDays } = payload;
  if (repeatIntervalDays !== undefined && !isCadenceDays(repeatIntervalDays)) return null;
  const leadTimesDays = payload.leadTimesDays === undefined ? undefined : readLeadTimes(payload.leadTimesDays);
  if (leadTimesDays === null) return null;
  return {
    channels,
    classification,
    ...(repeatIntervalDays === undefined ? {} : { repeatIntervalDays }),
    ...(leadTimesDays === undefined ? {} : { leadTimesDays }),
  };
};

/** Lead times longest first, or `null` for anything but distinct whole days within a year, at most twelve. */
function readLeadTimes(value: unknown): readonly number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > CADENCE_MAX_LEAD_TIMES) return null;
  if (!value.every(isCadenceDays) || new Set(value).size !== value.length) return null;
  return [...value].sort((a, b) => b - a);
}

const isCadenceDays = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= CADENCE_MAX_DAYS;
