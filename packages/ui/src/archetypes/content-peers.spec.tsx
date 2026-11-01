import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { NavLinkComponent } from '../navigation/nav-link';
import { ContentPeers } from './content-peers';

/**
 * The peer strip of a Content page that is one of a set (§4.6; S-30's tabs): one row at every width, the current page
 * marked, and scrolled to it where the row is wider than its room (`design_spec.md` §4.6, resolved 9 Oct 2026).
 */
describe('ContentPeers', () => {
  const PEERS = [
    { key: 'terms', href: '/legal/terms', label: 'Terms of service' },
    { key: 'privacy', href: '/legal/privacy', label: 'Privacy notice' },
    { key: 'cookies', href: '/legal/cookies', label: 'Cookies' },
  ];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names the set and links each of its pages', () => {
    render(<ContentPeers label="Legal documents" peers={PEERS} currentKey="privacy" />);
    const nav = screen.getByRole('navigation', { name: 'Legal documents' });
    expect(within(nav).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Terms of service', '/legal/terms'],
      ['Privacy notice', '/legal/privacy'],
      ['Cookies', '/legal/cookies'],
    ]);
  });

  it('marks the page being read as the current one, and only it', () => {
    render(<ContentPeers label="Legal documents" peers={PEERS} currentKey="privacy" />);
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('aria-current'))).toEqual([null, 'page', null]);
  });

  it('builds its links with the app’s own link when one is injected', () => {
    const AppLink: NavLinkComponent = ({ href, children, ...rest }) => (
      <a href={`/en${href}`} data-app-link="" {...rest}>
        {children}
      </a>
    );
    render(<ContentPeers label="Legal documents" peers={PEERS} currentKey="terms" linkComponent={AppLink} />);
    const links = screen.getAllByRole('link');
    expect(links.every((link) => link.hasAttribute('data-app-link'))).toBe(true);
    expect(links[0]).toHaveAttribute('href', '/en/legal/terms');
    expect(links[0]).toHaveAttribute('aria-current', 'page');
  });

  /** jsdom lays nothing out, so the geometry is stated: a 200px strip, the current peer 100px wide at 300px in. */
  it('scrolls the row so the current page is in view, centred where it can be', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('aria-current') === 'page' ? 300 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
    const scrolled = vi.spyOn(HTMLElement.prototype, 'scrollLeft', 'set');

    render(<ContentPeers label="Legal documents" peers={PEERS} currentKey="cookies" />);

    expect(scrolled).toHaveBeenCalledWith(250);
  });
});
