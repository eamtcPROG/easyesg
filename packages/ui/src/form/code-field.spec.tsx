import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeField } from './code-field';

/**
 * A controlled harness, because the control is controlled by construction — it paints the cells
 * from the value. Asserting a paste against a fixed `value=""` reads the empty string back: React
 * reverts a controlled input whose value did not change, before the assertion runs. That is React
 * working, not the component failing, and the harness is what makes the test ask the real question.
 */
function Controlled({ length }: { length?: number }) {
  const [value, setValue] = useState('');
  return (
    <CodeField
      label="Authenticator code"
      length={length}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

/**
 * `CodeField`'s contract — a §11.5 inventory addition (UX-89), and the tests are the UX-108 half.
 *
 * The visual contract is the artboard; what no rendering shows, and what a later refactor toward
 * "six inputs, like everyone else" would silently take away, is here. **Every one of these is a
 * property that six inputs cannot have**, which is why they are worth a spec rather than a review
 * note: one labelled control, one paste target, one autofill target, one announcement.
 */
describe('CodeField', () => {
  const setup = (props: Partial<Parameters<typeof CodeField>[0]> = {}) => {
    const onChange = vi.fn();
    render(
      <CodeField label="Authenticator code" value="" onChange={onChange} {...props} />,
    );
    return { onChange };
  };

  it('is exactly one labelled control, whatever the cell count suggests', () => {
    setup({ length: 6 });

    // `getBy` and not `getAllBy`: six inputs would pass a `getAllBy` and fail here, which is the
    // regression this test exists to catch.
    const input = screen.getByLabelText('Authenticator code');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('carries the three attributes UX-108 turns on', () => {
    setup();
    const input = screen.getByLabelText('Authenticator code');

    // The literals are the platform's contract, asserted as literals on purpose: `one-time-code`
    // is what surfaces the authenticator sheet's suggestion, and a rename would be silent.
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('maxlength', '6');
  });

  it('accepts a pasted code in one go, and paints all of it', async () => {
    const user = userEvent.setup();
    const { container } = render(<Controlled />);

    await user.click(screen.getByLabelText('Authenticator code'));
    await user.paste('123456');

    // The whole code lands in one field and every cell fills. Six inputs would take the paste
    // into ONE cell — the failure UX-108 is written against, and the reason this is one input.
    expect(screen.getByLabelText('Authenticator code')).toHaveValue('123456');
    expect(
      [...container.querySelectorAll('[aria-hidden="true"] > span')].map((c) => c.textContent),
    ).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('stops at the cell count, so a longer paste cannot overflow the painted cells', async () => {
    const user = userEvent.setup();
    render(<Controlled length={4} />);

    await user.click(screen.getByLabelText('Authenticator code'));
    await user.paste('123456');

    // `maxLength` is the platform's own bound; asserting it here proves it is wired to `length`
    // rather than merely present, so the value and the cells cannot disagree about the code.
    expect(screen.getByLabelText('Authenticator code')).toHaveValue('1234');
  });

  it('paints the value into the cells and marks where the next character lands', () => {
    const { container } = render(
      <CodeField label="Authenticator code" value="407" onChange={vi.fn()} />,
    );

    // The cells are presentation, so they are read from the DOM rather than by role — being
    // unreachable by role is itself the property (`aria-hidden`), asserted below.
    const cells = [...container.querySelectorAll('[aria-hidden="true"] > span')];
    expect(cells).toHaveLength(6);
    expect(cells.slice(0, 3).map((cell) => cell.textContent)).toEqual(['4', '0', '7']);
    expect(cells.slice(3).every((cell) => cell.textContent === '')).toBe(true);
  });

  it('hides the cells from assistive technology, so the code is not read back character by character', () => {
    render(<CodeField label="Authenticator code" value="4072" onChange={vi.fn()} />);

    // The input carries the label and the value; the cells repeat it visually. Announcing both
    // would read a code one character at a time while the user is typing it.
    expect(screen.getByLabelText('Authenticator code')).toHaveValue('4072');
    expect(screen.queryByText('4', { ignore: '[aria-hidden="true"] *' })).toBeNull();
  });

  it('wires help and error through aria-describedby, in that order', () => {
    render(
      <CodeField
        label="Authenticator code"
        value=""
        onChange={vi.fn()}
        help="From your authenticator app."
        error="That code is not right. Codes last 30 seconds — check the app and type the current one."
      />,
    );

    const input = screen.getByLabelText('Authenticator code');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const described = input.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(described).toHaveLength(2);
    // Error first: a screen reader reaching the field mid-correction should hear what is wrong
    // before it hears the standing help.
    expect(document.getElementById(described[0])).toHaveTextContent('not right');
    expect(document.getElementById(described[1])).toHaveTextContent('authenticator app');
  });

  it('takes a caller id, so the UX-111 summary can deep-link to it', () => {
    render(<CodeField label="Authenticator code" id="totp" value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Authenticator code')).toHaveAttribute('id', 'totp');
  });

  it('renders the hint slot, which is where the code window is counted down', () => {
    // A slot rather than a timer: the two consumers time different windows (a 30-second TOTP
    // step, and task 27.3's five-minute challenge), so a clock in here would tick for a window
    // it cannot know — and every consumer would inherit a per-second re-render.
    render(
      <CodeField label="Authenticator code" value="" onChange={vi.fn()} hint="valid for 21 s" />,
    );
    expect(screen.getByText('valid for 21 s')).toBeInTheDocument();
  });

  it('honours a length other than six, and bounds entry to it', () => {
    const { container } = render(
      <CodeField label="Backup code" length={4} value="" onChange={vi.fn()} />,
    );
    expect(container.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(4);
    expect(screen.getByLabelText('Backup code')).toHaveAttribute('maxlength', '4');
  });

  it('disables the real control, not just the painted one', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ disabled: true });

    const input = screen.getByLabelText('Authenticator code');
    expect(input).toBeDisabled();
    await user.type(input, '1');
    expect(onChange).not.toHaveBeenCalled();
  });
});
