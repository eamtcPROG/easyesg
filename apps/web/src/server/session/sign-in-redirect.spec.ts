import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Where a screen sends a reader whose session the api has ended (task 160): sign-in, keeping the address
 * the proxy stamped — or, for a screen whose address is itself a hand-off, the way on it was holding.
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

describe('redirectToSignIn (task 160)', () => {
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

  it('keeps the way on a hand-off screen was holding, rather than its own address', async () => {
    requestedPath.value = '/complete-account?return=%2Finvitation%2Ft';

    await redirectToSignIn({ returnTo: '/invitation/t' });

    expect(redirect).toHaveBeenCalledWith({
      href: `/sign-in?return=${encodeURIComponent('/invitation/t')}`,
      locale: 'en',
    });
  });

  it('keeps no way on when the hand-off screen held none', async () => {
    await redirectToSignIn({ returnTo: null });

    expect(redirect).toHaveBeenCalledWith({ href: '/sign-in', locale: 'en' });
  });
});
