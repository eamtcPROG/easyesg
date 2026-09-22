import { describe, expect, it, vi } from 'vitest';
import { markNoticeOpened } from './mark-notice-opened';

/** Opening a notice marks it read (task 50.2.1): one keepalive write through the pass-through, never awaited. */
describe('markNoticeOpened', () => {
  it("posts the notice's read mark as a keepalive, same-origin request", () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));

    markNoticeOpened({ notificationId: '0192f000-0000-7000-8000-000000000001', fetch: send });

    expect(send).toHaveBeenCalledWith('/api/v1/notifications/0192f000-0000-7000-8000-000000000001/read', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
    });
  });

  it('runs its callback once the mark has landed, and not before', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const onSent = vi.fn();

    markNoticeOpened({ notificationId: 'n-1', onSent, fetch: send });
    expect(onSent).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
  });

  it('swallows a failed send, since the navigation it rides on has already begun', async () => {
    const send = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));

    expect(() => markNoticeOpened({ notificationId: 'n-1', fetch: send })).not.toThrow();
    await Promise.resolve();
  });
});
