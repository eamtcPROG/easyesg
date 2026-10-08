import {
  NOTIFICATION_CADENCE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CLASSIFICATION,
  type CategoryBehaviourRequest,
  type ConsoleCategory,
  type NotificationCadence,
  type NotificationClassification,
} from '@easyesg/contracts';

/**
 * A-17's behaviour form and the wire (task 67.10). **One checkbox per channel**, so the fields are two booleans and the
 * request is the channels they name, in the vocabulary's order — the order the api stores and compares in.
 */
export interface CategoryBehaviourFields {
  inApp: boolean;
  email: boolean;
  classification: NotificationClassification;
  /**
   * The cadence, as typed (task 51.2): a repeat interval in days, or lead times as days separated by commas — offered
   * only on the category whose cadence code declares (`ConsoleCategory.cadence`), and empty on every other.
   */
  repeatIntervalDays: string;
  leadTimesDays: string;
}

/**
 * Which controls an operator may change (task 67.10; §5.2 A-17 as amended 21 Sep 2026) — **read from what the api says
 * code declares**, never re-derived here: a mandatory category's classification is fixed and its email always on, and
 * a notice sent to an address never travels in-app. The api refuses all three whatever this says; this is so the
 * editor shows a fixed value as fixed rather than offering a choice the platform would refuse to obey.
 */
export interface EditableControls {
  readonly inApp: boolean;
  readonly email: boolean;
  readonly classification: boolean;
}

export const editableControlsOf = (category: Pick<ConsoleCategory, 'mandatory' | 'addressNotice'>): EditableControls => ({
  inApp: !category.addressNotice,
  email: !category.mandatory,
  classification: !category.mandatory,
});

/**
 * Whether anything about the category is the operator's to change — false draws the facts with no form, and since
 * task 170 makes the row's opener *view* rather than *edit*, so the row and the record answer from one rule.
 */
export const anyEditable = (controls: EditableControls): boolean =>
  controls.inApp || controls.email || controls.classification;

/**
 * The form's starting values: what is in force, or — where nothing is, or it cannot be read — no channel, and the
 * classification code fixes for a mandatory category.
 */
export const behaviourFieldsOf = (category: ConsoleCategory): CategoryBehaviourFields => {
  const channels = category.inForce?.channels ?? [];
  return {
    inApp: channels.includes(NOTIFICATION_CHANNEL.IN_APP),
    email: channels.includes(NOTIFICATION_CHANNEL.EMAIL),
    classification:
      category.inForce?.classification ??
      (category.mandatory ? NOTIFICATION_CLASSIFICATION.TRANSACTIONAL : NOTIFICATION_CLASSIFICATION.OPTIONAL),
    repeatIntervalDays: category.inForce?.repeatIntervalDays?.toString() ?? '',
    leadTimesDays: (category.inForce?.leadTimesDays ?? []).join(', '),
  };
};

/**
 * The request, its cadence carried only for the category that keeps one (task 51.2) — the api refuses a cadence on any
 * other, and one missing from the category that keeps it.
 */
export const behaviourRequestOf = (input: {
  readonly fields: CategoryBehaviourFields;
  readonly cadence: NotificationCadence | null;
}): CategoryBehaviourRequest => {
  const { fields, cadence } = input;
  const leadTimes = readLeadTimes(fields.leadTimesDays);
  return {
    channels: [
      ...(fields.inApp ? [NOTIFICATION_CHANNEL.IN_APP] : []),
      ...(fields.email ? [NOTIFICATION_CHANNEL.EMAIL] : []),
    ],
    classification: fields.classification,
    ...(cadence === NOTIFICATION_CADENCE.REPEAT_INTERVAL ? { repeatIntervalDays: Number(fields.repeatIntervalDays) } : {}),
    ...(cadence === NOTIFICATION_CADENCE.LEAD_TIMES && leadTimes !== null ? { leadTimesDays: leadTimes } : {}),
  };
};

const WHOLE_DAYS = /^[1-9]\d*$/u;

/**
 * A repeat interval as typed, or `null` for anything but a whole number of days from one. **The field's shape only**:
 * the longest interval the platform keeps is the api's to refuse, worded by it, so the bound is stated once.
 */
export const readRepeatInterval = (text: string): number | null =>
  WHOLE_DAYS.test(text.trim()) ? Number(text.trim()) : null;

/**
 * Lead times as typed — whole days separated by commas or spaces, each named once — longest first, as the api holds
 * them; `null` for an empty list or anything else. The shape only, as `readRepeatInterval`'s.
 */
export function readLeadTimes(text: string): number[] | null {
  const parts = text.split(/[\s,;]+/u).filter((part) => part !== '');
  if (parts.length === 0 || !parts.every((part) => WHOLE_DAYS.test(part))) return null;
  const days = parts.map(Number);
  return new Set(days).size === days.length ? days.toSorted((a, b) => b - a) : null;
}
