import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  WorkspaceNav,
  type NavLinkComponent,
  type WorkspaceNavItemState,
} from './workspace-nav';

/**
 * The component's own guarantees (task 105) — and this file could not exist before it.
 *
 * Under the previous API the caller passed a **rendered anchor**, so the anchor was opaque here:
 * the component could assert nothing about the interactive element, and the only test of the
 * current-section semantics lived in `apps/web`, against one caller. A second consumer inherited
 * no guard at all, which is what made the old design shared rather than reusable.
 *
 * Now the component builds the anchor, so the accessibility claim in its docblock is a claim this
 * file can hold it to.
 */
const SECTIONS = [
  { key: 'home', href: '/home', label: 'Home' },
  { key: 'reports', href: '/reports', label: 'Reports' },
  { key: 'entities', href: '/entities', label: 'Entities' },
] as const;

const onHref = (href: string) => (item: { href: string }) => item.href === href;

describe('WorkspaceNav', () => {
  it('renders every item as a link, in order', () => {
    render(<WorkspaceNav label="Sections" items={SECTIONS} isActive={onHref('/home')} />);

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Home',
      'Reports',
      'Entities',
    ]);
  });

  it('puts aria-current on the anchor, not on a wrapper', () => {
    render(<WorkspaceNav label="Sections" items={SECTIONS} isActive={onHref('/entities')} />);

    // **The whole point of the task-105 API change.** On a wrapping `<span>` — `role="generic"` —
    // this attribute is not announced when a screen reader moves link-to-link, so the current
    // section reached sighted readers through the underline and reached nobody else. Asserting the
    // ROLE and the attribute together is what fails if it drifts back onto an ancestor: a query
    // for `{ current: 'page' }` on role `link` matches only the anchor.
    const current = screen.getAllByRole('link', { current: 'page' });

    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Entities');
    expect(current[0]).toHaveAttribute('href', '/entities');
  });

  it('marks nothing when the predicate matches no item', () => {
    render(<WorkspaceNav label="Sections" items={SECTIONS} isActive={onHref('/elsewhere')} />);

    expect(screen.queryAllByRole('link', { current: 'page' })).toHaveLength(0);
  });

  it('names the region for assistive technology', () => {
    render(<WorkspaceNav label="Organisation sections" items={SECTIONS} isActive={() => false} />);

    expect(screen.getByRole('navigation', { name: 'Organisation sections' })).toBeInTheDocument();
  });

  it('renders through an injected link component', () => {
    // Stands in for `apps/web`'s locale-aware `Link`: the package holds no router, so the only way
    // it can be wrong is by not passing what it promised — `href` and the ARIA bag.
    const Localized: NavLinkComponent = ({ href, children, ...rest }) => (
      <a href={`/en${href}`} {...rest}>
        {children}
      </a>
    );

    render(
      <WorkspaceNav
        label="Sections"
        items={SECTIONS}
        isActive={onHref('/reports')}
        linkComponent={Localized}
      />,
    );

    const current = screen.getByRole('link', { current: 'page' });
    expect(current).toHaveAttribute('href', '/en/reports');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en/home');
  });

  it('carries extra item fields through to renderItem, still typed', () => {
    const items = [
      { key: 'reports', href: '/reports', label: 'Reports', count: 3 },
      { key: 'entities', href: '/entities', label: 'Entities', count: 0 },
    ] as const;
    const renderItem = vi.fn((item: (typeof items)[number], state: WorkspaceNavItemState) => (
      <a href={item.href} {...state.linkProps}>
        {item.label} ({item.count})
      </a>
    ));

    render(
      <WorkspaceNav label="Sections" items={items} isActive={onHref('/reports')} renderItem={renderItem} />,
    );

    // The generic is the half that removes remapping: a consumer's own richer objects arrive
    // intact rather than being flattened into `{ key, link, current }` first.
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Reports (3)');
    expect(renderItem).toHaveBeenCalledTimes(2);
    expect(renderItem.mock.calls[1]?.[1]).toEqual({ isActive: false, linkProps: {} });
  });
});
