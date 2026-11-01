import { Logger } from '@nestjs/common';
import type { FallbackReport } from '@easyesg/i18n';
import { type SeedEntry, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { CONTENT_KIND } from '../constants/content.constants';
import { HelpArticleNotFoundError } from '../errors/content.errors';
import { ContentService } from './content.service';
import { PublishedContentReader } from './published-content-reader.service';

const section = (heading: string) => ({ heading, body: `${heading}.`, disclosed: false });
const article = (title: string) => ({ title, summary: `${title}, pe scurt.`, module: 'B1', sections: [section('A')] });

const entry = (kind: string, scope: string, payload: Record<string, unknown>, revision = 1): SeedEntry => ({
  kind,
  scope,
  revision,
  payload,
});

const ENTRIES: SeedEntry[] = [
  entry(CONTENT_KIND.HELP_TOPIC, 'first-report', {
    order: 1,
    locales: { ro: { title: 'Primul raport', summary: 'Început.' }, en: { title: 'First report', summary: 'Start.' } },
  }),
  entry(CONTENT_KIND.HELP_ARTICLE, 'locking', {
    topic: 'first-report',
    order: 2,
    related: ['gone', 'what-vsme-asks'],
    locales: { ro: article('Blocarea'), en: article('Locking') },
  }),
  entry(CONTENT_KIND.HELP_ARTICLE, 'what-vsme-asks', {
    topic: 'first-report',
    order: 1,
    locales: { ro: article('Ce cere VSME') },
  }),
  entry(CONTENT_KIND.PLAN_COPY, 'standard', {
    order: 1,
    locales: { ro: { name: 'Standard', summary: 'Mai mulți colegi.', highlights: ['Cinci entități'] } },
  }),
];

const serviceOver = (entries: readonly SeedEntry[]) => {
  const reported: FallbackReport[] = [];
  const service = new ContentService(new PublishedContentReader(seedConfigurationStore(entries)), {
    report: (report) => reported.push(report),
  });
  return { service, reported };
};

describe('ContentService (FR-61, FR-64; task 76)', () => {
  it('lists the library in order, each article in the locale asked for or in Romanian', () => {
    const { service } = serviceOver(ENTRIES);
    expect(service.helpArticles({ locale: 'en' }).map((item) => [item.key, item.served.locale])).toEqual([
      ['what-vsme-asks', 'ro'],
      ['locking', 'en'],
    ]);
  });

  it('reports each item a reader was shown in Romanian, under its content key and the locale asked for', () => {
    const { service, reported } = serviceOver(ENTRIES);
    service.helpArticles({ locale: 'en' });
    service.planCopy({ locale: 'ru' });
    service.helpTopics({ locale: 'en' });
    expect(reported).toEqual([
      { key: 'help_article/what-vsme-asks', locale: 'en' },
      { key: 'plan_copy/standard', locale: 'ru' },
    ]);
  });

  it('reports nothing for Romanian, which every item carries', () => {
    const { service, reported } = serviceOver(ENTRIES);
    service.helpArticles({ locale: 'ro' });
    expect(reported).toEqual([]);
  });

  it('serves one article with what it names to read next that is in force, and reports what was shown', () => {
    const { service, reported } = serviceOver(ENTRIES);
    const { article: served, related } = service.helpArticle({ key: 'locking', locale: 'en' });
    expect(served.served).toMatchObject({ locale: 'en', fellBack: false });
    expect(related.map((item) => [item.key, item.served.locale])).toEqual([['what-vsme-asks', 'ro']]);
    expect(reported).toEqual([{ key: 'help_article/what-vsme-asks', locale: 'en' }]);
  });

  it('answers not found for a key with no article in force — a draft has no address', () => {
    const { service, reported } = serviceOver(ENTRIES);
    expect(() => service.helpArticle({ key: 'draft-only', locale: 'ro' })).toThrow(HelpArticleNotFoundError);
    expect(reported).toEqual([]);
  });

  it('leaves out an item the store holds unreadable rather than half-showing it', () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service } = serviceOver([...ENTRIES, entry(CONTENT_KIND.HELP_TOPIC, 'broken', { order: 2, locales: {} })]);
    expect(service.helpTopics({ locale: 'ro' }).map((item) => item.key)).toEqual(['first-report']);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('help_topic/broken (revision 1) is not readable'));
    logged.mockRestore();
  });
});
