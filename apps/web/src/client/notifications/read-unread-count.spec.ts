import { describe, expect, it, vi } from 'vitest';
import { readUnreadCount } from './read-unread-count';

const answering = (status: number, body: unknown) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

/** The unread count's read (task 50.2.1): the count through the pass-through, or `null` for anything else. */
describe('readUnreadCount', () => {
  it('reads the count from the envelope, through the pass-through, with the session cookie', async () => {
    const send = answering(200, { object: { unread: 4 }, messages: [] });

    await expect(readUnreadCount({ fetch: send })).resolves.toBe(4);
    expect(send).toHaveBeenCalledWith(
      '/api/v1/notifications/unread-count',
      expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }),
    );
  });

  it.each([
    ['a refusal', answering(401, { type: 'authentication-required' })],
    ['a body that is not the envelope', answering(200, { unread: 4 })],
    ['a count that is not a number', answering(200, { object: { unread: '4' }, messages: [] })],
    ['a count that is not a whole number', answering(200, { object: { unread: 4.5 }, messages: [] })],
    ['a negative count', answering(200, { object: { unread: -1 }, messages: [] })],
    ['no answer', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'))],
  ])('answers null for %s', async (_case, send) => {
    await expect(readUnreadCount({ fetch: send })).resolves.toBeNull();
  });
});
