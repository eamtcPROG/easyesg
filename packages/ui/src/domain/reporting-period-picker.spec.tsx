import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ReportingPeriodPicker,
  periodRangeIsOrdered,
  type ReportingPeriodValue,
} from './reporting-period-picker';

/**
 * The picker's contract (task 32.1.1). §11.5 makes this its own component because *"reporting
 * periods are the one place where a wrong date is expensive and invisible"* — so the tests are
 * about the relationship between the values, which is the part three separate date fields lose.
 */
const LABELS = {
  fiscalYear: 'Fiscal year',
  start: 'Period start',
  end: 'Period end',
  due: 'Due date',
};

const EMPTY: ReportingPeriodValue = { fiscalYear: '', start: '', end: '', due: '' };

const renderPicker = (
  value: Partial<ReportingPeriodValue> = {},
  onChange = vi.fn(),
  disabled = false,
) => {
  render(
    <ReportingPeriodPicker
      value={{ ...EMPTY, ...value }}
      onChange={onChange}
      labels={LABELS}
      rangeMessage="The period ends before it starts."
      disabled={disabled}
    />,
  );
  return onChange;
};

describe('periodRangeIsOrdered', () => {
  it('accepts an ordered range and refuses a reversed one', () => {
    expect(periodRangeIsOrdered({ start: '2026-01-01', end: '2026-12-31' })).toBe(true);
    expect(periodRangeIsOrdered({ start: '2026-12-31', end: '2026-01-01' })).toBe(false);
  });

  it('accepts the same day, because a one-day period is a period', () => {
    expect(periodRangeIsOrdered({ start: '2026-01-01', end: '2026-01-01' })).toBe(true);
  });

  /**
   * A half-filled range is **unfinished, not invalid** — the difference matters because showing
   * "ends before it starts" while the reader is still typing the first date is a refusal of
   * something they have not done yet. Requiredness is a different rule with a different owner.
   */
  it('says nothing about a range that is not filled in yet', () => {
    expect(periodRangeIsOrdered({ start: '2026-01-01', end: '' })).toBe(true);
    expect(periodRangeIsOrdered({ start: '', end: '2026-12-31' })).toBe(true);
  });
});

describe('ReportingPeriodPicker', () => {
  it('shows the range failure on the end field, where it can be fixed', () => {
    renderPicker({ start: '2026-12-31', end: '2026-01-01' });

    const end = screen.getByLabelText('Period end');
    expect(end).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('The period ends before it starts.')).toBeInTheDocument();
    // And not on the start field, which the reader would have to re-read to act on.
    expect(screen.getByLabelText('Period start')).not.toHaveAttribute('aria-invalid');
  });

  it('says nothing while the range is still being filled in', () => {
    renderPicker({ start: '2026-01-01' });

    expect(screen.queryByText('The period ends before it starts.')).not.toBeInTheDocument();
  });

  /**
   * The native picker gets the same rule the message states. Without it the two disagree: the
   * control would offer a day the component then refuses, which is the shape that teaches a reader
   * the form is broken rather than that the date is.
   */
  it('gives the end picker the start as its floor', () => {
    renderPicker({ start: '2026-01-01' });

    expect(screen.getByLabelText('Period end')).toHaveAttribute('min', '2026-01-01');
  });

  it('reports the whole value when one field changes, so the four stay one thing', async () => {
    const onChange = renderPicker({ fiscalYear: '2026', start: '2026-01-01' });

    await userEvent.type(screen.getByLabelText('Fiscal year'), '7');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fiscalYear: '20267', start: '2026-01-01' }),
    );
  });

  /**
   * FR-22's lock reaches every control at once, through the fieldset rather than four `disabled`
   * props a screen could half-apply. A locked period that still offered one editable date would be
   * the read-only state failing exactly where it matters.
   */
  it('is read-only as a whole when the period is locked', () => {
    renderPicker({ start: '2026-01-01', end: '2026-12-31' }, vi.fn(), true);

    for (const label of Object.values(LABELS)) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
  });
});
