import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/lib/routes';
import { choiceExit } from './choice-exit';

/**
 * S-37's exit, arm by arm (task 83.3). The return path is the reader's to edit, so every refusal here is a
 * way a crafted or stale `?return=` would otherwise send someone who has just chosen somewhere wrong.
 */
describe('choiceExit (S-37)', () => {
  it('goes on to the screen that sent the reader here', () => {
    expect(choiceExit('/reports')).toEqual({ href: '/reports' });
    expect(choiceExit('/entities/42/periods/7')).toEqual({ href: '/entities/42/periods/7' });
  });

  it('keeps the query, which is the screen’s state (UX-4)', () => {
    expect(choiceExit('/reports?filters=state,draft')).toEqual({ href: '/reports?filters=state,draft' });
  });

  it('keeps the address’s own locale (OQ-32)', () => {
    expect(choiceExit('/en/reports')).toEqual({ href: '/reports', locale: 'en' });
  });

  it('goes home with nothing to go on to', () => {
    expect(choiceExit(undefined)).toEqual({ href: ROUTES.HOME });
    expect(choiceExit('')).toEqual({ href: ROUTES.HOME });
  });

  /** Each would turn the reader round: back to choose again, or into a setup already done. */
  it.each(['/choose-organization', '/en/choose-organization?return=%2Freports', '/complete-account'])(
    'refuses %s',
    (returnTo) => {
      expect(choiceExit(returnTo)).toEqual({ href: ROUTES.HOME });
    },
  );

  it.each(['//elsewhere.example/reports', 'https://elsewhere.example/reports', 'reports'])(
    'refuses %s, which is not an address in this app',
    (returnTo) => {
      expect(choiceExit(returnTo)).toEqual({ href: ROUTES.HOME });
    },
  );

  /** A credential entry point renders without an organization, and is no place for a reader just signed in. */
  it.each(['/sign-in', '/register', '/'])('refuses %s, which needs no session', (returnTo) => {
    expect(choiceExit(returnTo)).toEqual({ href: ROUTES.HOME });
  });
});
