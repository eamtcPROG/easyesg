import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Fieldset } from './fieldset';
import { TextField } from './text-field';

/**
 * `Fieldset`'s wiring (§11.5, task 36.2) — the two things a rendering does not show.
 *
 * The component is a native `<fieldset>`/`<legend>` by the Components artboard's own instruction, so
 * what is worth pinning is not the markup but the behaviour that markup is chosen *for*: an
 * accessible `group` named by its legend, holding the controls. A refactor to a `<div>` with a
 * heading would look identical and expose no group at all.
 *
 * **What this deliberately does not assert** is that the legend joins each control's accessible
 * name — it does not, and this component's first docblock claimed it did. Writing the assertion is
 * what disproved the claim, which is the only reason the header now says the right thing.
 */
describe('Fieldset (§11.5)', () => {
  it('exposes a group named by its legend, with the controls inside it', () => {
    render(
      <Fieldset legend="Site 1">
        <TextField label="City" />
      </Fieldset>,
    );

    const group = screen.getByRole('group', { name: 'Site 1' });
    // Inside the group, not merely after it: containment is the association, and it is what a
    // screen reader announces on entry.
    expect(within(group).getByRole('textbox', { name: 'City' })).toBeInTheDocument();
  });

  it('offers the group’s own control, and withdraws it read-only while keeping the group', () => {
    const { rerender } = render(
      <Fieldset legend="Site 2" action={<button type="button">Remove</button>}>
        <TextField label="City" />
      </Fieldset>,
    );
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();

    rerender(
      <Fieldset legend="Site 2" action={<button type="button">Remove</button>} readOnly>
        <TextField label="City" />
      </Fieldset>,
    );
    // UX-13: the affordance goes and the content stays — a read-only group is still a readable one.
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Site 2' });
    expect(within(group).getByRole('textbox', { name: 'City' })).toBeInTheDocument();
  });
});
