import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DisclosureField, FIELD_TONE } from './disclosure-field';

/**
 * The anatomy's rules, not its appearance.
 *
 * §6.2 is the source's only screen-level layout diagram, which makes this anatomy normative — so what
 * is worth pinning is the part a later edit could quietly drop: the always-present declaration, the
 * read-only rule, and the grouping that makes three controls read as one question.
 */
const base = {
  label: 'Total energy consumption',
  help: 'All energy the undertaking consumed in the reporting year.',
  notAvailable: <button type="button">Mark not available</button>,
  children: <input aria-label="Total energy consumption" />,
};

describe('DisclosureField (§6.2, §11.5)', () => {
  it('names the question once, and groups every control under it', () => {
    render(<DisclosureField {...base} unit={<span>MWh</span>} />);

    // Without the accessible group, a reporter tabbing forty fields hears the input, the unit and
    // the carry-forward control as three unattached stops per question.
    expect(screen.getByRole('group', { name: base.label })).toBeInTheDocument();
    expect(screen.getByText('MWh')).toBeInTheDocument();
  });

  it('always offers the not-available declaration (UX-15)', () => {
    render(<DisclosureField {...base} />);

    // "A first-class action, not an alternative discovered after failing to answer" — so it is here
    // with no value entered and with nothing wrong.
    expect(screen.getByRole('button', { name: 'Mark not available' })).toBeInTheDocument();
  });

  it('shows help without anything being opened (UX-17)', () => {
    render(<DisclosureField {...base} moreLabel="Why this is asked" more={<p>Standard reference.</p>} />);

    expect(screen.getByText(base.help)).toBeVisible();
    // The rationale sits behind progressive disclosure; the answer does not depend on opening it.
    expect(screen.getByText('Standard reference.')).not.toBeVisible();
  });

  it('removes the affordances in read-only and keeps the question (UX-13)', () => {
    render(
      <DisclosureField
        {...base}
        readOnly
        priorPeriod={<span>Prior period: 1 240 MWh</span>}
        carryForward={<button type="button">Carry forward</button>}
      />,
    );

    // Same layout, affordances gone — not a disabled control that reads as a field someone failed
    // to fill in.
    expect(screen.getByRole('group', { name: base.label })).toBeInTheDocument();
    expect(screen.getByText('Prior period: 1 240 MWh')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark not available' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carry forward' })).not.toBeInTheDocument();
  });

  it('carries the comparative and its carry-forward together (FR-46, FR-47)', () => {
    render(
      <DisclosureField
        {...base}
        priorPeriod={<span>Prior period: 1 240 MWh</span>}
        carryForward={<button type="button">Carry forward</button>}
      />,
    );

    expect(screen.getByText('Prior period: 1 240 MWh')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carry forward' })).toBeInTheDocument();
  });

  it('announces a verdict without interrupting, and carries its tone', () => {
    render(<DisclosureField {...base} message="Higher than last year." messageTone={FIELD_TONE.WARNING} />);

    // `status`, not `alert`: forty alerts on one step would make the step unusable.
    const message = screen.getByRole('status');
    expect(message).toHaveTextContent('Higher than last year.');
    expect(message).toHaveAttribute('data-tone', FIELD_TONE.WARNING);
  });
});
