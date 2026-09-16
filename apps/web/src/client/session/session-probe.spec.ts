import { describe, expect, it, vi } from 'vitest';
import { probeSession } from './session-probe';

/** The probe's reading (task 92): `401` ends the session and nothing else does, no answer included. */
const answering = (status: number) =>
  vi.fn(() => Promise.resolve(new Response(null, { status }))) as unknown as typeof fetch;

describe('probeSession', () => {
  it('asks the web tier’s standing route, same-origin and uncached', async () => {
    const fetchImpl = answering(204);
    await probeSession({ fetch: fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('/auth/session', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
  });

  it('reads 401 as ended', async () => {
    await expect(probeSession({ fetch: answering(401) })).resolves.toBe('ended');
  });

  it('reads every other answer as held — 204, a 503, a 403', async () => {
    for (const status of [204, 503, 403]) {
      await expect(probeSession({ fetch: answering(status) })).resolves.toBe('held');
    }
  });

  it('reads no answer as held, so the navigation goes ahead and the proxy decides', async () => {
    const failing = vi.fn(() => Promise.reject(new TypeError('network'))) as unknown as typeof fetch;
    await expect(probeSession({ fetch: failing })).resolves.toBe('held');
  });
});
