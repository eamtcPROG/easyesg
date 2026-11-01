import { FallbackGathering } from './fallback-gathering';

describe('FallbackGathering', () => {
  it('counts each content key and locale once, however many readers met it', () => {
    const gathering = new FallbackGathering();
    gathering.add({ key: 'help_article/a', locale: 'en' });
    gathering.add({ key: 'help_article/a', locale: 'en' });
    gathering.add({ key: 'help_article/a', locale: 'ru' });
    gathering.add({ key: 'plan_copy/standard', locale: 'en' });

    expect(gathering.take()).toEqual([
      { key: 'help_article/a', locale: 'en', occurrences: 2 },
      { key: 'help_article/a', locale: 'ru', occurrences: 1 },
      { key: 'plan_copy/standard', locale: 'en', occurrences: 1 },
    ]);
  });

  it('starts again once taken, so nothing is written twice', () => {
    const gathering = new FallbackGathering();
    gathering.add({ key: 'help_topic/t', locale: 'ru' });
    gathering.take();
    expect(gathering.take()).toEqual([]);
  });
});
