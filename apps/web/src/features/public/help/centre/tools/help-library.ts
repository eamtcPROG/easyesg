import type { HelpArticleSummary, HelpTopic } from '@easyesg/contracts';

/**
 * S-32's library as a reader narrows it and as the artboards lay it out (tasks 77, 227; UC-180; `architecture.md`
 * §12.5.6's task-77 row (13) and task-227 row (1), (3)) — the topics as cards, the visitor's questions, and the
 * articles a topic or a search keeps. **Pure**, so each is a unit spec rather than a browser journey, and the page stays
 * a Server Component: the narrowing is read from the address (UX-4), applied on the server, and works with no script.
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

/** A topic's card (artboards 01 and 02): the topic, how many articles it holds, and the first of them, in order. */
export interface TopicCard {
  readonly group: LibraryGroup;
  /** The articles the card names — the topic's first, in the library's order. */
  readonly featured: readonly HelpArticleSummary[];
}

/** How many of its articles a topic's card names (artboard 01). */
const FEATURED_PER_CARD = 2;

/**
 * The topic the visitor's *Asked before signing up* reads (the task-227 row (3)): the starter library's first-report
 * topic, whose articles' titles are the questions and whose summaries are the answers. A store key, stable as the
 * address of a topic is; withdrawn, the block is simply absent.
 */
export const ASKED_BEFORE_SIGNING_UP_TOPIC = 'first-report';

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
  /** The topic the address narrows to, or `null` for every topic. */
  readonly topic: string | null;
  /** What the reader searched for, as typed. */
  readonly query: string;
  /** The language the help is read in, which decides how words fold. */
  readonly locale: string;
}): Library => {
  const words = folded(input.query, input.locale).split(/\s+/u).filter((word) => word !== '');
  const kept = input.articles.filter(
    (article) => (input.topic === null || article.topic === input.topic) && matches(article, words, input.locale),
  );
  const known = new Set(input.topics.map((topic) => topic.key));
  const groups: LibraryGroup[] = input.topics
    .map((topic) => ({ topic, articles: kept.filter((article) => article.topic === topic.key) }))
    .filter((group) => group.articles.length > 0);
  const strays = kept.filter((article) => !known.has(article.topic));
  if (strays.length > 0) groups.push({ topic: null, articles: strays });
  return { groups, total: input.articles.length, matched: kept.length };
};

/** The whole library's groups as cards, each naming its first articles (artboards 01 and 02). */
export const topicCardsOf = (library: Library): readonly TopicCard[] =>
  library.groups.map((group) => ({ group, featured: group.articles.slice(0, FEATURED_PER_CARD) }));

/** The articles of the visitor's *Asked before signing up*, in order — none where the topic is not in force. */
export const askedBeforeSigningUpOf = (input: {
  readonly topics: readonly HelpTopic[];
  readonly articles: readonly HelpArticleSummary[];
}): readonly HelpArticleSummary[] =>
  input.topics.some((topic) => topic.key === ASKED_BEFORE_SIGNING_UP_TOPIC)
    ? input.articles.filter((article) => article.topic === ASKED_BEFORE_SIGNING_UP_TOPIC)
    : [];

/**
 * How many articles the chosen language lacks and are read in Romanian instead (the task-227 row (2)) — marked rather
 * than hidden, and counted beside the choice.
 */
export const fallbackCountOf = (input: {
  readonly articles: readonly HelpArticleSummary[];
  readonly content: string;
}): number => input.articles.filter((article) => article.locale !== input.content).length;

/** The topic an address names, or `null` for none, an empty one, or one not in force. */
export const topicOf = (input: {
  readonly requested: string | undefined;
  readonly topics: readonly HelpTopic[];
}): HelpTopic | null => input.topics.find((topic) => topic.key === input.requested) ?? null;
