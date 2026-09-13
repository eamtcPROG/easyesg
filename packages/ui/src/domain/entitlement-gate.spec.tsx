import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { EntitlementGate, meterExtent } from './entitlement-gate';

/**
 * The gate's contract (task 142) — UX-50's order, the path's absence being a stated case, and the
 * meter staying decoration. Each renders identically when broken, which is what earns a presentational
 * component a spec.
 */
describe('EntitlementGate (§6.10, UX-50)', () => {
  const gate = (actions: ReactNode | null) => (
    <EntitlementGate
      title="All 10 seats are taken"
      consumptionLabel="Seats in use"
      consumption="10 of 10"
      used={10}
      limit={10}
      actions={actions}
    >
      Withdraw an invitation or remove someone’s access to free a seat.
    </EntitlementGate>
  );

  it('states the limit, the consumption, the allowance and the path in UX-50’s order', () => {
    render(gate(<button type="button">Compare plans</button>));

    const region = screen.getByRole('status');
    const text = region.textContent ?? '';
    const order = ['All 10 seats are taken', 'Seats in use', '10 of 10', 'Withdraw an invitation', 'Compare plans'].map(
      (part) => text.indexOf(part),
    );

    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  /** UX-50 permits the path absent while there is nothing to upgrade to; the caller says so with `null`. */
  it('renders no path where the caller has none to offer', () => {
    render(gate(null));

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Withdraw an invitation');
  });

  it('keeps the meter out of the accessibility tree, since the figure carries the value', () => {
    const { container } = render(gate(null));

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('meterExtent', () => {
  it('fills in proportion to what is used', () => {
    expect(meterExtent({ used: 5, limit: 10 })).toBe(50);
    expect(meterExtent({ used: 10, limit: 10 })).toBe(100);
  });

  /** An organization over its ceiling — reachable once a ceiling is lowered — must not overdraw. */
  it('never draws past full, or below empty', () => {
    expect(meterExtent({ used: 11, limit: 10 })).toBe(100);
    expect(meterExtent({ used: -1, limit: 10 })).toBe(0);
  });

  it('draws full where nothing is allowed', () => {
    expect(meterExtent({ used: 0, limit: 0 })).toBe(100);
  });
});
