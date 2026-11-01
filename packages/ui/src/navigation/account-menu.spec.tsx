import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountMenu, type AccountMenuProps } from './account-menu';
import { GLOBAL_BAR_TONE } from './global-bar-vocabulary';

/**
 * The user menu's contract (task 30.1) — three things, each of which renders identically when
 * broken.
 *
 * The trigger's accessible name, because the visible text alone does not say what the control
 * *is*. The identity block being a `Label` rather than an `Item`, because a focusable row that
 * does nothing is a keyboard stop with no destination — invisible to sighted review, and the
 * reason `WorkspaceNav` puts `aria-current` on the wrapper rather than trusting each caller.
 * And the language submenu, which exists because §4.2 puts language *inside* this menu and a
 * nested `DropdownMenu.Root` would break the keyboard contract the outer one is carrying.
 *
 * **Task 140 adds a fourth, and it is the one with two shapes rather than one.** UX-137 gives an
 * account with a name a monogram and a name; an account without one keeps the glyph and the
 * address. Both are ordinary states of this component — the second is what every account has
 * until someone fills the fields in, and what a provider sign-up asserting no name keeps
 * permanently — so each is asserted rather than described.
 */
const LOCALES = [
  { code: 'ro', label: 'Română' },
  { code: 'en', label: 'English' },
] as const;

const ADDRESS = 'ana@example.md';

const PROPS: AccountMenuProps<'ro' | 'en'> = {
  label: 'Your account',
  email: ADDRESS,
  displayName: 'Ana Popescu',
  monogram: 'AP',
  items: [
    { key: 'credentials', node: <a href="/account/credentials">Sign-in details</a> },
    { key: 'sign-out', node: <button type="submit">Sign out</button> },
  ],
  language: {
    label: 'Language',
    current: LOCALES[0],
    locales: LOCALES,
    renderItem: (locale) => <a href={`/${locale.code}`}>{locale.label}</a>,
  },
};

/**
 * The no-name account, spelled the way the session codec spells it rather than invented here:
 * `displayName` has already fallen back to the address upstream and `monogram` is `null`. Passing
 * `displayName: ''` would test a state no caller can produce.
 */
const WITHOUT_A_NAME = { displayName: ADDRESS, monogram: null } as const;

const menu = (overrides: Partial<AccountMenuProps<'ro' | 'en'>> = {}) =>
  render(<AccountMenu {...PROPS} {...overrides} />);

/**
 * The trigger, located by its accessible name — which carries the visible label and the address
 * (WCAG SC 2.5.3, Level A, inside NFR-75's 2.2 AA), and the address alone where the name IS the
 * address. The default is the named account because that is the shape most cases use.
 */
const trigger = (name = `Your account: Ana Popescu, ${ADDRESS}`) =>
  screen.getByRole('button', { name });

const namelessTrigger = () => trigger(`Your account: ${ADDRESS}`);

describe('AccountMenu', () => {
  it('names the trigger by what it is, what it SHOWS, and the address (WCAG 2.5.3)', () => {
    menu();

    // The visible label must appear in the accessible name or SC 2.5.3 fails — a speech-input user
    // saying *"Ana Popescu"* would activate nothing. The address is there too because it is the
    // unique fact; the name alone would be ambiguous between two people who share one.
    expect(trigger()).toBeInTheDocument();
  });

  it('names the trigger by the address ALONE where the name has fallen back to it', () => {
    menu(WITHOUT_A_NAME);

    // Not `Your account: ana@example.md, ana@example.md`. One string said twice reads as a fault,
    // which is the identity block's rule applied to the accessible name.
    expect(namelessTrigger()).toBeInTheDocument();
  });

  it('shows the derived name on the band and the monogram in place of the glyph (UX-137)', () => {
    const { container } = menu();

    expect(trigger()).toHaveTextContent('Ana Popescu');
    expect(within(trigger()).getByText('AP')).toBeInTheDocument();
    // The glyph is gone rather than sitting behind it: lucide renders an `svg`, and the only other
    // one in the trigger is the chevron, so an exact count is what says the avatar swapped.
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('keeps the glyph and shows the address where the account has no name (UX-137)', () => {
    const { container } = menu(WITHOUT_A_NAME);

    expect(namelessTrigger()).toHaveTextContent(ADDRESS);
    // **No initial cut from the address.** `a` is what a monogram derived from `ana@example.md`
    // would be, and UX-137 refuses it — an identity the product never captured, shown to the
    // person it is wrong about. The avatar's glyph and the chevron are both svgs here.
    expect(within(namelessTrigger()).queryByText(/^a$/i)).toBeNull();
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });

  it('opens onto the caller’s own items, with the identity as a label rather than a stop', async () => {
    const user = userEvent.setup();
    menu();
    await user.click(trigger());

    // Exactly the items the caller passed, plus the language submenu — and nothing focusable in
    // between. An exact count rather than a `length > 0`: a duplicate row here is the defect the
    // count exists to catch, and a lenient locator would make it permanently invisible.
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Sign-in details',
      'Sign out',
      'LanguageRomână',
    ]);
  });

  it('states the name and the address as two lines in the identity block', async () => {
    const user = userEvent.setup();
    menu();
    await user.click(trigger());

    // Scoped to the menu, because the trigger renders the name too and an unscoped `getByText`
    // would pass on either element.
    // `getByText` IS the assertion that the name is there — it throws otherwise — so restating it
    // against the parent would be a tautology by construction, which is what the first draft did.
    // What the parent adds is the second line: the two facts in ONE block rather than two places.
    const identity = within(screen.getByRole('menu')).getByText('Ana Popescu').parentElement;
    expect(identity).not.toBeNull();
    expect(identity).toHaveTextContent(ADDRESS);
  });

  it('states the address ONCE where the name has fallen back to it', async () => {
    const user = userEvent.setup();
    menu(WITHOUT_A_NAME);
    await user.click(namelessTrigger());

    // One line, not two. Repeating one string on two lines reads as a rendering fault rather than
    // as two facts — and the count is the assertion, since both elements render the same text and
    // a `getByText` would be satisfied by either.
    expect(within(screen.getByRole('menu')).getAllByText(ADDRESS)).toHaveLength(1);
  });

  it('offers every locale from the submenu and marks the current one', async () => {
    const user = userEvent.setup();
    menu();
    await user.click(trigger());
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

/**
 * The console's corner (task 67.1): one locale, so no language row, and a band of its own. Both are
 * props of this menu rather than a second one, so both are asserted here rather than in the console.
 *
 * `data-tone` is asserted as the literal: the stylesheet selects `[data-tone='console']`, so a value
 * renamed in the vocabulary must fail here rather than move along with the component.
 */
describe('AccountMenu on a single-locale surface (task 67.1)', () => {
  it('offers the caller’s items and no language row where `language` is null', async () => {
    const user = userEvent.setup();
    menu({ language: null });
    await user.click(trigger());

    // Exact, as the case above is: the language row absent, not merely unlabelled.
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Sign-in details',
      'Sign out',
    ]);
  });

  it('marks the band the trigger stands on — brand unless the caller says console', () => {
    const { unmount } = menu();
    expect(trigger()).toHaveAttribute('data-tone', 'brand');
    unmount();

    menu({ tone: GLOBAL_BAR_TONE.CONSOLE });
    expect(trigger()).toHaveAttribute('data-tone', 'console');
  });
});
