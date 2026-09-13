import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsoleNav, type ConsoleNavItemState } from './console-nav';
import type { NavLinkComponent } from './nav-link';

/**
 * The console nav's own guarantees (task 67.1): the anatomy §11.5 names, the current-destination
 * semantics on the anchor, and the empty state the console lives in until its first screen ships.
 */
const SECTIONS = [
  {
    key: 'platform',
    heading: 'Platform',
    items: [
      { key: 'organizations', href: '/organizations', label: 'Organizations' },
      { key: 'accounts', href: '/accounts', label: 'Admin accounts' },
    ],
  },
  { key: 'billing', heading: 'Billing', items: [] },
];

const onHref = (href: string) => (item: { href: string }) => item.href === href;

describe('ConsoleNav (§11.5, task 67.1)', () => {
  it('names the region, names each list by its heading, and keeps the destinations in order', () => {
    render(<ConsoleNav label="Console sections" sections={SECTIONS} isActive={onHref('/organizations')} />);

    const nav = screen.getByRole('navigation', { name: 'Console sections' });
    const platform = screen.getByRole('list', { name: 'Platform' });
    expect(nav).toContainElement(platform);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Organizations',
      'Admin accounts',
    ]);
  });

  it('omits a section with no destinations', () => {
    render(<ConsoleNav label="Console sections" sections={SECTIONS} isActive={() => false} />);

    expect(screen.queryByRole('list', { name: 'Billing' })).toBeNull();
    expect(screen.queryByText('Billing')).toBeNull();
  });

  it('renders nothing at all when no section has a destination', () => {
    const { container } = render(
      <ConsoleNav
        label="Console sections"
        sections={[{ key: 'platform', heading: 'Platform', items: [] }]}
        isActive={() => false}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('puts aria-current on the anchor of the current destination, and nowhere else', () => {
    render(<ConsoleNav label="Console sections" sections={SECTIONS} isActive={onHref('/accounts')} />);

    const current = screen.getAllByRole('link', { current: 'page' });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Admin accounts');
    expect(current[0]).toHaveAttribute('href', '/accounts');
  });

  it('hands renderItem the item and its state, so a count beside the label keeps the semantics', () => {
    const seen: ConsoleNavItemState[] = [];
    render(
      <ConsoleNav
        label="Console sections"
        sections={SECTIONS}
        isActive={onHref('/organizations')}
        renderItem={(item, state) => {
          seen.push(state);
          return (
            <a href={item.href} {...state.linkProps}>
              {item.label} <span>14</span>
            </a>
          );
        }}
      />,
    );

    expect(seen.map((state) => state.isActive)).toEqual([true, false]);
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Organizations 14');
  });

  it('renders through an injected link component', () => {
    const Routed: NavLinkComponent = ({ href, children, ...rest }) => (
      <a href={`/console${href}`} data-routed="yes" {...rest}>
        {children}
      </a>
    );
    render(
      <ConsoleNav
        label="Console sections"
        sections={SECTIONS}
        isActive={onHref('/organizations')}
        linkComponent={Routed}
      />,
    );

    const current = screen.getByRole('link', { current: 'page' });
    expect(current).toHaveAttribute('href', '/console/organizations');
    expect(current).toHaveAttribute('data-routed', 'yes');
  });
});
