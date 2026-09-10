import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  issuesSession,
  requiresSession,
  SESSION_ENTRY_SEGMENTS,
  SESSION_ISSUING_SEGMENTS,
} from './route-access';

/**
 * The two gates, and the one place they are stated as rules rather than exercised as journeys.
 *
 * This module had no spec of its own until task 112, and its own docblocks say why that mattered:
 * `routeSegment`'s records a **security bug that shipped** — reading segment 1 as the locale was
 * correct under `localePrefix: 'always'` and made every authenticated Romanian route public the
 * day it became `'as-needed'`, invisibly, "because every test URL was prefixed". A browser suite
 * cannot cover that cheaply; a table of pathnames can.
 */

describe('requiresSession — the closed-by-default gate', () => {
  /** The regression `routeSegment`'s docblock names. Unprefixed is the source locale, not "no
   *  route": `/home` must be gated exactly as `/en/home` is. */
  it.each(['/home', '/en/home', '/ru/reports', '/reports', '/account/credentials'])(
    'gates %s',
    (pathname) => {
      expect(requiresSession(pathname)).toBe(true);
    },
  );

  it.each(['/', '/en', '/sign-in', '/en/sign-in', '/legal/terms', '/help', '/invitation/tok'])(
    'admits %s',
    (pathname) => {
      expect(requiresSession(pathname)).toBe(false);
    },
  );

  /** The default is closed, which is the direction that fails safe — an address nobody has named
   *  is authenticated rather than public. */
  it('gates an address the app does not know', () => {
    expect(requiresSession('/en/something-nobody-declared')).toBe(true);
  });
});

describe('issuesSession — the gate in the other direction (task 112)', () => {
  it.each(['/sign-in', '/en/sign-in', '/ru/register', '/register', '/sign-in/factor'])(
    'turns a signed-in reader away from %s',
    (pathname) => {
      expect(issuesSession(pathname)).toBe(true);
    },
  );

  /**
   * **`/reset` and `/set-password` are absent on purpose and must stay absent.**
   *
   * Both sit in `SESSION_ENTRY_SEGMENTS`, so a sweep that treated the two sets as one would add
   * them here and read as a tidy-up. It would break password recovery for every reader holding a
   * live session: a reset link arrives by email and is opened on whatever device is to hand.
   */
  it.each(['/reset', '/set-password', '/en/reset', '/verify', '/invitation/tok', '/home', '/'])(
    'leaves %s reachable',
    (pathname) => {
      expect(issuesSession(pathname)).toBe(false);
    },
  );

  /**
   * The relationship between the two sets, asserted rather than commented: a route that hands out a
   * session can never be somewhere a post-sign-in branch sends someone.
   *
   * **Stated as containment rather than through `isReturnableAfterSignIn`, because the predicate
   * form was green for the change it claimed to catch.** That predicate refuses a path for two
   * reasons — it needs a session, or it is a session-entry segment — so adding `magic-link` to
   * `SESSION_ISSUING_SEGMENTS` alone passed: the first clause answered, and the clause under test
   * was never reached. It only went red once the segment was *also* public, which is the finished
   * change rather than the intermediate state a gate exists to catch.
   */
  it('every session-issuing segment is also a session-entry segment', () => {
    expect([...SESSION_ISSUING_SEGMENTS].filter((s) => !SESSION_ENTRY_SEGMENTS.has(s))).toEqual([]);
  });
});

/**
 * **The vocabulary and the route group are two statements of one list, so they are compared.**
 *
 * Task 112's guard moved out of the two pages and into `(identity)/(session-issuing)/layout.tsx`,
 * which made *membership of that directory* the predicate a screen is guarded by — while
 * `issuesSession` stayed the predicate `proxy.ts` rotates on. `route-access.ts`'s own header says a
 * second list that drifted from the first was never an option, and this is that second list.
 *
 * Drift has a direction and it is the bad one: a screen added to the directory under a new first
 * segment is **guarded but not rotated**, so the branch it resolves during render is answered 401
 * and the reader lands on S-35 — *organization unavailable* — which is the exact failure this task
 * was written to prevent, arriving through the fix for it.
 *
 * Reading the filesystem in a unit spec is unusual here and is the point: nothing else can see this
 * relationship, because one side of it is a directory name.
 */
describe('the route group and the vocabulary are one list', () => {
  const GROUP = join(
    import.meta.dirname,
    '..',
    'app',
    '[locale]',
    '(identity)',
    '(session-issuing)',
  );

  it('names exactly the segments `issuesSession` answers true for', () => {
    const directories = readdirSync(GROUP, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      // A nested route group would add no URL segment, so it is not a segment to compare.
      .filter((name) => !name.startsWith('('));

    expect(directories.sort()).toEqual([...SESSION_ISSUING_SEGMENTS].sort());
  });
});
