import { SORT_DIRECTION } from '@api/contracts/types/list-query';
import { toExportHistoryQuery } from './export-history-query';

const REPORT = '00000000-0000-0000-0000-0000000000f1';
const list = (over: { filters?: { field: string; values: string[] }[]; order?: { field: string; direction: 'asc' | 'desc' }[] } = {}) => ({
  filters: over.filters ?? [],
  order: over.order ?? [],
  skip: 25,
  take: 25,
});

/** S-11's history query (task 47.1): four facets, one ordering, and nothing refused for a stale address. */
describe('toExportHistoryQuery', () => {
  it('reads the four facets, dropping what no export can hold', () => {
    const query = toExportHistoryQuery({
      reportId: REPORT,
      fallbackTake: 25,
      list: list({
        filters: [
          { field: 'format', values: ['pdf', 'xbrl', 'pdf'] },
          { field: 'language', values: ['ro', 'de'] },
          { field: 'taxonomyVersion', values: ['2026-05-01', 'latest'] },
          { field: 'status', values: ['completed', 'downloaded'] },
        ],
      }),
    });
    expect(query).toMatchObject({
      formats: ['pdf'],
      locales: ['ro'],
      taxonomyVersions: ['2026-05-01'],
      statuses: ['completed'],
      skip: 25,
      take: 25,
    });
  });

  it('orders newest first unless asked for the oldest by when it was requested', () => {
    expect(toExportHistoryQuery({ reportId: REPORT, fallbackTake: 25, list: list() }).newestFirst).toBe(true);
    const oldest = list({ order: [{ field: 'requested', direction: SORT_DIRECTION.ASC }] });
    expect(toExportHistoryQuery({ reportId: REPORT, fallbackTake: 25, list: oldest }).newestFirst).toBe(false);
    const elsewhere = list({ order: [{ field: 'size', direction: SORT_DIRECTION.ASC }] });
    expect(toExportHistoryQuery({ reportId: REPORT, fallbackTake: 25, list: elsewhere }).newestFirst).toBe(true);
  });
});
