import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsoleDrawer } from './console-drawer';

/**
 * The console navigation below `wide` (task 170): the same headed sections the column draws, the
 * current destination marked, and a chosen destination closing the panel.
 */
const SECTIONS = [
  {
    key: 'platform',
    heading: 'Platform',
    items: [
      { key: '/organizations', href: '/organizations', label: 'Organizations' },
      { key: '/accounts', href: '/accounts', label: 'Accounts' },
    ],
  },
];

const drawer = (sections = SECTIONS) => (
  <ConsoleDrawer
    label="Console sections"
    openLabel="Open the console menu"
    closeLabel="Close the console menu"
    brand={<span>easyESG</span>}
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

  it('draws no control when there is nowhere to go', () => {
    const { container } = render(drawer([{ key: 'billing', heading: 'Billing', items: [] }]));
    expect(container).toBeEmptyDOMElement();
  });
});
