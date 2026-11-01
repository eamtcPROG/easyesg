import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsoleDrawer } from './console-drawer';

/**
 * The console navigation below `wide` (task 170): the same headed sections the column draws, the
 * current destination marked, and a chosen destination closing the panel.
 */
const Glyph = () => <svg />;

const SECTIONS = [
  {
    key: 'platform',
    heading: 'Platform',
    items: [
      { key: '/organizations', href: '/organizations', label: 'Organizations', icon: Glyph },
      { key: '/accounts', href: '/accounts', label: 'Accounts', icon: Glyph },
    ],
  },
];

const drawer = (sections = SECTIONS) => (
  <ConsoleDrawer
    label="Console sections"
    openLabel="Open the console menu"
    closeLabel="Close the console menu"
    brand={<span>easyESG</span>}
    realm={<span>Platform administrator</span>}
    sections={sections}
    isActive={(item) => item.href === '/accounts'}
  />
);

describe('ConsoleDrawer', () => {
  it('opens the headed sections with the current destination marked', async () => {
    render(drawer());

    await userEvent.click(screen.getByRole('button', { name: 'Open the console menu' }));
    const nav = screen.getByRole('navigation', { name: 'Console sections' });
    const list = within(nav).getByRole('list', { name: 'Platform' });
    expect(within(list).getByRole('link', { name: 'Accounts' })).toHaveAttribute('aria-current', 'page');
    expect(within(list).getByRole('link', { name: 'Organizations' })).not.toHaveAttribute('aria-current');
  });

  /** A client-side navigation unmounts nothing, so the panel has to close itself. */
  it('closes when a destination is chosen', async () => {
    render(drawer());

    await userEvent.click(screen.getByRole('button', { name: 'Open the console menu' }));
    const link = screen.getByRole('link', { name: 'Organizations' });
    link.addEventListener('click', (event) => event.preventDefault());
    await userEvent.click(link);
    expect(screen.queryByRole('navigation', { name: 'Console sections' })).not.toBeInTheDocument();
  });

  /**
   * The head is the brand, then the close control at its far end — the owner's call on the sidebar's mock-up
   * (25 Oct 2026), where the drawer is a phone's alone.
   */
  it('heads the panel with the brand, the close control after it', async () => {
    render(drawer());

    await userEvent.click(screen.getByRole('button', { name: 'Open the console menu' }));
    const close = screen.getByRole('button', { name: 'Close the console menu' });
    const brand = screen.getByText('easyESG');
    expect(brand.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(close.parentElement).toBe(brand.parentElement);
  });

  /** The realm has a line of its own under the head, rather than a second line beside the close control. */
  it('names the realm under the head, before the sections', async () => {
    render(drawer());

    await userEvent.click(screen.getByRole('button', { name: 'Open the console menu' }));
    const realm = screen.getByText('Platform administrator');
    const brand = screen.getByText('easyESG');
    const nav = screen.getByRole('navigation', { name: 'Console sections' });
    expect(realm.parentElement).not.toBe(brand.parentElement);
    expect(realm.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws no control when there is nowhere to go', () => {
    const { container } = render(drawer([{ key: 'billing', heading: 'Billing', items: [] }]));
    expect(container).toBeEmptyDOMElement();
  });
});
