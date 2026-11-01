import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ValidationGroup } from './validation-group';
import { ValidationPanel } from './validation-panel';

/** S-08's frame and a group (task 42.2): a region named by its heading, its groups lists named by theirs. */
describe('ValidationPanel', () => {
  it('is a region named by its heading, with the run control beside it and the groups below', () => {
    render(
      <ValidationPanel title="Validare" checked="Verificat la 14:32" action={<button type="button">Verificați</button>}>
        <ValidationGroup heading="B1 — Baza de întocmire" count="2 constatări">
          <li>una</li>
          <li>alta</li>
        </ValidationGroup>
      </ValidationPanel>,
    );

    const region = screen.getByRole('region', { name: 'Validare' });
    expect(within(region).getByText('Verificat la 14:32')).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Verificați' })).toBeInTheDocument();
    expect(within(region).getByRole('list', { name: 'B1 — Baza de întocmire' }).children).toHaveLength(2);
    expect(region).not.toHaveAttribute('aria-busy');
  });

  it('marks itself busy while a check is in flight, and offers no control where none is passed (a reader’s panel)', () => {
    render(
      <ValidationPanel title="Validare" checked="Se verifică…" busy>
        <p>—</p>
      </ValidationPanel>,
    );
    const region = screen.getByRole('region', { name: 'Validare' });
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(within(region).queryByRole('button')).toBeNull();
  });
});
