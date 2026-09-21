import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Where the api client sends a caller whose session the api has ended (tasks 160, 161): sign-in, keeping
 * the address the proxy stamped.
 */
vi.mock('server-only', () => ({}));

const requestedPath = vi.hoisted(() => ({ value: null as string | null }));
const redirect = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: () => requestedPath.value }),
}));
vi.mock('next-intl/server', () => ({ getLocale: () => Promise.resolve('en') }));
vi.mock('@/i18n/navigation', () => ({ redirect }));

import { redirectToSignIn } from './sign-in-redirect';

beforeEach(() => {
  vi.clearAllMocks();
  requestedPath.value = '/en/reports?page=2';
});

describe('redirectToSignIn (tasks 160, 161)', () => {
  it('keeps the address asked for, in the reader’s language', async () => {
    await redirectToSignIn();

    expect(redirect).toHaveBeenCalledWith({
      href: `/sign-in?return=${encodeURIComponent('/en/reports?page=2')}`,
      locale: 'en',
    });
  });

  it('sends a reader to plain sign-in when the proxy stamped no address', async () => {
    requestedPath.value = null;

    await redirectToSignIn();

    expect(redirect).toHaveBeenCalledWith({ href: '/sign-in', locale: 'en' });
  });
});
