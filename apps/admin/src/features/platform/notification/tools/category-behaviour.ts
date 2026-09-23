import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CLASSIFICATION,
  type CategoryBehaviourRequest,
  type ConsoleCategory,
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

/** Whether anything about the category is the operator's to change — false draws the facts with no form. */
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
  };
};

export const behaviourRequestOf = (fields: CategoryBehaviourFields): CategoryBehaviourRequest => ({
  channels: [
    ...(fields.inApp ? [NOTIFICATION_CHANNEL.IN_APP] : []),
    ...(fields.email ? [NOTIFICATION_CHANNEL.EMAIL] : []),
  ],
  classification: fields.classification,
});
