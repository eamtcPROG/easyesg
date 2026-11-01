import { LOCALES } from '@easyesg/i18n';
import { readSeedEntries } from '@api/testing/seed-configuration-store';
import { CONTENT_KIND } from './constants/content.constants';
import { readHelpArticle } from './domain/help-article';
import { readHelpTopic } from './domain/help-topic';
import { translatedLocales } from './domain/localized';

/**
 * The starter help library `config/seed` ships (task 76; `architecture.md` §12.5.6's task-76 row (7)) — read by the
 * reader the store's publication rule is, so a file the loader would refuse fails here first, with the reason.
 */
describe('the seeded help library (FR-61; task 76)', () => {
  const entries = readSeedEntries();
  const topics = entries.filter((entry) => entry.kind === CONTENT_KIND.HELP_TOPIC);
  const articles = entries.filter((entry) => entry.kind === CONTENT_KIND.HELP_ARTICLE);
  const topicKeys = new Set(topics.map((topic) => topic.scope));
  const articleKeys = new Set(articles.map((article) => article.scope));

  it('ships six topics and an article in each, every one readable whole', () => {
    expect(topics).toHaveLength(6);
    expect(topics.every((topic) => readHelpTopic(topic.payload) !== null)).toBe(true);
    expect(articles.every((article) => readHelpArticle(article.payload) !== null)).toBe(true);
    expect(new Set(articles.map((article) => readHelpArticle(article.payload)?.topic))).toEqual(topicKeys);
  });

  it('names only seeded articles to read next, and never the article itself', () => {
    for (const article of articles) {
      const related = readHelpArticle(article.payload)?.related ?? [];
      expect(related.filter((key) => !articleKeys.has(key) || key === article.scope)).toEqual([]);
    }
  });

  it('is written in every locale the build registers, so nothing shipped falls back', () => {
    for (const entry of [...topics, ...articles]) {
      const item = entry.kind === CONTENT_KIND.HELP_TOPIC ? readHelpTopic(entry.payload) : readHelpArticle(entry.payload);
      expect([entry.scope, item === null ? [] : translatedLocales(item.text)]).toEqual([entry.scope, [...LOCALES]]);
    }
  });

  it('ships no plan copy: which plans exist is 53.1’s, and their copy 53.3’s', () => {
    expect(entries.filter((entry) => entry.kind === CONTENT_KIND.PLAN_COPY)).toEqual([]);
  });
});
