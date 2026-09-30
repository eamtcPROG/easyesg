import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ReportingPeriodPicker,
  periodRangeIsOrdered,
  reportingPeriodFieldIds,
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

/** The screen's years, newest first — one of them taken, as S-14 offers them. */
const YEARS = [
  { value: '2027', label: '2027' },
  { value: '2026', label: '2026' },
  { value: '2025', label: '2025', disabled: true, description: 'A period is already open for this year.' },
];

/** jsdom implements neither, and Radix Select calls both while opening — `form-select.spec.tsx`'s stubs. */
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const renderPicker = (
  value: Partial<ReportingPeriodValue> = {},
  onChange = vi.fn(),
  disabled = false,
) => {
  render(
    <ReportingPeriodPicker
      value={{ ...EMPTY, ...value }}
      onChange={onChange}
      fiscalYears={YEARS}
      placeholders={{ fiscalYear: 'Choose the year' }}
      labels={LABELS}
      rangeMessage="The period ends before it starts."
      disabled={disabled}
    />,
  );
  return onChange;
};

describe('reportingPeriodFieldIds', () => {
  /** A summary link reaches a field only if the id it targets is the one rendered — so the picker renders these. */
  it('names the ids the four controls actually carry', () => {
    renderPicker();
    const ids = reportingPeriodFieldIds();

    expect(screen.getByRole('combobox', { name: 'Fiscal year' })).toHaveAttribute('id', ids.fiscalYear);
    expect(screen.getByLabelText('Period start')).toHaveAttribute('id', ids.start);
    expect(screen.getByLabelText('Period end')).toHaveAttribute('id', ids.end);
    expect(screen.getByLabelText('Due date')).toHaveAttribute('id', ids.due);
  });
});

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
    const onChange = renderPicker({ start: '2026-01-01' });

    await userEvent.click(screen.getByRole('combobox', { name: 'Fiscal year' }));
    await userEvent.click(await screen.findByRole('option', { name: '2027' }));

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY, fiscalYear: '2027', start: '2026-01-01' });
  });

  /**
   * 30 Sep 2026 (project owner): the fiscal year is chosen, not typed, so it cannot be anything but
   * a year — and nothing is chosen until the reader chooses, since a wrong year is the expensive,
   * invisible mistake this component exists for.
   */
  it('offers the screen’s years with nothing chosen, and a taken year cannot be chosen', async () => {
    const onChange = renderPicker();

    const trigger = screen.getByRole('combobox', { name: 'Fiscal year' });
    expect(trigger).toHaveTextContent('Choose the year');
    await userEvent.click(trigger);
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      '2027',
      '2026',
      expect.stringContaining('2025'),
    ]);

    const taken = screen.getByRole('option', { name: /2025/ });
    expect(taken).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(taken);
    expect(onChange).not.toHaveBeenCalled();
  });

  /**
   * FR-22's lock reaches every control at once, through the fieldset rather than four `disabled`
   * props a screen could half-apply. A locked period that still offered one editable date would be
   * the read-only state failing exactly where it matters.
   */
  it('is read-only as a whole when the period is locked', () => {
    renderPicker({ start: '2026-01-01', end: '2026-12-31' }, vi.fn(), true);

    // The year is a combobox now, so it is found by role; the dates are still labelled inputs.
    expect(screen.getByRole('combobox', { name: 'Fiscal year' })).toBeDisabled();
    for (const label of [LABELS.start, LABELS.end, LABELS.due]) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
  });
});
