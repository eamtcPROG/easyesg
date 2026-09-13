import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsageCounter } from './usage-counter';
import { USAGE_STANDING } from './usage-counter-vocabulary';

/**
 * The counter's contract (task 142) — the parts that render identically when broken: which standing
 * the markup carries, and that the mark a sighted reader sees is never the only thing saying it.
 *
 * **`data-standing` is asserted as the literal, never through `USAGE_STANDING`** (task 142's
 * gate-integrity review). The stylesheet selects `[data-standing='approaching']` by its literal, so a
 * value renamed in the vocabulary would change a constant-based assertion along with the component
 * and leave the selector matching nothing — measured: renamed to `'nearing'`, the constant-based
 * version passed five of five with the marked row gone. The literal is the wire value the CSS
 * depends on, which is root `CLAUDE.md`'s case for a test pinning `'active'`.
 */
describe('UsageCounter (§6.10, UX-52)', () => {
  it('states the figure in the caller’s words, unmarked while room remains', () => {
    const { container } = render(
      <UsageCounter standing={USAGE_STANDING.WITHIN}>4 of 10 seats in use</UsageCounter>,
    );

    expect(screen.getByText('4 of 10 seats in use')).toBeInTheDocument();
    const counter = container.firstElementChild;
    expect(counter).toHaveAttribute('data-standing', 'within');
    expect(counter?.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  /**
   * UX-52's warning, and UX-102's rule about it: the dot is hidden from assistive technology, so the
   * words the caller wrote are the whole announcement — which is why the dot may exist at all.
   */
  it.each([
    [USAGE_STANDING.APPROACHING, 'approaching'],
    [USAGE_STANDING.REACHED, 'reached'],
  ] as const)(
    'marks the %s standing with a dot hidden from assistive technology',
    (standing, wireValue) => {
      const { container } = render(
        <UsageCounter standing={standing}>9 of 10 seats in use · one left</UsageCounter>,
      );

      const counter = container.firstElementChild;
      expect(counter).toHaveAttribute('data-standing', wireValue);
      expect(counter?.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
      expect(counter).toHaveTextContent('9 of 10 seats in use · one left');
    },
  );

  it('draws an unknown figure quietly, as the partial state it is', () => {
    const { container } = render(
      <UsageCounter standing={USAGE_STANDING.UNKNOWN}>The seat count cannot be shown</UsageCounter>,
    );

    expect(container.firstElementChild).toHaveAttribute('data-standing', 'unknown');
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('renders a next step only where the screen gives one', () => {
    const { rerender } = render(
      <UsageCounter standing={USAGE_STANDING.APPROACHING} action={<a href="/plan">See the plan</a>}>
        4 of 5 entities used · one left
      </UsageCounter>,
    );
    expect(screen.getByRole('link', { name: 'See the plan' })).toBeInTheDocument();

    rerender(
      <UsageCounter standing={USAGE_STANDING.APPROACHING}>4 of 5 entities used · one left</UsageCounter>,
    );
    expect(screen.queryByRole('link')).toBeNull();
  });
});
