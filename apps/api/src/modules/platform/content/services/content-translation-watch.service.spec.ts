import type { FallbackReport } from '@easyesg/i18n';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { CONTENT_KIND } from '../constants/content.constants';
import { ContentTranslationWatch } from './content-translation-watch.service';
import { PublishedContentReader } from './published-content-reader.service';

const TOPIC = {
  kind: CONTENT_KIND.HELP_TOPIC,
  scope: 'first-report',
  revision: 1,
  payload: {
    order: 1,
    locales: { ro: { title: 'Primul raport', summary: 'Început.' }, ru: { title: 'Первый отчёт', summary: 'Начало.' } },
  },
};

/** The seed double, with a cache version the case moves by hand. */
const storeAt = (version: { value: bigint }): ConfigurationStore => {
  const store = seedConfigurationStore([TOPIC]);
  Object.defineProperty(store, 'cachedVersion', { get: () => version.value });
  return store;
};

describe('ContentTranslationWatch (FR-64; 182/38; task 76)', () => {
  it('hands the queue every translated pair once per move of the store’s version', async () => {
    const version = { value: 7n };
    const store = storeAt(version);
    const settled: (readonly FallbackReport[])[] = [];
    const watch = new ContentTranslationWatch(store, new PublishedContentReader(store), {
      settle: ({ translated }) => {
        settled.push(translated);
        return Promise.resolve();
      },
    });

    await watch.settleIfMoved();
    await watch.settleIfMoved();
    expect(settled).toEqual([
      [
        { key: 'help_topic/first-report', locale: 'ro' },
        { key: 'help_topic/first-report', locale: 'ru' },
      ],
    ]);

    version.value = 8n;
    await watch.settleIfMoved();
    expect(settled).toHaveLength(2);
  });

  it('tries again on the next tick when the queue could not be settled', async () => {
    const store = storeAt({ value: 1n });
    const settle = jest.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(undefined);
    const watch = new ContentTranslationWatch(store, new PublishedContentReader(store), { settle });
    jest.spyOn(watch['logger'], 'error').mockImplementation(() => undefined);

    await watch.settleIfMoved();
    await watch.settleIfMoved();
    expect(settle).toHaveBeenCalledTimes(2);
  });
});
