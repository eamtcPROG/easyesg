import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWITCHER_TONE } from './language-switcher-vocabulary';
import { OrganizationSwitcher, type OrganizationSwitcherProps } from './organization-switcher';

/**
 * The switcher's contract (task 83.2) — each property here renders plausibly when broken: a current
 * organization marked only by weight, a choice of the current one that sends a pointless write, a row
 * that still accepts a second choice while the first is on its way.
 */
const ORGANIZATIONS = [
  { key: 'org-a', name: 'Brutăria Lina SRL', detail: 'Organization administrator' },
  { key: 'org-b', name: 'Grupul Lina', detail: 'Editor' },
] as const;

const switcher = (props: Partial<OrganizationSwitcherProps> = {}) => {
  const onChoose = vi.fn();
  render(
    <OrganizationSwitcher
      label="Active organization"
      organizations={ORGANIZATIONS}
      currentKey="org-a"
      onChoose={onChoose}
      closingItem={<a href="/create-organization">Create another organization</a>}
      {...props}
    />,
  );
  return { onChoose };
};

const open = () => userEvent.click(screen.getByRole('button', { name: /Active organization/ }));

describe('OrganizationSwitcher', () => {
  it('names the active organization on its trigger, and says what the control is', () => {
    switcher();

    const trigger = screen.getByRole('button', { name: 'Active organization: Brutăria Lina SRL' });
    expect(trigger).toHaveTextContent('Brutăria Lina SRL');
  });

  it('offers every organization as a radio row, the current one checked, then the closing entry', async () => {
    switcher();
    await open();

    const rows = screen.getAllByRole('menuitemradio');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/Brutăria Lina SRL.*Organization administrator/);
    expect(rows[0]).toHaveAttribute('aria-checked', 'true');
    expect(rows[1]).toHaveTextContent(/Grupul Lina.*Editor/);
    expect(rows[1]).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitem', { name: 'Create another organization' })).toHaveAttribute(
      'href',
      '/create-organization',
    );
  });

  it('hands over the key of another organization, and nothing for the current one', async () => {
    const { onChoose } = switcher();

    await open();
    await userEvent.click(screen.getAllByRole('menuitemradio')[0]);
    expect(onChoose).not.toHaveBeenCalled();

    await open();
    await userEvent.click(screen.getAllByRole('menuitemradio')[1]);
    expect(onChoose).toHaveBeenCalledWith('org-b');
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('holds every row while a switch is on its way, and says so on the trigger', async () => {
    const { onChoose } = switcher({ pendingKey: 'org-b' });

    expect(screen.getByRole('button', { name: /Active organization/ })).toHaveAttribute('aria-busy', 'true');
    await open();
    for (const row of screen.getAllByRole('menuitemradio')) {
      expect(row).toHaveAttribute('aria-disabled', 'true');
    }
    await userEvent.click(screen.getAllByRole('menuitemradio')[1]);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('draws the note it is given above the rows, and none when given none', async () => {
    switcher({ note: 'Two answers have not been sent yet. They are sent before switching.' });
    await open();

    expect(
      screen.getByText('Two answers have not been sent yet. They are sent before switching.'),
    ).toBeInTheDocument();
  });

  it('draws no note by default', async () => {
    switcher();
    await open();

    expect(screen.queryByText(/sent before switching/)).toBeNull();
  });

  /** Literal, per the root file's test exception: the stylesheet selects `[data-tone='header']`. */
  it('stands on the surface it is told', () => {
    switcher({ tone: SWITCHER_TONE.HEADER });

    expect(screen.getByRole('button', { name: /Active organization/ })).toHaveAttribute('data-tone', 'header');
  });
});
