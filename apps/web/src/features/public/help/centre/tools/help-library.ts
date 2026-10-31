import type { HelpArticleSummary, HelpTopic } from '@easyesg/contracts';

/**
 * S-32's library as a reader narrows it (task 77; UC-180; `architecture.md` §12.5.6's task-77 row (13)) — the articles
 * grouped by what the reader is doing, in the topics' order, each group the articles of one topic that match. **Pure**,
 * so the filter is a unit spec rather than a browser journey, and the page stays a Server Component: the narrowing is
 * read from the address (UX-4), applied on the server, and works with no script.
 *
 * **An article whose topic is not in force** is still the reader's to find — the read does not require its topic
 * (task 76's row (2)) — so it is gathered in a last group with no topic, which the page names *Other articles*.
 */
export interface LibraryGroup {
  /** The topic, or `null` for the articles naming none in force. */
  readonly topic: HelpTopic | null;
  readonly articles: readonly HelpArticleSummary[];
}

export interface Library {
  readonly groups: readonly LibraryGroup[];
  /** Articles in the library before any narrowing — a zero here is the first-use state, not *nothing matches*. */
  readonly total: number;
  /** Articles the narrowing kept. */
  readonly matched: number;
}

/** The address's *every topic* — Radix's select admits no empty value, so the choice of none needs a name. */
export const EVERY_TOPIC = 'all';

/**
 * A text folded for matching: marks stripped — so *intreprindere* finds *întreprindere* and *s* finds *ș* — and cased
 * in the reader's language. A reader types what their keyboard has.
 */
const folded = (text: string, locale: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase(locale);

/** Whether every word the reader typed is in the article's title, summary or module. */
const matches = (article: HelpArticleSummary, words: readonly string[], locale: string): boolean => {
  if (words.length === 0) return true;
  const haystack = folded(`${article.title} ${article.summary} ${article.module}`, locale);
  return words.every((word) => haystack.includes(word));
};

export const libraryOf = (input: {
  readonly topics: readonly HelpTopic[];
  readonly articles: readonly HelpArticleSummary[];
  /** The topic the address narrows to, or `EVERY_TOPIC`. */
  readonly topic: string;
  /** What the reader searched for, as typed. */
  readonly query: string;
  readonly locale: string;
}): Library => {
  const words = folded(input.query, input.locale).split(/\s+/u).filter((word) => word !== '');
  const kept = input.articles.filter(
    (article) => (input.topic === EVERY_TOPIC || article.topic === input.topic) && matches(article, words, input.locale),
  );
  const known = new Set(input.topics.map((topic) => topic.key));
  const groups: LibraryGroup[] = input.topics
    .map((topic) => ({ topic, articles: kept.filter((article) => article.topic === topic.key) }))
    .filter((group) => group.articles.length > 0);
  const strays = kept.filter((article) => !known.has(article.topic));
  if (strays.length > 0) groups.push({ topic: null, articles: strays });
  return { groups, total: input.articles.length, matched: kept.length };
};

/** The topic an address names, or `EVERY_TOPIC` for none, an empty one, or one not in force. */
export const topicOf = (input: { readonly requested: string | undefined; readonly topics: readonly HelpTopic[] }): string =>
  input.requested !== undefined && input.topics.some((topic) => topic.key === input.requested)
    ? input.requested
    : EVERY_TOPIC;
