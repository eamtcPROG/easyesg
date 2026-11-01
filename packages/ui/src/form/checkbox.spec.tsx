import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './checkbox';

/**
 * `Checkbox`'s contract — §11.5's Form controls row, built at task 97 for S-01's *Keep me signed
 * in on this device*.
 *
 * What is worth asserting on a presentational control is the part that is **structural rather than
 * visual**: that it is a real checkbox rather than a painted div, that the label reaches it without
 * an id agreement, and that help and error are wired through `aria-describedby`. The appearance is
 * the artboard's business and a spec cannot see it.
 */
describe('Checkbox (§11.5)', () => {
  it('is a real checkbox the label reaches, with no id supplied', () => {
    render(<Checkbox label="Keep me signed in on this device" />);

    // `getByRole('checkbox', { name })` fails unless the platform semantics AND the accessible
    // name are both there — which is the whole claim `appearance: none` could silently break.
    expect(screen.getByRole('checkbox', { name: 'Keep me signed in on this device' })).toBeInTheDocument();
  });

  it('toggles by clicking the label text, not only the box', () => {
    render(<Checkbox label="Keep me signed in" defaultChecked={false} />);
    const box = screen.getByRole('checkbox');

    expect(box).not.toBeChecked();
    return userEvent.click(screen.getByText('Keep me signed in')).then(() => {
      expect(box).toBeChecked();
    });
  });

  it('toggles with the space key, which is the platform binding a div would lose', async () => {
    render(<Checkbox label="Keep me signed in" />);
    const box = screen.getByRole('checkbox');

    await userEvent.tab();
    expect(box).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(box).toBeChecked();
  });

  it('announces its error and marks itself invalid', () => {
    render(
      <Checkbox
        label="Accept the terms"
        error="You have not accepted the terms, so the account cannot be created. Tick the box to continue."
      />,
    );
    const box = screen.getByRole('checkbox');

    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription(/Tick the box to continue/u);
  });

  it('describes itself with help text, and drops the wiring when there is none', () => {
    const { rerender } = render(<Checkbox label="Keep me signed in" help="Twelve hours otherwise." />);
    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription('Twelve hours otherwise.');

    // The negative half: an unconditional `aria-describedby` pointing at an element that does not
    // exist is the failure this assertion exists for, and it is invisible without it.
    rerender(<Checkbox label="Keep me signed in" />);
    expect(screen.getByRole('checkbox')).not.toHaveAttribute('aria-describedby');
  });
});
