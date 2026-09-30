'use client';

import type { ReactNode } from 'react';
import { DateField } from '../form/date-field';
import { Select, type SelectOption } from '../form/select';
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
 *
 * **Which years may be chosen.** The fiscal year is chosen from a list rather than typed (project
 * owner, 30 Sep 2026: a text field did not say it wanted a year, and a typed *"2025/2026"* reached the
 * api as no number at all). Which years are offered, and which are already taken, are the screen's
 * facts — its clock and its entity's periods — so they arrive as options, each carrying its own words.
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

/**
 * The id each of the four controls carries — exported so a form's error summary (UX-111) links to the field it names
 * with the ids this component actually renders, rather than restating its naming and drifting from it.
 */
export const reportingPeriodFieldIds = (
  idPrefix = 'reporting-period',
): Readonly<Record<keyof ReportingPeriodValue, string>> => ({
  fiscalYear: `${idPrefix}-fiscal-year`,
  start: `${idPrefix}-start`,
  end: `${idPrefix}-end`,
  due: `${idPrefix}-due`,
});

export interface ReportingPeriodPickerProps {
  readonly value: ReportingPeriodValue;
  readonly onChange: (next: ReportingPeriodValue) => void;
  /**
   * The years the fiscal year may take, in the order to offer them. A year already taken comes
   * `disabled`, with `description` saying why; the value on screen must be among them.
   */
  readonly fiscalYears: readonly SelectOption[];
  /** Shown until something is chosen — never a restatement of the label (UX-110). */
  readonly placeholders?: { readonly fiscalYear?: ReactNode };
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
  fiscalYears,
  placeholders,
  labels,
  help,
  errors,
  rangeMessage,
  disabled,
  idPrefix,
}: ReportingPeriodPickerProps) {
  const ids = reportingPeriodFieldIds(idPrefix);
  const ordered = periodRangeIsOrdered(value);
  const set = (patch: Partial<ReportingPeriodValue>) => onChange({ ...value, ...patch });

  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <Select
        id={ids.fiscalYear}
        label={labels.fiscalYear}
        help={help?.fiscalYear}
        error={errors?.fiscalYear}
        options={fiscalYears}
        placeholder={placeholders?.fiscalYear}
        value={value.fiscalYear}
        onValueChange={(fiscalYear) => set({ fiscalYear })}
        disabled={disabled}
      />
      <div className={styles.range}>
        <DateField
          id={ids.start}
          label={labels.start}
          help={help?.start}
          error={errors?.start}
          value={value.start}
          onChange={(event) => set({ start: event.target.value })}
        />
        <DateField
          id={ids.end}
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
        id={ids.due}
        label={labels.due}
        help={help?.due}
        error={errors?.due}
        value={value.due}
        onChange={(event) => set({ due: event.target.value })}
      />
    </fieldset>
  );
}
