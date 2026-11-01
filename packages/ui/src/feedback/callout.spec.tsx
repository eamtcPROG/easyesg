import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../primitives/button';
import { CALLOUT_INTENT, Callout } from './callout';

/**
 * The action slot (24 Oct 2026). An empty slot was a flex item for `action={null}` — the shape 34 callers pass — and
 * its 8px gap left every such callout 24px under its text against 16px above it, measured on the component canvas at
 * 93px where the padding and the text add to 85.
 */
describe('Callout (§11.5)', () => {
  it('draws no action slot when the next step is already in the message', () => {
    render(
      <Callout intent={CALLOUT_INTENT.INFO} title="Raportul se poate depune" action={null}>
        Toate modulele sunt completate.
      </Callout>,
    );
    // Beside the icon: the message, and nothing after it.
    const content = screen.getByRole('status').lastElementChild;
    expect(content?.children).toHaveLength(1);
  });

  it('draws the action after the message when there is one', () => {
    render(
      <Callout intent={CALLOUT_INTENT.ERROR} title="Exportul a eșuat" action={<Button>Reîncercați</Button>}>
        Fișierul nu a putut fi generat.
      </Callout>,
    );
    const content = screen.getByRole('alert').lastElementChild;
    expect(content?.children).toHaveLength(2);
    expect(content?.lastElementChild).toContainElement(screen.getByRole('button', { name: 'Reîncercați' }));
  });
});
