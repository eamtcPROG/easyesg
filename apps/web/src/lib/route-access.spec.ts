import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  completesAccountSetup,
  issuesSession,
  requiresSession,
  SESSION_ENTRY_SEGMENTS,
  SESSION_ISSUING_SEGMENTS,
  UNAUTHENTICATED_SEGMENTS,
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

  /**
   * **It recurses through nested route groups, and the first draft did not** — which made it inert
   * for the one shape it exists to catch (task 112's second gate review, proved). That draft
   * dropped every `(`-prefixed entry, on the true observation that a route group adds no URL
   * segment of its own. Its children do, and the guarding layout is still their ancestor: a
   * `(session-issuing)/(passwordless)/magic-link/` route was **guarded by the layout and not
   * rotated by the proxy** with all 27 cases green — the 401 → S-35 failure named three paragraphs
   * up, arriving through the check written to prevent it.
   *
   * The realistic path there is not exotic. Anyone adding a passwordless or SSO sign-in screen
   * would group it, and would certainly add it to `UNAUTHENTICATED_SEGMENTS`, because forgetting
   * *that* is loud.
   */
  const segmentsUnder = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) =>
        entry.name.startsWith('(') ? segmentsUnder(join(directory, entry.name)) : [entry.name],
      );

  it('names exactly the segments `issuesSession` answers true for', () => {
    expect(segmentsUnder(GROUP).sort()).toEqual([...SESSION_ISSUING_SEGMENTS].sort());
  });

  /**
   * S-36's password step on S-02's path issues a session, so it must sit under this group's layout —
   * UX-136's gate — and not merely under a segment the proxy rotates on. Task 155's second review found
   * it at `/verify/password`, outside, where a signed-in reader could replace their session. The segment
   * comparison above cannot see a page moved back out, since `verify` is in neither list, so the file is
   * looked for where it must be.
   */
  it('holds S-36’s link-path password step, which issues a session', () => {
    expect(existsSync(join(GROUP, 'register', 'password', 'page.tsx'))).toBe(true);
  });
});

/**
 * The third link of the chain, which nothing held (task 112's second gate review).
 *
 * Two containments make the three sets coherent, and only one was asserted. A session-issuing
 * segment left out of `UNAUTHENTICATED_SEGMENTS` is **gated** — so an anonymous visitor is bounced
 * to `/sign-in?return=/…` from the very screen meant to hand them a session, and on `/sign-in`
 * itself that is a redirect to itself. It fails closed and it fails loudly, which is why it went
 * unnoticed rather than unpunished; it is still one `.filter(…).toEqual([])` beside the other.
 */
describe('a screen that issues a session must be reachable without one', () => {
  it('every session-issuing segment is unauthenticated', () => {
    expect(
      [...SESSION_ISSUING_SEGMENTS].filter((segment) => !UNAUTHENTICATED_SEGMENTS.has(segment)),
    ).toEqual([]);
  });
});

/**
 * S-36 and the redirect that sends an account in setup to it (task 155). Two properties, and each is
 * the other's failure: S-36 must be the exception, or the proxy redirects it to itself; and it must
 * still need a session, or neither the gate nor the page-load rotation reaches the read it makes.
 */
describe('completesAccountSetup — S-36, the exception to the setup redirect (task 155)', () => {
  it.each(['/complete-account', '/en/complete-account', '/ru/complete-account'])(
    'recognises %s in every locale form',
    (pathname) => {
      expect(completesAccountSetup(pathname)).toBe(true);
    },
  );

  it.each(['/home', '/reports/42', '/register/password', '/sign-in', '/'])(
    'is no exception for %s',
    (pathname) => {
      expect(completesAccountSetup(pathname)).toBe(false);
    },
  );

  it('needs a session, so the gate and the rotation both reach it', () => {
    expect(requiresSession('/complete-account')).toBe(true);
    expect(requiresSession('/en/complete-account')).toBe(true);
  });

  /** The link path's password step is served where no session is needed — the account has none yet. */
  it('keeps the link path’s password step reachable without one', () => {
    expect(requiresSession('/register/password')).toBe(false);
  });
});
