import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountMenu } from './account-menu';

/**
 * The user menu's contract (task 30.1) — three things, each of which renders identically when
 * broken.
 *
 * The trigger's accessible name, because the visible address alone does not say what the control
 * *is*. The identity block being a `Label` rather than an `Item`, because a focusable row that
 * does nothing is a keyboard stop with no destination — invisible to sighted review, and the
 * reason `WorkspaceNav` puts `aria-current` on the wrapper rather than trusting each caller.
 * And the language submenu, which exists because §4.2 puts language *inside* this menu and a
 * nested `DropdownMenu.Root` would break the keyboard contract the outer one is carrying.
 */
const LOCALES = [
  { code: 'ro', label: 'Română' },
  { code: 'en', label: 'English' },
] as const;

const menu = () =>
  render(
    <AccountMenu
      label="Your account"
      email="ana@example.md"
      items={[
        { key: 'credentials', node: <a href="/account/credentials">Sign-in details</a> },
        { key: 'sign-out', node: <button type="submit">Sign out</button> },
      ]}
      language={{
        label: 'Language',
        current: LOCALES[0],
        locales: LOCALES,
        renderItem: (locale) => <a href={`/${locale.code}`}>{locale.label}</a>,
      }}
    />,
  );

describe('AccountMenu', () => {
  it('names the trigger by what it is and who is signed in', () => {
    menu();

    expect(screen.getByRole('button', { name: 'Your account: ana@example.md' })).toBeInTheDocument();
  });

  it('opens onto the caller’s own items, with the address as a label rather than a stop', async () => {
    const user = userEvent.setup();
    menu();
    await user.click(screen.getByRole('button', { name: 'Your account: ana@example.md' }));

    // Exactly the items the caller passed, plus the language submenu — and nothing focusable in
    // between. An exact count rather than a `length > 0`: a duplicate row here is the defect the
    // count exists to catch, and a lenient locator would make it permanently invisible.
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Sign-in details',
      'Sign out',
      'LanguageRomână',
    ]);
  });

  it('offers every locale from the submenu and marks the current one', async () => {
    const user = userEvent.setup();
    menu();
    await user.click(screen.getByRole('button', { name: 'Your account: ana@example.md' }));
    await user.click(screen.getByRole('menuitem', { name: /Language/ }));

    // Scoped to the submenu, which Radix labels by its own trigger — the outer menu's rows are
    // still mounted and one of them carries the current locale's name.
    const submenu = await screen.findByRole('menu', { name: /Language/ });
    const items = within(submenu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Română', 'English']);
    // Colour is never the sole carrier (UX-102); `data-current` is what the stylesheet reads and
    // what an assertion can see.
    expect(items[0]).toHaveAttribute('data-current');
    expect(items[1]).not.toHaveAttribute('data-current');
  });
});
