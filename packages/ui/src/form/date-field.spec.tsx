import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateField } from './date-field';

/**
 * The date control's contract (task 32.1.1). Two of these are the whole reason the native input was
 * chosen over a composed calendar, and both would pass silently if someone "improved" it later.
 */
describe('DateField', () => {
  it('is a native date input, which is what makes the value ISO in every locale', () => {
    render(<DateField label="Period start" defaultValue="2026-01-01" />);

    const input = screen.getByLabelText('Period start');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveValue('2026-01-01');
  });

  /**
   * **The assertion above cannot tell a date input from a text one** — a `type="text"` field
   * returns `'2026-01-01'` too — so the ISO claim needs the case that separates them. A date input
   * *sanitizes*: anything that is not ISO reads back empty, where a text input echoes it verbatim.
   * That is the value contract this control was chosen for, asserted from the side where it bites.
   *
   * Added 31 Aug 2026 after a gate-integrity review proved the original assertion inert with
   * respect to the property its own comment claimed.
   */
  it('refuses a value that is not ISO, which a text box would echo', () => {
    render(<DateField label="Period start" defaultValue="30/04/2026" />);

    expect(screen.getByLabelText('Period start')).toHaveValue('');
  });

  /**
   * `type` is omitted from the props by construction, so this cannot be written in TypeScript — the
   * spread below is the escape hatch a JavaScript caller or an `as any` still has. Asserting it
   * keeps the guarantee true at runtime rather than only at compile time.
   */
  it('cannot be turned into a text box by a caller', () => {
    render(<DateField label="Period start" {...({ type: 'text' } as Record<string, string>)} />);

    expect(screen.getByLabelText('Period start')).toHaveAttribute('type', 'date');
  });

  it('carries the field anatomy it borrows — help, error and the aria wiring', () => {
    render(<DateField label="Period end" help="The last day in the period." error="Pick a later day." />);

    const input = screen.getByLabelText('Period end');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // Both are announced, and the error first: a reader hearing the help before the refusal has to
    // wait through the guidance to learn the submit failed.
    const describedBy = input.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(describedBy).toHaveLength(2);
    expect(document.getElementById(describedBy[0])).toHaveTextContent('Pick a later day.');
    expect(document.getElementById(describedBy[1])).toHaveTextContent('The last day in the period.');
  });

  /**
   * A passthrough guard on `onChange` and the value — **not** a test of the ISO contract, which the
   * case above owns. Its title said otherwise until the same review pointed out that typing into a
   * text box produces an identical result.
   */
  it('reports what the reporter typed', async () => {
    const onChange = vi.fn();
    render(<DateField label="Due date" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Due date'), '2026-04-30');

    expect(screen.getByLabelText('Due date')).toHaveValue('2026-04-30');
    expect(onChange).toHaveBeenCalled();
  });
});
