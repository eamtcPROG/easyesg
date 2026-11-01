import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompletenessMeter } from './completeness-meter';

/**
 * The meter's contract (task 42.2; FR-41 item 5, 182/18): three counts in words, a bar that is only decoration, and no
 * percentage anywhere. `data-run` is asserted as the literal the stylesheet selects on.
 */
const legend = { resolved: '12 answered', reasoned: '3 reasoned', outstanding: '4 outstanding' };

describe('CompletenessMeter', () => {
  it('states each count in the caller’s words, and hides the bar from assistive technology', () => {
    const { container } = render(<CompletenessMeter counts={{ resolved: 12, reasoned: 3, outstanding: 4 }} legend={legend} />);

    for (const words of Object.values(legend)) expect(screen.getByText(words)).toBeInTheDocument();
    const bar = container.querySelector('[aria-hidden="true"]');
    expect(bar?.querySelectorAll('[data-run]')).toHaveLength(3);
    // The share as a weight, never a printed figure.
    expect(bar?.querySelector('[data-run="resolved"]')).toHaveStyle({ flexGrow: '12' });
    expect(container.textContent).not.toMatch(/%/u);
  });

  it('draws no run for a count of zero, and still states it', () => {
    const { container } = render(<CompletenessMeter counts={{ resolved: 0, reasoned: 0, outstanding: 5 }} legend={legend} />);
    const bar = container.querySelector('[aria-hidden="true"]');
    expect(bar?.querySelectorAll('[data-run]')).toHaveLength(1);
    expect(screen.getByText('12 answered')).toBeInTheDocument();
  });
});
