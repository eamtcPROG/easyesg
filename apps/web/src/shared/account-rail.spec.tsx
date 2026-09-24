import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { AccountRail } from './account-rail';

/**
 * The account pages' rail — its two halves, their order, their names, and which destination is current.
 *
 * **Exact ordered lists, per half**, for `workspace-navigation.spec.tsx`'s reason: a per-item check passes when a
 * destination appears, swaps or crosses the rule, and each of those is a way this rail can go wrong. The halves are
 * read through their landmarks, so a destination drawn in the wrong half fails too.
 */
const nav = vi.hoisted(() => ({ pathname: '/account' }));

vi.mock('@/i18n/navigation', () => ({
  // Forwards the rest of its props — the real `Link` does, and `aria-current` is among them.
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

const linksIn = (landmark: string) =>
  within(screen.getByRole('navigation', { name: landmark }))
    .getAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')] as const);

const current = () => screen.queryAllByRole('link', { current: 'page' }).map((link) => link.textContent);

beforeEach(() => {
  nav.pathname = '/account';
});

describe('the account rail', () => {
  it('draws the workspace sections above the rule, under the band’s own name', () => {
    render(withIntl(<AccountRail />));

    // The band's set and order, and its accessible name — the rail is the workspace tier on these screens, and
    // `choose-organization.spec.ts` navigates by that name from S-28.
    expect(linksIn('Secțiunile organizației')).toEqual([
      ['Acasă', '/home'],
      ['Rapoarte', '/reports'],
      ['Entități', '/entities'],
      ['Organizația', '/organization'],
      ['Utilizatori și acces', '/organization/users'],
    ]);
  });

  it('draws Profile then Credentials below it, under the account menu’s name', () => {
    render(withIntl(<AccountRail />));

    expect(linksIn('Contul dumneavoastră')).toEqual([
      ['Profil', '/account'],
      ['Credențiale', '/account/credentials'],
    ]);
  });

  it('marks Profile on S-27, and only Profile', () => {
    render(withIntl(<AccountRail />));

    expect(current()).toEqual(['Profil']);
  });

  it('marks Credentials on S-28, and only Credentials', () => {
    nav.pathname = '/account/credentials';

    render(withIntl(<AccountRail />));

    // An exact match, so `/account` being a prefix of this address does not mark Profile as well.
    expect(current()).toEqual(['Credențiale']);
  });
});
