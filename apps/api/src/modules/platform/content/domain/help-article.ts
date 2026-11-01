import { type FieldRead, NOT_AN_OBJECT, isRecord, readKey, readOrder, readText } from './content-payload';
import { type Localized, readLocalized } from './localized';

/**
 * A help article (task 76; UC-181; `architecture.md` §12.5.6's task-76 row (2)). What does not vary by language once —
 * its topic, its place, the articles it names to read next — and per locale a title, a summary, the module it belongs
 * to as the reader is told it, and ordered sections. **A section's body is a small Markdown subset** — paragraphs,
 * lists, emphasis, links — which `apps/web` renders with raw HTML off (task 77); S-33's *On this page* is the
 * sections' headings, and a disclosed section is one the reader opens (UX-17).
 */
export interface HelpArticleSection {
  readonly heading: string;
  readonly body: string;
  readonly disclosed: boolean;
}

export interface HelpArticleText {
  readonly title: string;
  readonly summary: string;
  readonly module: string;
  readonly sections: readonly HelpArticleSection[];
}

export interface HelpArticle {
  /** The topic it is grouped under — a key, which the read does not require to be in force. */
  readonly topic: string;
  readonly order: number;
  /** The articles it names to read next, in order; one not in force is left out when it is read. */
  readonly related: readonly string[];
  readonly text: Localized<HelpArticleText>;
}

const readSection = (value: unknown): FieldRead<HelpArticleSection> => {
  if (!isRecord(value)) return { fault: NOT_AN_OBJECT };
  const heading = readText(value.heading);
  if ('fault' in heading) return { fault: `its heading ${heading.fault}` };
  const body = readText(value.body);
  if ('fault' in body) return { fault: `its body ${body.fault}` };
  if (typeof value.disclosed !== 'boolean') return { fault: 'does not say whether it is disclosed' };
  return { value: { heading: heading.value, body: body.value, disclosed: value.disclosed } };
};

const readArticleText = (block: unknown): FieldRead<HelpArticleText> => {
  if (!isRecord(block)) return { fault: NOT_AN_OBJECT };
  const title = readText(block.title);
  if ('fault' in title) return { fault: `its title ${title.fault}` };
  const summary = readText(block.summary);
  if ('fault' in summary) return { fault: `its summary ${summary.fault}` };
  const module = readText(block.module);
  if ('fault' in module) return { fault: `its module ${module.fault}` };
  if (!Array.isArray(block.sections) || block.sections.length === 0) return { fault: 'has no section' };
  const sections: HelpArticleSection[] = [];
  for (const [index, entry] of block.sections.entries()) {
    const section = readSection(entry);
    if ('fault' in section) return { fault: `its section ${index + 1} ${section.fault}` };
    sections.push(section.value);
  }
  return { value: { title: title.value, summary: summary.value, module: module.value, sections } };
};

const readRelated = (value: unknown): FieldRead<string[]> => {
  if (value === undefined) return { value: [] };
  if (!Array.isArray(value)) return { fault: 'is not a list' };
  const keys: string[] = [];
  for (const [index, entry] of value.entries()) {
    const key = readKey(entry);
    if ('fault' in key) return { fault: `entry ${index + 1} ${key.fault}` };
    keys.push(key.value);
  }
  return { value: keys };
};

const readArticle = (payload: unknown): FieldRead<HelpArticle> => {
  if (!isRecord(payload)) return { fault: NOT_AN_OBJECT };
  const topic = readKey(payload.topic);
  if ('fault' in topic) return { fault: `its topic ${topic.fault}` };
  const order = readOrder(payload.order);
  if ('fault' in order) return { fault: `its order ${order.fault}` };
  const related = readRelated(payload.related);
  if ('fault' in related) return { fault: `its articles to read next: ${related.fault}` };
  const text = readLocalized({ value: payload.locales, readBlock: readArticleText });
  if ('fault' in text) return { fault: text.fault };
  return { value: { topic: topic.value, order: order.value, related: related.value, text: text.value } };
};

/** A payload read as an article, or `null` — read whole or not at all. */
export const readHelpArticle = (payload: unknown): HelpArticle | null => {
  const read = readArticle(payload);
  return 'value' in read ? read.value : null;
};

/** Why the store refuses a payload of this kind, or `null` (`configuration-kind-rules.ts`), the seed loader included. */
export const helpArticleRefusal = (payload: unknown): string | null => {
  const read = readArticle(payload);
  return 'fault' in read ? `a help article the reader would not read: ${read.fault}` : null;
};
