import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { Combobox, type ComboboxOption } from './combobox';

/**
 * The combobox contract (task 30.4.1) — the parts that render identically when broken.
 *
 * Its keyboard and ARIA behaviour is **not** a library's here: Radix publishes no combobox, so
 * `aria-activedescendant`, the roles and the arrow handling are this file's and have to be pinned
 * by something. A browser journey cannot see any of them.
 */
const OPTIONS: ComboboxOption[] = [
  { value: '10.7', label: 'Fabricarea produselor de brutărie', description: '10.7' },
  { value: '10.71', label: 'Fabricarea pâinii', description: '10.71' },
  { value: '10.72', label: 'Fabricarea biscuiţilor', description: '10.72' },
];

const STRINGS = {
  promptLabel: 'Type to search',
  emptyLabel: 'Nothing matched',
  loadingLabel: 'Searching',
};

function Harness({
  options = OPTIONS,
  loading = false,
  onValueChange = vi.fn(),
}: {
  options?: ComboboxOption[];
  loading?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [value, setValue] = useState('');
  return (
    <Combobox
      label="Activity"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange(next);
      }}
      query={query}
      onQueryChange={setQuery}
      options={options}
      loading={loading}
      {...STRINGS}
    />
  );
}

describe('Combobox', () => {
  it('is a combobox that owns its list, and says so', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole('combobox', { name: 'Activity' });
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await user.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    // The list is the one the input names — a mismatch here is invisible on screen and total to a
    // screen reader.
    const listId = input.getAttribute('aria-controls');
    expect(screen.getByRole('listbox').id).toBe(listId);
  });

  it('points at the active option rather than focusing it, so typing continues', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Activity' });
    await user.click(input);

    const options = screen.getAllByRole('option');
    // Arrowing moves `aria-activedescendant` and leaves focus in the input. Both halves matter:
    // focus moving would take the caret out of the text being edited, and the attribute not
    // moving would leave a screen reader silent while the highlight travels.
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);
    expect(input).toHaveFocus();

    // It wraps, so a reader never has to arrow back through the whole list.
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
  });

  it('chooses with Enter and echoes the label into the input', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);
    const input = screen.getByRole('combobox', { name: 'Activity' });

    await user.click(input);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onValueChange).toHaveBeenCalledWith('10.71');
    // The label, not the code: the control has to read as *chosen* rather than as a search box
    // that happened to fire something.
    expect(input).toHaveValue('Fabricarea pâinii');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks the chosen option for assistive technology, not by colour alone (UX-102)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Activity' });

    await user.click(input);
    await user.keyboard('{ArrowDown}{Enter}');
    await user.click(input);

    const chosen = screen.getByRole('option', { selected: true });
    expect(within(chosen).getByText('Fabricarea pâinii')).toBeInTheDocument();
  });

  it('tells "nothing typed yet" apart from "nothing matched"', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness options={[]} />);
    const input = screen.getByRole('combobox', { name: 'Activity' });

    await user.click(input);
    // A control that said "nothing matched" here would teach the reader their search is broken
    // before they have made one.
    expect(screen.getByText('Type to search')).toBeInTheDocument();

    await user.type(input, 'zzz');
    rerender(<Harness options={[]} />);
    expect(screen.getByText('Nothing matched')).toBeInTheDocument();
  });

  it('names the wait, since the spinner itself is decorative by contract', async () => {
    const user = userEvent.setup();
    render(<Harness loading />);
    await user.click(screen.getByRole('combobox', { name: 'Activity' }));

    // `Spinner`'s own docblock puts the name on the container; this is that container.
    expect(screen.getByRole('status')).toHaveTextContent('Searching');
  });

  it('closes on Escape without clearing what was typed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Activity' });

    await user.type(input, 'brut');
    await user.keyboard('{Escape}');

    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('brut');
  });
});
