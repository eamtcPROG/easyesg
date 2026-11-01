import { initialiseCatalogue, translate } from '@api/app/messages/catalogue';
import { LOCALES } from '@easyesg/i18n';
import { INVITATION_STANDING_KEYS } from '../errors/invitation.errors';
import { INVITATION_STATUS } from '../models/invitation.model';
import { invitation } from '../testing/invitation-store.fake';
import {
  INVITATION_STANDING,
  UNACCEPTABLE_STANDINGS,
  invitationStanding,
} from './invitation-standing';

/** The verdict S-03 renders and acceptance refuses from — one function, two readers (task 26.2). */
describe('invitationStanding (UC-15, FR-11)', () => {
  const NOW = new Date('2026-08-25T09:00:00Z');
  const LATER = new Date('2026-09-25T09:00:00Z');
  /** Explicit rather than the fake's default, which predates NOW — see `live` below. */
  const live = (over: Partial<Parameters<typeof invitation>[0]> = {}) =>
    invitation({ id: 'a', expiresAt: new Date('2026-09-01T00:00:00Z'), ...over });

  it('is acceptable while pending and inside its window', () => {
    expect(invitationStanding(live(), NOW)).toBe(INVITATION_STANDING.ACCEPTABLE);
  });

  it('is unknown when the token names no row', () => {
    expect(invitationStanding(null, NOW)).toBe(INVITATION_STANDING.UNKNOWN);
  });

  it('is expired once the window has passed', () => {
    expect(invitationStanding(live(), LATER)).toBe(INVITATION_STANDING.EXPIRED);
  });

  it.each([
    [INVITATION_STATUS.ACCEPTED, INVITATION_STANDING.CONSUMED],
    [INVITATION_STATUS.REVOKED, INVITATION_STANDING.REVOKED],
  ])('reads %s as %s', (status, expected) => {
    expect(invitationStanding(live({ status }), NOW)).toBe(expected);
  });

  /**
   * Status before the clock, asserted as the rule rather than as a coincidence of ordering: a
   * revoked invitation that has also lapsed is REVOKED, because that is what happened to it.
   * Reporting expiry would send the invitee to ask for a resend of something withdrawn on purpose.
   */
  it.each([INVITATION_STATUS.ACCEPTED, INVITATION_STATUS.REVOKED])(
    'keeps reporting %s after the window passes',
    (status) => {
      expect(invitationStanding(live({ status }), LATER)).not.toBe(INVITATION_STANDING.EXPIRED);
    },
  );

  it('excludes only acceptable from the refusable set', () => {
    expect(UNACCEPTABLE_STANDINGS).toHaveLength(Object.values(INVITATION_STANDING).length - 1);
    expect(UNACCEPTABLE_STANDINGS).not.toContain(INVITATION_STANDING.ACCEPTABLE);
  });
});

/**
 * The catalogue check the derived key list exists for.
 *
 * The key is built by interpolation at the throw site, so a standing added later would compile,
 * ship, and render a problem document with **no `detail` at all** — `ProblemDetailsFilter` omits a
 * member whose key is missing rather than falling back to the slug, which is right for the reader
 * and silent for everyone else. This is what turns that silence into a failing test, in all three
 * locales, because a Russian-speaking invitee reading a blank refusal is the case that would never
 * be noticed otherwise.
 */
describe('every refusal has wording, in every locale (NFR-79)', () => {
  // The catalogue is loaded by the entrypoints, not by jest — `use-intl` is ESM and the bridge is a
  // dynamic import (OQ-48), which is why the `test` script sets `--experimental-vm-modules`. A spec
  // reading a message has to await it, or `translate` correctly answers `undefined` for everything
  // and this suite would pass by asserting nothing.
  beforeAll(async () => {
    await initialiseCatalogue();
  });

  it.each(LOCALES)('%s', (locale) => {
    for (const key of INVITATION_STANDING_KEYS) {
      const message = translate(locale, key);
      expect(message).toBeDefined();
      expect((message ?? '').length).toBeGreaterThan(0);
    }
  });
});
