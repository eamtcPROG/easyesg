'use client';

import type { ReactNode } from 'react';
import { DateField } from '../form/date-field';
import { TextField } from '../form/text-field';
import styles from './reporting-period-picker.module.css';

/**
 * Reporting-period picker — §11.5's fourth recorded addition to the inventory, and the reason it is
 * recorded is this screen:
 *
 * > **The reporting-period picker is its own component**, separate from the date picker: reporting
 * > periods are the one place where a wrong date is expensive and invisible.
 *
 * *Invisible* is the operative word. A mistyped period boundary does not look wrong — it looks like
 * a period — and FR-125 makes a filing against the wrong fiscal year uncorrectable by editing. So
 * the four values are one control rather than four, and **the relationship between them is the
 * component's own rule** rather than something each screen remembers to check.
 *
 * States (§8.1): rest · focus · filled · **invalid**, both per field and for the range · read-only
 * (a locked period, FR-22) · disabled. No loading, empty or offline state of its own — it edits
 * values a screen has already loaded, and that screen owns those.
 *
 * ## What it does not own
 *
 * **The timezone.** Every legal date this product files is `{ date, timezone }` (NFR-34), and the
 * zone is resolved once by the consuming app — `DateField`'s header explains why `packages/ui` may
 * not read an ambient fact. This control emits ISO date halves.
 *
 * **The words.** Every label, help string and message arrives localized from the caller, as
 * everywhere in this package.
 */

/** The four values as one thing, which is the point of the component. ISO date halves. */
export interface ReportingPeriodValue {
  /** Stated rather than derived from the dates: FR-21 names it beside them, because a fiscal year
   *  straddling two calendar years is labelled by the undertaking, not by arithmetic. */
  readonly fiscalYear: string;
  readonly start: string;
  readonly end: string;
  /** FR-21's optional due date — a different fact from the period end, and what deadline notices
   *  count down to. Empty string for "none", which is what an empty date input reads back. */
  readonly due: string;
}

/**
 * The range rule, exported so a form validates on submit with **the same predicate** the control
 * shows inline. Two copies is how a screen comes to refuse what the control accepted.
 *
 * String comparison, and correct rather than lucky: an ISO calendar date sorts chronologically as
 * text. A partially-filled range is not *invalid* — it is unfinished, which is the required rule's
 * business and not this one's.
 */
export const periodRangeIsOrdered = (value: {
  readonly start: string;
  readonly end: string;
}): boolean => !value.start || !value.end || value.end >= value.start;

export interface ReportingPeriodPickerProps {
  readonly value: ReportingPeriodValue;
  readonly onChange: (next: ReportingPeriodValue) => void;
  readonly labels: {
    readonly fiscalYear: ReactNode;
    readonly start: ReactNode;
    readonly end: ReactNode;
    readonly due: ReactNode;
  };
  readonly help?: {
    readonly fiscalYear?: ReactNode;
    readonly start?: ReactNode;
    readonly end?: ReactNode;
    readonly due?: ReactNode;
  };
  /** Per-field messages the caller's own validation produced. Three-part and localized (NFR-79). */
  readonly errors?: Partial<Record<keyof ReportingPeriodValue, ReactNode>>;
  /**
   * The message shown when the end precedes the start. **The caller owns the words and this
   * component owns the moment** — which is what stops the rule being restated per screen.
   */
  readonly rangeMessage: ReactNode;
  /** A locked period is read-only for everyone, the administrator included (FR-22). */
  readonly disabled?: boolean;
  readonly idPrefix?: string;
}

export function ReportingPeriodPicker({
  value,
  onChange,
  labels,
  help,
  errors,
  rangeMessage,
  disabled,
  idPrefix = 'reporting-period',
}: ReportingPeriodPickerProps) {
  const ordered = periodRangeIsOrdered(value);
  const set = (patch: Partial<ReportingPeriodValue>) => onChange({ ...value, ...patch });

  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <TextField
        id={`${idPrefix}-fiscal-year`}
        label={labels.fiscalYear}
        help={help?.fiscalYear}
        error={errors?.fiscalYear}
        inputMode="numeric"
        value={value.fiscalYear}
        onChange={(event) => set({ fiscalYear: event.target.value })}
      />
      <div className={styles.range}>
        <DateField
          id={`${idPrefix}-start`}
          label={labels.start}
          help={help?.start}
          error={errors?.start}
          value={value.start}
          onChange={(event) => set({ start: event.target.value })}
        />
        <DateField
          id={`${idPrefix}-end`}
          label={labels.end}
          help={help?.end}
          // The range failure is shown on the END field, which is the one the reader most likely
          // mistyped and the one they can fix without re-reading the other. `min` gives the native
          // picker the same rule, so the invalid day is hard to reach before it is hard to keep.
          error={errors?.end ?? (ordered ? undefined : rangeMessage)}
          min={value.start || undefined}
          value={value.end}
          onChange={(event) => set({ end: event.target.value })}
        />
      </div>
      <DateField
        id={`${idPrefix}-due`}
        label={labels.due}
        help={help?.due}
        error={errors?.due}
        value={value.due}
        onChange={(event) => set({ due: event.target.value })}
      />
    </fieldset>
  );
}
