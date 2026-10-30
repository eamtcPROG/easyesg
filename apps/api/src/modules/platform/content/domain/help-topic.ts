import { type FieldRead, NOT_AN_OBJECT, isRecord, readOrder, readText } from './content-payload';
import { type Localized, readLocalized } from './localized';

/**
 * A help topic — S-32's *what you are doing* (task 76; `architecture.md` §12.5.6's task-76 row (2)). Content rather
 * than a committed vocabulary, because its words are help-centre text, which OQ-43 puts in the store.
 */
export interface HelpTopicText {
  readonly title: string;
  readonly summary: string;
}

export interface HelpTopic {
  readonly order: number;
  readonly text: Localized<HelpTopicText>;
}

const readTopicText = (block: unknown): FieldRead<HelpTopicText> => {
  if (!isRecord(block)) return { fault: NOT_AN_OBJECT };
  const title = readText(block.title);
  if ('fault' in title) return { fault: `its title ${title.fault}` };
  const summary = readText(block.summary);
  if ('fault' in summary) return { fault: `its summary ${summary.fault}` };
  return { value: { title: title.value, summary: summary.value } };
};

const readTopic = (payload: unknown): FieldRead<HelpTopic> => {
  if (!isRecord(payload)) return { fault: NOT_AN_OBJECT };
  const order = readOrder(payload.order);
  if ('fault' in order) return { fault: `its order ${order.fault}` };
  const text = readLocalized({ value: payload.locales, readBlock: readTopicText });
  if ('fault' in text) return { fault: text.fault };
  return { value: { order: order.value, text: text.value } };
};

/** A payload read as a topic, or `null` — read whole or not at all. */
export const readHelpTopic = (payload: unknown): HelpTopic | null => {
  const read = readTopic(payload);
  return 'value' in read ? read.value : null;
};

/** Why the store refuses a payload of this kind, or `null` (`configuration-kind-rules.ts`), the seed loader included. */
export const helpTopicRefusal = (payload: unknown): string | null => {
  const read = readTopic(payload);
  return 'fault' in read ? `a help topic the reader would not read: ${read.fault}` : null;
};
