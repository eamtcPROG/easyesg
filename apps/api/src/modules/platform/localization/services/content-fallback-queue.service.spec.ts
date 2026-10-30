import type { GatheredFallback } from '../domain/fallback-gathering';
import type { ContentFallbackStore } from '../interfaces/content-fallback-store.interface';
import { ContentFallbackQueue } from './content-fallback-queue.service';

/** The store, recording each call in the order made. */
const recordingStore = () => {
  const calls: string[] = [];
  const written: GatheredFallback[][] = [];
  const store: ContentFallbackStore = {
    record: ({ gathered }) => {
      calls.push('record');
      written.push([...gathered]);
      return Promise.resolve();
    },
    clear: () => {
      calls.push('clear');
      return Promise.resolve();
    },
  };
  return { store, calls, written };
};

describe('ContentFallbackQueue (FR-64; 182/38; task 76)', () => {
  it('writes what readers met as one count per key and locale, and nothing when nothing was met', async () => {
    const { store, written } = recordingStore();
    const queue = new ContentFallbackQueue(store);

    queue.report({ key: 'help_article/a', locale: 'en' });
    queue.report({ key: 'help_article/a', locale: 'en' });
    await queue.write();
    await queue.write();

    expect(written).toEqual([[{ key: 'help_article/a', locale: 'en', occurrences: 2 }]]);
  });

  it('writes what it gathered before it clears what is translated, so a stale gap cannot outlive its translation', async () => {
    const { store, calls } = recordingStore();
    const queue = new ContentFallbackQueue(store);

    queue.report({ key: 'help_article/a', locale: 'en' });
    await queue.settle({ translated: [{ key: 'help_article/a', locale: 'en' }] });

    expect(calls).toEqual(['record', 'clear']);
  });

  it('drops the counts of a failed write and says so, rather than keeping a list through an outage', async () => {
    const { store, written } = recordingStore();
    let down = true;
    const flaky: ContentFallbackStore = {
      ...store,
      record: (input) => (down ? Promise.reject(new Error('down')) : store.record(input)),
    };
    const queue = new ContentFallbackQueue(flaky);
    const logged = jest.spyOn(queue['logger'], 'error').mockImplementation(() => undefined);

    queue.report({ key: 'help_article/a', locale: 'en' });
    await queue.write();
    expect(logged).toHaveBeenCalledTimes(1);

    down = false;
    await queue.write();
    expect(written).toEqual([]);
  });
});
