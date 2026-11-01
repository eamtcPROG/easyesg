import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isCrossSiteWrite } from './same-origin';

/**
 * OQ-33's proof on its own (task 92 moved it out of the pass-through, whose spec still drives it through
 * the handler). The cases are the ones a second reader could get wrong by copying: `same-site` refused,
 * the Origin fallback, and a request with neither header left alone.
 */
const request = (method: string, headers: Record<string, string> = {}) =>
  new NextRequest('http://web.test/auth/session/password', { method, headers });

describe('isCrossSiteWrite (OQ-33)', () => {
  it('never refuses a read, whatever it says about its origin', () => {
    expect(isCrossSiteWrite(request('GET', { 'sec-fetch-site': 'cross-site' }))).toBe(false);
  });

  it('passes a same-origin write and refuses a same-site one — a sibling subdomain is another zone', () => {
    expect(isCrossSiteWrite(request('POST', { 'sec-fetch-site': 'same-origin' }))).toBe(false);
    expect(isCrossSiteWrite(request('POST', { 'sec-fetch-site': 'same-site' }))).toBe(true);
    expect(isCrossSiteWrite(request('POST', { 'sec-fetch-site': 'cross-site' }))).toBe(true);
  });

  it('falls back to comparing Origin with the request’s own origin', () => {
    expect(isCrossSiteWrite(request('POST', { origin: 'http://web.test' }))).toBe(false);
    expect(isCrossSiteWrite(request('POST', { origin: 'http://admin.web.test' }))).toBe(true);
  });

  it('leaves a write carrying neither header alone — no browser, no ambient cookie', () => {
    expect(isCrossSiteWrite(request('POST'))).toBe(false);
  });
});
