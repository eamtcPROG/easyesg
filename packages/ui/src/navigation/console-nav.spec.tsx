import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { ConsoleNav } from './console-nav';
import type { ConsoleNavItemState } from './console-nav-types';
import type { NavLinkComponent } from './nav-link';

/**
 * The console nav's own guarantees (task 67.1): the anatomy §11.5 names, the current-destination
 * semantics on the anchor, and the empty state the console lives in until its first screen ships.
 */
/** A stand-in glyph that passes on what it is given, as Lucide's do. */
const Glyph = (props: { readonly className?: string; readonly 'aria-hidden'?: boolean }) => <svg data-glyph="" {...props} />;

const SECTIONS = [
  {
    key: 'platform',
    heading: 'Platform',
    items: [
      { key: 'organizations', href: '/organizations', label: 'Organizations', icon: Glyph },
      { key: 'accounts', href: '/accounts', label: 'Admin accounts', icon: Glyph },
    ],
  },
  { key: 'billing', heading: 'Billing', items: [] },
];

const onHref = (href: string) => (item: { href: string }) => item.href === href;

type SidebarProps = ComponentProps<typeof ConsoleNav>;

/** The sidebar at `wide`, expanded, with its control's words — what every case below needs and few vary. */
const ConsoleSidebar = (props: Partial<SidebarProps> & Pick<SidebarProps, 'sections' | 'isActive'>) => (
  <ConsoleNav
    label="Console sections"
    collapsed={false}
    onCollapsedChange={() => undefined}
    collapseLabel="Collapse the menu"
    expandLabel="Expand the menu"
    {...props}
  />
);

/** A frame below `wide`: jsdom has no `matchMedia`, which the sidebar reads as `wide`. */
const belowWide = () =>
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ConsoleNav (§11.5, task 67.1)', () => {
  it('names the region, names each list by its heading, and keeps the destinations in order', () => {
    render(<ConsoleSidebar sections={SECTIONS} isActive={onHref('/organizations')} />);

    const nav = screen.getByRole('navigation', { name: 'Console sections' });
    const platform = screen.getByRole('list', { name: 'Platform' });
    expect(nav).toContainElement(platform);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Organizations',
      'Admin accounts',
    ]);
  });

  it('omits a section with no destinations', () => {
    render(<ConsoleSidebar sections={SECTIONS} isActive={() => false} />);

    expect(screen.queryByRole('list', { name: 'Billing' })).toBeNull();
    expect(screen.queryByText('Billing')).toBeNull();
  });

  it('renders nothing at all when no section has a destination', () => {
    const { container } = render(
      <ConsoleSidebar sections={[{ key: 'platform', heading: 'Platform', items: [] }]} isActive={() => false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('puts aria-current on the anchor of the current destination, and nowhere else', () => {
    render(<ConsoleSidebar sections={SECTIONS} isActive={onHref('/accounts')} />);

    const current = screen.getAllByRole('link', { current: 'page' });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Admin accounts');
    expect(current[0]).toHaveAttribute('href', '/accounts');
  });

  it('hands renderItem the item and its state, so a count beside the label keeps the semantics', () => {
    const seen: ConsoleNavItemState[] = [];
    render(
      <ConsoleSidebar
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
      <ConsoleSidebar sections={SECTIONS} isActive={onHref('/organizations')} linkComponent={Routed} />,
    );

    const current = screen.getByRole('link', { current: 'page' });
    expect(current).toHaveAttribute('href', '/console/organizations');
    expect(current).toHaveAttribute('data-routed', 'yes');
  });

  it('draws each destination with its icon before its label', () => {
    render(<ConsoleSidebar sections={SECTIONS} isActive={onHref('/organizations')} />);

    const link = screen.getByRole('link', { name: 'Organizations' });
    expect(link.firstElementChild).toHaveAttribute('data-glyph');
    expect(link.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  /**
   * The sidebar folds at `wide` (25 Oct 2026), and the choice is the consumer's to keep: the control reports it and the
   * strip is drawn from the prop, so an operator's choice can outlive the page.
   */
  it('folds to the icon strip at wide, and reports the choice rather than keeping it', async () => {
    const onCollapsedChange = vi.fn();
    const { rerender } = render(
      <ConsoleSidebar sections={SECTIONS} isActive={onHref('/organizations')} onCollapsedChange={onCollapsedChange} />,
    );

    const fold = screen.getByRole('button', { name: 'Collapse the menu' });
    expect(fold).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Console sections' })).toHaveAttribute('data-strip', 'false');
    await userEvent.click(fold);
    expect(onCollapsedChange).toHaveBeenCalledWith(true);

    rerender(<ConsoleSidebar sections={SECTIONS} isActive={onHref('/organizations')} collapsed />);
    expect(screen.getByRole('navigation', { name: 'Console sections' })).toHaveAttribute('data-strip', 'true');
    expect(screen.getByRole('button', { name: 'Expand the menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  /** In the strip each icon is still named by its destination — the label is in the link, drawn as a note beside it. */
  it('keeps every destination named in the strip', () => {
    render(<ConsoleSidebar sections={SECTIONS} isActive={onHref('/organizations')} collapsed />);

    expect(screen.getByRole('link', { name: 'Organizations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Admin accounts' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Platform' })).toBeInTheDocument();
  });

  /**
   * Below `wide` the strip is the resting state whatever the operator chose at `wide`, and its control lays the full
   * sidebar over the page; choosing a destination folds it back, since a client-side navigation unmounts nothing.
   */
  it('below wide, lays the full sidebar over the page from the strip and folds it back on a choice', async () => {
    belowWide();
    const onCollapsedChange = vi.fn();
    render(
      <ConsoleSidebar sections={SECTIONS} isActive={onHref('/organizations')} onCollapsedChange={onCollapsedChange} />,
    );

    expect(screen.getByRole('navigation', { name: 'Console sections' })).toHaveAttribute('data-strip', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Expand the menu' }));
    const over = screen.getByRole('dialog', { name: 'Console sections' });
    const link = within(over).getByRole('link', { name: 'Admin accounts' });
    link.addEventListener('click', (event) => event.preventDefault());
    await userEvent.click(link);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onCollapsedChange).not.toHaveBeenCalled();
  });
});
