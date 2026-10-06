import { describe, expect, it } from 'vitest';
import {
  CREDENTIALS_ARRIVAL,
  credentialsArrivalHref,
  readCredentialsArrival,
  readCredentialsOnward,
} from './credentials-arrival';

describe('S-28 arrival (task 190)', () => {
  it('reads the one word S-01 sends after a recovery sign-in', () => {
    expect(readCredentialsArrival('recovered')).toBe(CREDENTIALS_ARRIVAL.RECOVERED);
  });

  it('builds the address the section reads back, word for word, with the destination carried', () => {
    const href = credentialsArrivalHref({ arrival: CREDENTIALS_ARRIVAL.RECOVERED, onward: '/invitation/abc?x=1' });
    expect(href).toBe('/account/credentials?notice=recovered&return=%2Finvitation%2Fabc%3Fx%3D1');
    const query = new URL(href, 'https://x.test').searchParams;
    expect(readCredentialsArrival(query.get('notice') ?? undefined)).toBe(CREDENTIALS_ARRIVAL.RECOVERED);
    expect(readCredentialsOnward(query.get('return') ?? undefined)).toEqual({ href: '/invitation/abc?x=1', locale: undefined });
  });

  it('carries a destination only when it is a same-app path, keeping its locale', () => {
    expect(readCredentialsOnward('/en/home')).toEqual({ href: '/home', locale: 'en' });
    for (const hostile of ['https://evil.test/', '//evil.test', '/\\evil.test', 'home', undefined, ['/a', '/b']]) {
      expect(readCredentialsOnward(hostile)).toBeNull();
    }
  });

  it('announces nothing for an absent, unknown or repeated parameter', () => {
    expect(readCredentialsArrival(undefined)).toBeNull();
    expect(readCredentialsArrival('9')).toBeNull();
    expect(readCredentialsArrival(['recovered', 'recovered'])).toBeNull();
  });
});
