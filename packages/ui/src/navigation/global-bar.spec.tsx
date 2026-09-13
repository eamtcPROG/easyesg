import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GlobalBar } from './global-bar';
import { GLOBAL_BAR_TONE } from './global-bar-vocabulary';

/**
 * The band's two renderings, which are the two §8.1 states it has (task 30.1).
 *
 * Both are reachable in a browser, and neither is cheap there: the second needs an account holding
 * several memberships with no stated preference, or an API that fails only for the layout's read.
 * As a component spec they are two assertions.
 *
 * The organization region's accessible naming is the interesting one. UX-2 requires the active
 * organization to be *visible*, and a company name alone in a banner does not tell a screen-reader
 * user that it is the scope everything below is filtered by.
 */
const bar = (organization?: { label: string; name: string }) =>
  render(
    <GlobalBar
      label="easyesg"
      brand={<a href="/home">easyESG</a>}
      organization={organization}
      actions={<button type="button">Account</button>}
    />,
  );

describe('GlobalBar', () => {
  it('names the active organization, with its role stated for a screen reader', () => {
    bar({ label: 'Active organization', name: 'Brutăria Lina SRL' });

    // One element carrying both halves: the label is clipped, not removed, so it is in the
    // accessibility tree and out of the layout.
    expect(screen.getByText('Active organization')).toBeInTheDocument();
    expect(screen.getByText('Brutăria Lina SRL')).toBeInTheDocument();
  });

  it('renders brand and actions with no organization region when none is resolved', () => {
    bar();

    // S-04's own artboard: a verified account belonging to nothing sees exactly this. The same
    // rendering covers the failed membership read and the unchosen-preference state — the chrome
    // never guesses a name, and never fails the screen it frames.
    expect(screen.getByRole('link', { name: 'easyESG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
    expect(screen.queryByText('Active organization')).toBeNull();
  });

  it('is a banner landmark, so the tier is skippable rather than read on every screen', () => {
    bar();

    expect(screen.getByRole('banner')).toHaveAccessibleName('easyesg');
  });
});

/**
 * The band's tone (task 67.1) — the one property the stylesheet reads off the markup.
 *
 * **`data-tone` is asserted as the literal**, per the root file's test exception: the stylesheet
 * selects `[data-tone='console']` by its literal, so a value renamed in the vocabulary would move a
 * constant-based assertion along with the component and leave the selector matching nothing.
 */
describe('GlobalBar tone (task 67.1)', () => {
  it('draws the brand band when no tone is given, which is every tenant and public caller', () => {
    bar();

    expect(screen.getByRole('banner')).toHaveAttribute('data-tone', 'brand');
  });

  it('draws the console band when the console asks for it, with the same regions', () => {
    render(
      <GlobalBar
        tone={GLOBAL_BAR_TONE.CONSOLE}
        label="Console"
        brand={<a href="/">easyESG</a>}
        actions={<button type="button">Account</button>}
      />,
    );

    const banner = screen.getByRole('banner', { name: 'Console' });
    expect(banner).toHaveAttribute('data-tone', 'console');
    expect(banner).toContainElement(screen.getByRole('link', { name: 'easyESG' }));
    expect(banner).toContainElement(screen.getByRole('button', { name: 'Account' }));
  });
});
