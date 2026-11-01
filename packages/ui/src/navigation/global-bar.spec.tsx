import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GlobalBar } from './global-bar';
import { GLOBAL_BAR_TONE } from './global-bar-vocabulary';

/**
 * The band's two renderings, which are the two §8.1 states it has (task 30.1).
 *
 * Both are reachable in a browser, and neither is cheap there: the second needs an account with no
 * organization resolved, or an API that fails only for the layout's read. As a component spec they
 * are two assertions.
 *
 * **Since task 83.2 the organization region is a slot the app's switcher fills**, so what is asserted
 * is that the band carries it inside its landmark; the switcher's own naming is
 * `organization-switcher.spec.tsx`'s. That the region is absent below the medium frame is a stylesheet
 * rule jsdom cannot see, and `e2e/web/organization-switcher.spec.ts` holds it at 390.
 */
const bar = (organization?: ReactNode) =>
  render(
    <GlobalBar
      label="easyesg"
      brand={<a href="/home">easyESG</a>}
      organization={organization}
      actions={<button type="button">Account</button>}
    />,
  );

describe('GlobalBar', () => {
  it('carries the organization control it is given, inside the banner', () => {
    bar(<button type="button">Active organization: Brutăria Lina SRL</button>);

    expect(screen.getByRole('banner')).toContainElement(
      screen.getByRole('button', { name: 'Active organization: Brutăria Lina SRL' }),
    );
  });

  it('renders brand and actions with no organization region when none is resolved', () => {
    bar();

    // S-04's own artboard: a verified account belonging to nothing sees exactly this. The same
    // rendering covers the failed membership read and S-37's choosing — the chrome never guesses a
    // name, and never fails the screen it frames.
    expect(screen.getByRole('link', { name: 'easyESG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    // The region is absent, not merely empty: the brand stands alone in its half of the band, with no divider
    // beside it. A count of buttons cannot see an empty wrapper or a divider hidden from assistive technology.
    expect(screen.getByRole('link', { name: 'easyESG' }).parentElement?.children).toHaveLength(1);
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
