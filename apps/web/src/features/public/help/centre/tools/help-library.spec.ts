import type { HelpArticleSummary, HelpTopic } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { askedBeforeSigningUpOf, fallbackCountOf, libraryOf, topicCardsOf, topicOf } from './help-library';

const topic = (key: string): HelpTopic => ({ key, locale: 'ro', title: key, summary: `${key}.` });
const article = (key: string, topicKey: string, title: string, module = 'B3'): HelpArticleSummary => ({
  key,
  topic: topicKey,
  locale: 'ro',
  title,
  summary: 'Pe scurt.',
  module,
});

const TOPICS = [topic('first-report'), topic('figures')];
const ARTICLES = [
  article('energy', 'figures', 'Facturile de energie în B3'),
  article('asks', 'first-report', 'Ce cere raportul', 'B1 – B11'),
  article('roles', 'gone-topic', 'Ce poate face fiecare rol', 'Utilizatori'),
];

describe('libraryOf (S-32; tasks 77, 227)', () => {
  it('groups the library by topic, in the topics’ order, with the articles naming no topic in force last', () => {
    const library = libraryOf({ topics: TOPICS, articles: ARTICLES, topic: null, query: '', locale: 'ro' });
    expect(library.groups.map((group) => [group.topic?.key ?? null, group.articles.map((entry) => entry.key)])).toEqual([
      ['first-report', ['asks']],
      ['figures', ['energy']],
      [null, ['roles']],
    ]);
    expect(library).toMatchObject({ total: 3, matched: 3 });
  });

  it('narrows to one topic and leaves out the groups it empties', () => {
    const library = libraryOf({ topics: TOPICS, articles: ARTICLES, topic: 'figures', query: '', locale: 'ro' });
    expect(library.groups.map((group) => group.topic?.key)).toEqual(['figures']);
    expect(library).toMatchObject({ total: 3, matched: 1 });
  });

  it('finds every word typed in a title, summary or module, without its marks and in any case', () => {
    const search = (query: string) =>
      libraryOf({ topics: TOPICS, articles: ARTICLES, topic: null, query, locale: 'ro' }).groups.flatMap((group) =>
        group.articles.map((entry) => entry.key),
      );
    expect(search('ENERGIE b3')).toEqual(['energy']);
    expect(search('facturile')).toEqual(['energy']);
    expect(search('ce poate')).toEqual(['roles']);
    expect(search('utilizatori   rol')).toEqual(['roles']);
    expect(search('nimic')).toEqual([]);
  });

  it('folds a mark the reader did not type — ș, î', () => {
    const library = libraryOf({
      topics: TOPICS,
      articles: [article('a', 'figures', 'Întreprinderea și emisiile')],
      topic: null,
      query: 'intreprinderea si',
      locale: 'ro',
    });
    expect(library.matched).toBe(1);
  });

  it('tells nothing matching from an empty library', () => {
    expect(libraryOf({ topics: TOPICS, articles: ARTICLES, topic: null, query: 'nimic', locale: 'ro' })).toMatchObject({
      total: 3,
      matched: 0,
      groups: [],
    });
    expect(libraryOf({ topics: [], articles: [], topic: null, query: '', locale: 'ro' })).toMatchObject({
      total: 0,
      matched: 0,
    });
  });
});

describe('topicOf (tasks 77, 227)', () => {
  it('answers a topic in force, and nothing for anything else', () => {
    expect(topicOf({ requested: 'figures', topics: TOPICS })?.key).toBe('figures');
    expect(topicOf({ requested: 'nowhere', topics: TOPICS })).toBeNull();
    expect(topicOf({ requested: undefined, topics: TOPICS })).toBeNull();
  });
});

describe('topicCardsOf (task 227)', () => {
  it('names each topic’s first two articles, in order, and keeps its whole count', () => {
    const library = libraryOf({
      topics: TOPICS,
      articles: [...ARTICLES, article('fuel', 'figures', 'Combustibil'), article('heat', 'figures', 'Căldură')],
      topic: null,
      query: '',
      locale: 'ro',
    });
    expect(
      topicCardsOf(library).map((card) => [card.group.topic?.key ?? null, card.group.articles.length, card.featured.map((entry) => entry.key)]),
    ).toEqual([
      ['first-report', 1, ['asks']],
      ['figures', 3, ['energy', 'fuel']],
      [null, 1, ['roles']],
    ]);
  });
});

describe('askedBeforeSigningUpOf (task 227)', () => {
  it('reads the first-report topic’s articles', () => {
    expect(askedBeforeSigningUpOf({ topics: TOPICS, articles: ARTICLES }).map((entry) => entry.key)).toEqual(['asks']);
  });

  it('answers none where that topic is not in force, whatever its articles still name', () => {
    expect(askedBeforeSigningUpOf({ topics: [topic('figures')], articles: ARTICLES })).toEqual([]);
  });
});

describe('fallbackCountOf (task 227)', () => {
  it('counts the articles read in another language than the one chosen', () => {
    const russian = { ...ARTICLES[0], locale: 'ru' as const };
    expect(fallbackCountOf({ articles: [russian, ARTICLES[1], ARTICLES[2]], content: 'ru' })).toBe(2);
    expect(fallbackCountOf({ articles: ARTICLES, content: 'ro' })).toBe(0);
  });
});
