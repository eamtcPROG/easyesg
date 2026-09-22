import { describe, expect, it, vi } from 'vitest';
import { readNotices } from './read-notices';

const answering = (status: number, body: unknown) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

const ITEM = {
  id: '0192f000-0000-7000-8000-00000000a001',
  categoryKey: 'identity.invitation',
  deepLink: '/reports',
  receivedAt: 1,
  readAt: null,
};

/** The panel's read (task 50.2.2): one page of the centre through the pass-through, or `null` for anything else. */
describe('readNotices', () => {
  it('asks the pass-through in the compact list format, and reads the page and both counts', async () => {
    const send = answering(200, { objects: [ITEM], total: 1, totalpages: 1, unfiltered: 4, messages: [] });

    await expect(
      readNotices({ query: { filters: [{ field: 'read', values: ['unread'] }], page: 1, onpage: 10 }, fetch: send }),
    ).resolves.toEqual({ items: [ITEM], matched: 1, total: 4 });
    expect(send).toHaveBeenCalledWith(
      '/api/v1/notifications?filters=read%2Cunread&page=1&onpage=10',
      expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }),
    );
  });

  it.each([
    ['a refusal', answering(403, { type: 'membership-required' })],
    ['a body that is not the list envelope', answering(200, { items: [ITEM] })],
    ['no answer', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'))],
  ])('answers null for %s', async (_case, send) => {
    await expect(readNotices({ query: {}, fetch: send })).resolves.toBeNull();
  });
});
