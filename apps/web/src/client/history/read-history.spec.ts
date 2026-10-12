import { describe, expect, it, vi } from 'vitest';
import { HISTORY_SUBJECT } from './history-subject';
import { readHistory } from './read-history';

const answering = (status: number, body: unknown) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

const ENTRY = {
  at: 1785843060000,
  actor: { accountId: '0192f000-0000-7000-8000-00000000a001', name: 'Ana Rusu', removed: false },
  source: 'typed',
  changes: [{ field: null, from: '31', to: '52' }],
};

const FIELD = {
  kind: HISTORY_SUBJECT.VALUE,
  reportId: 'r 1',
  elementKey: 'NumberOfEmployees',
  dimensionKey: '',
  ordinal: 0,
} as const;

/** S-12's read (task 84.2): one page of a subject's history through the pass-through, or `null` for anything else. */
describe('readHistory', () => {
  it('asks a page in the compact list format beside the field’s own query, and reads the entries and the total', async () => {
    const send = answering(200, { objects: [ENTRY], total: 21, totalpages: 2, messages: [] });

    await expect(
      readHistory({ subject: { ...FIELD, ordinal: 1 }, page: 2, fetch: send }),
    ).resolves.toEqual({ entries: [ENTRY], total: 21 });
    expect(send).toHaveBeenCalledWith(
      '/api/v1/reports/r%201/values/NumberOfEmployees/history?ordinal=1&page=2&onpage=20',
      expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }),
    );
  });

  it.each([
    ['a refusal', answering(403, { type: 'insufficient-role' })],
    ['a body that is not the list envelope', answering(200, { items: [ENTRY] })],
    ['an entry missing what the panel draws', answering(200, { objects: [{ at: 1 }], total: 1, totalpages: 1, messages: [] })],
    ['no answer', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'))],
  ])('answers null for %s', async (_case, send) => {
    await expect(readHistory({ subject: { kind: HISTORY_SUBJECT.ORGANIZATION }, page: 1, fetch: send })).resolves.toBeNull();
  });
});
