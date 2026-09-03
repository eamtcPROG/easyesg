import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DisclosureOption } from '@easyesg/contracts';
import { ChoiceSet } from './choice-set';

/**
 * The set-valued choice control (task 36.2), against the domain that shaped it.
 *
 * **Added after the gate-integrity review found it had no coverage of any kind** — no unit spec, and
 * no browser journey reaching it, so the exclusion of chosen members, the offered cap, the search
 * and the read-only rendering all shipped unguarded. Every case here is a claim the component's own
 * docblock makes.
 *
 * Textless by construction, so the labels are the test's: no catalogue is loaded and none is needed.
 */
const LABELS = {
  label: 'Activities',
  placeholder: 'Choose',
  prompt: 'Type to search',
  empty: 'Nothing matches',
  remove: (member: string) => `Remove ${member}`,
  removeShort: 'Remove',
  none: 'Nothing chosen',
  loading: 'Searching',
  unnamed: 'Unnamed',
};

const option = (value: string, label: string | null, code: string | null = null): DisclosureOption => ({
  value,
  label,
  code,
});

const NACE = [
  option('nace:NACE_C1071', 'Fabricarea pâinii', '10.71'),
  option('nace:NACE_G4711', 'Comerț cu amănuntul', '47.11'),
  option('nace:NACE_A0111', 'Cultivarea cerealelor', '01.11'),
];

const setUp = (over: Partial<Parameters<typeof ChoiceSet>[0]> = {}) => {
  const onCommit = vi.fn();
  render(
    <ChoiceSet
      options={NACE}
      draft=""
      onCommit={onCommit}
      readOnly={false}
      labelledBy="field-label"
      labels={LABELS}
      {...over}
    />,
  );
  return { onCommit };
};

describe('ChoiceSet (task 36.2)', () => {
  it('says nothing is chosen, and adds the member the reporter picks', async () => {
    const user = userEvent.setup();
    const { onCommit } = setUp();
    expect(screen.getByText(LABELS.none)).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: LABELS.label }));
    await user.click(await screen.findByRole('option', { name: /Fabricarea pâinii/u }));

    // The taxonomy-qualified member, space-separated — what the store holds and the export emits.
    expect(onCommit).toHaveBeenCalledWith('nace:NACE_C1071');
  });

  it('appends to what is already chosen rather than replacing it', async () => {
    const user = userEvent.setup();
    const { onCommit } = setUp({ draft: 'nace:NACE_A0111' });

    await user.click(screen.getByRole('combobox', { name: LABELS.label }));
    await user.click(await screen.findByRole('option', { name: /Fabricarea pâinii/u }));

    expect(onCommit).toHaveBeenCalledWith('nace:NACE_A0111 nace:NACE_C1071');
  });

  it('does not offer a member already chosen, so choosing twice is unrepresentable', async () => {
    const user = userEvent.setup();
    setUp({ draft: 'nace:NACE_C1071' });

    await user.click(screen.getByRole('combobox', { name: LABELS.label }));
    const listed = await screen.findAllByRole('option');
    // The store would hold the duplicate rather than refuse it, so the control removes the choice.
    // A plain string check, not `toContain(expect.stringContaining(…))` — `toContain` compares by
    // identity, so an asymmetric matcher there passes against anything and asserts nothing.
    expect(listed.some((item) => item.textContent?.includes('Fabricarea pâinii'))).toBe(false);
    expect(listed).toHaveLength(NACE.length - 1);
  });

  it('searches the reader’s words and the classification’s code alike', async () => {
    const user = userEvent.setup();
    setUp();
    const combobox = screen.getByRole('combobox', { name: LABELS.label });

    // A bookkeeper reading an invoice knows `10.71` and not its name, which is why the code matches.
    await user.click(combobox);
    await user.keyboard('10.71');
    expect(await screen.findAllByRole('option')).toHaveLength(1);

    await user.clear(combobox);
    await user.keyboard('cereale');
    const byWord = await screen.findAllByRole('option');
    expect(byWord).toHaveLength(1);
    expect(byWord[0]).toHaveTextContent(/Cultivarea cerealelor/u);
  });

  it('removes one chosen member and keeps the rest', async () => {
    const user = userEvent.setup();
    const { onCommit } = setUp({ draft: 'nace:NACE_C1071 nace:NACE_G4711' });

    await user.click(screen.getByRole('button', { name: 'Remove Fabricarea pâinii' }));

    expect(onCommit).toHaveBeenCalledWith('nace:NACE_G4711');
  });

  it('never shows a member key: the code stands in, and a neutral word behind it', () => {
    setUp({ draft: 'nace:NACE_C1071 vsme:SomethingUnnamed nace:NACE_UNCODED' });
    const chosen = screen.getByRole('list');

    // A member the platform names in no locale falls to its published code, then to a word — and
    // never to `vsme:SomethingUnnamed`, which the user-facing-text rule forbids a reader being shown.
    expect(within(chosen).getByText('Fabricarea pâinii')).toBeInTheDocument();
    expect(within(chosen).getAllByText(LABELS.unnamed)).toHaveLength(2);
    expect(chosen.textContent).not.toContain('vsme:');
    expect(chosen.textContent).not.toContain('NACE_UNCODED');
  });

  it('read-only names what was chosen and offers nothing to change it (UX-13)', () => {
    setUp({ readOnly: true, draft: 'nace:NACE_C1071 nace:NACE_G4711' });

    expect(screen.getByText('Fabricarea pâinii, Comerț cu amănuntul')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/u })).not.toBeInTheDocument();
  });
});
