import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ValidationCountBar } from './validation-count-bar';

/** S-08's count below `wide` (task 42.2): one button, named by the caller's sentence, saying whether its sheet is open. */
describe('ValidationCountBar', () => {
  it('is a button named by the counts that raises the sheet', () => {
    const onOpen = vi.fn();
    render(
      <ValidationCountBar onOpen={onOpen} expanded={false}>
        4 de corectat · 5 de revizuit
      </ValidationCountBar>,
    );
    const bar = screen.getByRole('button', { name: '4 de corectat · 5 de revizuit' });
    expect(bar).toHaveAttribute('aria-expanded', 'false');
    expect(bar).toHaveAttribute('aria-haspopup', 'dialog');
    fireEvent.click(bar);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('marks its seat, which the Wizard shell keeps in view below `wide`', () => {
    const { container } = render(
      <ValidationCountBar onOpen={() => undefined} expanded={false}>
        —
      </ValidationCountBar>,
    );
    expect(container.querySelector('[data-panel-seat]')).not.toBeNull();
  });
});
