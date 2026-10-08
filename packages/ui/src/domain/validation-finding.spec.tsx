import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ValidationFinding } from './validation-finding';
import { FINDING_WEIGHT } from './validation-vocabulary';

/**
 * One finding (task 42.2; UX-23): its weight in words and a tone the stylesheet selects by `data-weight` — asserted as
 * the literal the selector depends on, `UsageCounter`'s reason.
 */
describe('ValidationFinding', () => {
  it.each([
    [FINDING_WEIGHT.MUST_FIX, 'must_fix'],
    [FINDING_WEIGHT.REVIEW, 'review'],
    [FINDING_WEIGHT.CLEARED, 'cleared'],
  ] as const)('carries the %s weight in its words and its markup', (weight, wire) => {
    const { container } = render(
      <ul>
        <ValidationFinding
          field="Cifra de afaceri"
          detail="Amplasament 2"
          weight={weight}
          weightLabel="Cuvântul greutății"
          message="Această întrebare nu are încă un răspuns."
          actions={<a href="#x">Mergeți la câmp</a>}
        />
      </ul>,
    );
    const item = container.querySelector('li');
    expect(item).toHaveAttribute('data-weight', wire);
    expect(screen.getByText('Cuvântul greutății')).toHaveAttribute('data-weight', wire);
    expect(screen.getByText('Amplasament 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mergeți la câmp' })).toBeInTheDocument();
  });
});
