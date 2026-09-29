import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Breadcrumb } from './breadcrumb';
import type { NavLinkComponent } from './nav-link';

/**
 * The trail's own guarantees (28 Sep 2026): the steps back are links in order, the current page is marked and is not
 * one, and the slashes reach nobody who cannot see them.
 */
const TRAIL = [
  { href: '/entities', label: 'Entities' },
  { href: '/entities/e1', label: 'Brutăria Lina SRL' },
];

describe('Breadcrumb', () => {
  it('names itself as a navigation, and links each step back in order', () => {
    render(<Breadcrumb label="Breadcrumb" trail={TRAIL} current="Periods" />);

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Entities', '/entities'],
      ['Brutăria Lina SRL', '/entities/e1'],
    ]);
  });

  it('marks the current page, and never as a link', () => {
    render(<Breadcrumb label="Breadcrumb" trail={TRAIL} current="Periods" />);

    const current = screen.getByText('Periods');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.closest('a')).toBeNull();
    expect(screen.queryAllByRole('link', { current: 'page' })).toHaveLength(0);
  });

  it('draws a separator between steps and hides every one from assistive technology', () => {
    const { container } = render(<Breadcrumb label="Breadcrumb" trail={TRAIL} current="Periods" />);

    // Three items, two gaps — and the items' text is the three names alone.
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Entities',
      'Brutăria Lina SRL',
      'Periods',
    ]);
    const separators = container.querySelectorAll('svg');
    expect(separators).toHaveLength(2);
    for (const separator of separators) {
      expect(separator).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('draws no leading separator for a trail of none', () => {
    const { container } = render(<Breadcrumb label="Breadcrumb" trail={[]} current="Entities" />);

    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });

  it('builds each step with the injected link, so the app’s router carries it', () => {
    const Routed: NavLinkComponent = ({ href, children, ...rest }) => (
      <a href={`/ro${href}`} data-routed="" {...rest}>
        {children}
      </a>
    );

    render(<Breadcrumb label="Breadcrumb" trail={TRAIL} current="Periods" linkComponent={Routed} />);

    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/ro/entities',
      '/ro/entities/e1',
    ]);
  });
});
