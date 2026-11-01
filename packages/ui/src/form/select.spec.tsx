import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from './select';

/**
 * `Select`'s wiring, and the one library behaviour a screen is entitled to rely on.
 *
 * The component moved from a native `<select>` to Radix Select on 26 Aug 2026, which changed what
 * can silently break. The visual contract is a specimen; these four are the ones no rendering shows:
 *
 * - **`id` lands on the trigger**, because the trigger is what takes focus. UX-111's error summary
 *   deep-links to `#id` to move focus to the offending field, and an `id` that drifted onto a
 *   wrapper `<div>` would focus nothing while still looking correct in the DOM.
 * - **`aria-describedby` carries help *and* error**, in that order — losing one is invisible except
 *   to a screen reader.
 * - **The hidden form input carries `name`.** This is Radix's own behaviour ("The Select component
 *   renders a hidden input for form submission by default"), and it is what lets a filter be an
 *   ordinary `<form method="get">` rather than a client-side router push. A Radix major that
 *   dropped it would break that silently, so it is pinned here rather than assumed.
 */
const ROLES = [
  { value: 'editor', label: 'Editor', description: 'Can enter and change report data.' },
  { value: 'viewer', label: 'Viewer' },
] as const;

describe('Select (§11.5)', () => {
  it('puts the id on the focusable trigger, so a summary link reaches the control', () => {
    render(<Select label="Role" id="member-role" options={ROLES} placeholder="Choose" />);

    const trigger = screen.getByRole('combobox', { name: 'Role' });
    expect(trigger).toHaveAttribute('id', 'member-role');
    expect(trigger.tagName).toBe('BUTTON');
  });

  it('describes the control with help and error together', () => {
    render(
      <Select
        label="Role"
        id="member-role"
        options={ROLES}
        help="What this person may do."
        error="Choose a role before sending the invitation."
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'Role' });
    expect(trigger).toHaveAttribute('aria-describedby', 'member-role-help member-role-error');
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
  });

  it('is not marked invalid without an error', () => {
    render(<Select label="Role" options={ROLES} help="What this person may do." />);
    expect(screen.getByRole('combobox', { name: 'Role' })).not.toHaveAttribute('aria-invalid');
  });

  /**
   * The property a `<form method="get">` filter rests on — Radix's, not ours.
   *
   * **The hidden control exists only inside a `<form>`**, which this spec found rather than assumed:
   * Radix asks the trigger for `closest('form')` and renders nothing when the answer is null. So a
   * `name` on a `Select` standing outside a form is silently inert — correct, but worth knowing
   * before someone reaches for `name` as a general-purpose identifier.
   */
  it('submits through a hidden native control carrying the name', () => {
    const { container } = render(
      <form>
        <Select label="Role" name="role" defaultValue="viewer" options={ROLES} />
      </form>,
    );

    const submitted = container.querySelector('select[name="role"]');
    expect(submitted).not.toBeNull();
    expect(submitted).toHaveValue('viewer');
  });

  /** The label is never simply dropped — `labelHidden` clips it, keeping the accessible name. */
  it('keeps the accessible name when the label is visually hidden', () => {
    render(<Select label="Role" labelHidden options={ROLES} placeholder="Choose" />);
    expect(screen.getByRole('combobox', { name: 'Role' })).toBeInTheDocument();
  });
});
