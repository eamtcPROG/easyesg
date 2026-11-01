import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup } from './radio-group';

/**
 * `RadioGroup`'s contract (task 179.2) — the parts no specimen shows.
 *
 * - **It is one group with one name**, so the platform's keyboard contract holds: Tab reaches the group once, the
 *   arrow keys move the choice. A card that was a `<button>` would pass every visual check and fail this.
 * - **Controlled means controlled**: `undefined` is *nothing chosen*, and a choice reaches the caller rather than the
 *   DOM alone — the wizard writes on that call, so a radio that checked itself without it would show an answer the
 *   store never received.
 * - **The question names the group and help and error describe it**, as `Select` does for its trigger.
 */
const BASIS = [
  { value: 'vsme:OptionA', label: 'Option A (Basic Module only)' },
  { value: 'vsme:OptionB', label: 'Option B (Basic Module and Comprehensive Module)' },
] as const;

function Controlled({ onValueChange }: { readonly onValueChange: (value: string) => void }) {
  const [value, setValue] = useState<string | undefined>(undefined);
  return (
    <RadioGroup
      label="Basis for preparation"
      options={BASIS}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange(next);
      }}
    />
  );
}

describe('RadioGroup (§11.5)', () => {
  it('is a radio group named by its question, with a radio per answer named by its words', () => {
    render(<RadioGroup label="Basis for preparation" options={BASIS} value={undefined} onValueChange={() => {}} />);

    const group = screen.getByRole('radiogroup', { name: 'Basis for preparation' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Option A (Basic Module only)' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Option B (Basic Module and Comprehensive Module)' })).not.toBeChecked();
  });

  it('hands a choice to the caller and shows it, from a click on the card’s words', async () => {
    const onValueChange = vi.fn();
    render(<Controlled onValueChange={onValueChange} />);

    await userEvent.click(screen.getByText('Option B (Basic Module and Comprehensive Module)'));

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('vsme:OptionB');
    expect(screen.getByRole('radio', { name: /Option B/u })).toBeChecked();
  });

  it('takes one tab stop and moves the choice with the arrow keys', async () => {
    const onValueChange = vi.fn();
    render(
      <>
        <Controlled onValueChange={onValueChange} />
        <button type="button">After</button>
      </>,
    );

    await userEvent.tab();
    expect(screen.getByRole('radio', { name: /Option A/u })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: /Option B/u })).toBeChecked();
    expect(onValueChange).toHaveBeenLastCalledWith('vsme:OptionB');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('keeps two groups on one screen independent', async () => {
    render(
      <>
        <RadioGroup label="First" options={BASIS} defaultValue="vsme:OptionA" />
        <RadioGroup label="Second" options={BASIS} defaultValue="vsme:OptionA" />
      </>,
    );

    const secondB = screen.getAllByRole('radio', { name: /Option B/u })[1];
    if (secondB === undefined) throw new Error('the second group drew no Option B');
    await userEvent.click(secondB);

    const first = screen.getByRole('radiogroup', { name: 'First' });
    expect(first.querySelector('input:checked')).toHaveAttribute('value', 'vsme:OptionA');
    expect(secondB).toBeChecked();
  });

  it('describes the group with help and error together, and is invalid only with an error', () => {
    const { rerender } = render(
      <RadioGroup label="Basis" id="basis" options={BASIS} help="Which module this report follows." />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Basis' });
    expect(group).not.toHaveAttribute('aria-invalid');

    rerender(
      <RadioGroup
        label="Basis"
        id="basis"
        options={BASIS}
        help="Which module this report follows."
        error="Choose the module this report follows."
      />,
    );
    expect(group).toHaveAttribute('aria-describedby', 'basis-help basis-error');
    expect(group).toHaveAttribute('aria-invalid', 'true');
  });

  it('offers nothing to choose when disabled', async () => {
    const onValueChange = vi.fn();
    render(<RadioGroup label="Basis" options={BASIS} value={undefined} onValueChange={onValueChange} disabled />);

    await userEvent.click(screen.getByText('Option A (Basic Module only)'));

    expect(onValueChange).not.toHaveBeenCalled();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  });

  it('shows the caller’s choice and not the click — a choice the caller does not take stays unchosen', async () => {
    // The wizard holds the value: a refused write, or *Mark not available*, must leave no answer checked. A group that
    // checked itself on a click would show an answer the store never received.
    const onValueChange = vi.fn();
    render(<RadioGroup label="Basis" options={BASIS} value={undefined} onValueChange={onValueChange} />);

    await userEvent.click(screen.getByText('Option B (Basic Module and Comprehensive Module)'));

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('vsme:OptionB');
    expect(screen.getByRole('radio', { name: /Option B/u })).not.toBeChecked();
  });

  it('lets go of an answer the caller withdraws', () => {
    const { rerender } = render(
      <RadioGroup label="Basis" options={BASIS} value="vsme:OptionA" onValueChange={() => {}} />,
    );
    expect(screen.getByRole('radio', { name: /Option A/u })).toBeChecked();

    rerender(<RadioGroup label="Basis" options={BASIS} value={undefined} onValueChange={() => {}} />);

    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
  });

  it('is named by a visible label elsewhere when told to, drawing no label of its own (UX-110)', () => {
    render(
      <>
        <span id="question">Which option are you reporting under?</span>
        <RadioGroup labelledBy="question" options={BASIS} value={undefined} onValueChange={() => {}} />
      </>,
    );

    expect(screen.getByRole('radiogroup', { name: 'Which option are you reporting under?' })).toBeInTheDocument();
    expect(screen.getAllByText('Which option are you reporting under?')).toHaveLength(1);
  });
});
