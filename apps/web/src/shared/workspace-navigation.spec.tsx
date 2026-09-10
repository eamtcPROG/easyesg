import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { WorkspaceNavigation } from './workspace-navigation';

/**
 * §4.2's workspace tier — its item set, its order, and which item is current (task 104).
 *
 * **It exists because nothing asserted any of the three, and two of them were wrong.** The tier
 * shipped without *Home* and with *Organization* ahead of *Entities* from task 30.3 to task 104,
 * against a §4.2 table and a set of artboards that both say otherwise. Four tasks touched this
 * file in between. `e2e/web/reports.spec.ts` reaches into the nav to click *Rapoarte*, which
 * passes whatever else is in the band and in whatever order — so the one test that used the tier
 * could not fail on its contents.
 *
 * **The assertion is an exact ordered list, not a set of `toBeVisible` calls.** A per-item check
 * passes when a sixth item appears, when two swap, and when *Plan & billing* arrives before its
 * screens do — the three ways this has actually gone wrong or could. `toEqual` on the full array
 * is what makes each of those a failure.
 */
const nav = vi.hoisted(() => ({ pathname: '/home' }));

vi.mock('@/i18n/navigation', () => ({
  // **It must forward the rest of its props**, which the first version of this double did not —
  // it destructured `href` and `children` only, so it silently swallowed the `aria-current` the
  // component passes and failed two tests that were right. The real `Link` forwards anchor props;
  // a double that models behaviour has to model that too, or it tests itself.
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => nav.pathname,
}));

const withIntl = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="ro" messages={{ chrome: ro.chrome }}>
    {node}
  </NextIntlClientProvider>
);

/** The tier's rendered order, read off the DOM rather than off `SECTIONS`. */
const renderedTier = () =>
  screen
    .getAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')] as const);

/** The section carrying `aria-current="page"`, which task 105 moved onto the anchor itself. */
const currentSections = () =>
  // `queryAllByRole`, not `getAllByRole`: the empty answer is a case this suite asserts, and the
  // `get*` family throws rather than returning it.
  screen.queryAllByRole('link', { current: 'page' }).map((link) => link.textContent);

beforeEach(() => {
  nav.pathname = '/home';
});

describe('the workspace tier', () => {
  it('opens with Home and orders entities before the organization', () => {
    render(withIntl(<WorkspaceNavigation />));

    // §4.2, as amended 10 Sep 2026, and `EasyESG Workspace.dc.html` at every width. *Plan &
    // billing* is the sixth entry and is deliberately absent — its screens are Phase 7's, and this
    // tier's own rule is that the set holds the sections that render.
    expect(renderedTier()).toEqual([
      ['Acasă', '/home'],
      ['Rapoarte', '/reports'],
      ['Entități', '/entities'],
      ['Organizația', '/organization'],
      ['Utilizatori și acces', '/organization/users'],
    ]);
  });

  it('names itself as the organization sections', () => {
    render(withIntl(<WorkspaceNavigation />));

    // The accessible name `reports.spec.ts` and `accessibility.spec.ts` both locate the band by.
    expect(screen.getByRole('navigation', { name: 'Secțiunile organizației' })).toBeInTheDocument();
  });

  it('marks the section the reader is on, and only that one', () => {
    nav.pathname = '/entities';

    render(withIntl(<WorkspaceNavigation />));

    // A role-based query, which only became possible in task 105: `WorkspaceNav` now builds the
    // anchor and puts `aria-current` on it, where a screen reader moving link-to-link reads it.
    // `packages/ui`'s own spec holds the component to that; this asserts the tier resolves the
    // right section as active.
    expect(currentSections()).toEqual(['Entități']);
  });

  it('marks nothing when the reader is on a screen outside the tier', () => {
    nav.pathname = '/account/credentials';

    render(withIntl(<WorkspaceNavigation />));

    // S-28 lives under the account corner, not this tier (task 30.1) — so no section is current.
    expect(currentSections()).toEqual([]);
  });
});
