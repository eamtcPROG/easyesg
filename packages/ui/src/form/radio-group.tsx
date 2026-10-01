'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';
import styles from './radio-group.module.css';

/**
 * Radio group — §11.5's Form controls row, built at its first consumer (task 179.2): S-07's short choices.
 *
 * **Drawn as `EasyESG Reporting Core.dc.html`'s option cards**, not as the Components sheet's bare list — the owner's
 * choice after a mockup of both (1 Oct 2026). Each answer is a card holding its radio and its words; the chosen one
 * stands on the accent's tint with the accent's edge. One look rather than a variant per screen: a second look is a
 * prop, and a prop added for one screen is the smell UX-89 names.
 *
 * **Real `<input type="radio">`s under one name**, inside an element whose role is `radiogroup`. The platform then
 * carries everything a painted card would have to reimplement — one tab stop for the group, the arrow keys moving the
 * choice, Space choosing the focused answer, forced-colours mode, and every screen reader's *"2 of 2, selected"* —
 * which is `Checkbox`'s argument, made where it matters more: a group has a keyboard contract a single box does not.
 * The radio is `appearance: none` and drawn from tokens, so nothing about its behaviour is reimplemented.
 *
 * **The card is the label**, so the whole card is the hit target and the answer's words are the radio's name without
 * an id agreement between them.
 *
 * **Controlled or not, like `Select`**: `value` with `onValueChange`, or `defaultValue` for a form that submits it.
 * There is no way back to *nothing chosen* — a radio group has none — so a caller whose answer may be withdrawn offers
 * that as its own act.
 *
 * States (§8.1, the applicable subset): **rest · hover · focus · checked · disabled · invalid**. A read-only screen
 * draws the answer as text rather than a disabled group (UX-13), and that is the caller's: this control cannot know
 * which words a reader should see in its place. `help` and `error` are wired through `aria-describedby` as `Select`
 * wires them, and the error carries a stable id for UX-111's summary.
 *
 * Like every control here it renders text and owns none.
 */
export interface RadioOption {
  readonly value: string;
  /** One line, localized by the caller — the card's words and the radio's name. */
  readonly label: ReactNode;
  /** A second line under the label, where the caller has one: what choosing this means. */
  readonly description?: ReactNode;
  readonly disabled?: boolean;
}

/**
 * How the group is named — **one of two, never neither** (UX-110). Its own `label`, shown above the cards or kept for
 * assistive technology with `labelHidden`; or `labelledBy`, the id of a visible label the caller already draws — the
 * disclosure field's question — so the words a reader sees are the group's name, said once.
 */
type RadioGroupNaming =
  | { label: ReactNode; labelHidden?: boolean; labelledBy?: never }
  | { labelledBy: string; label?: never; labelHidden?: never };

export type RadioGroupProps = RadioGroupNaming & {
  options: readonly RadioOption[];
  /** Uncontrolled — the initial choice, and what a `<form>` submits untouched. */
  defaultValue?: string;
  /** Controlled. Supply `onValueChange` with it. `undefined` is *nothing chosen yet*. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** The radios' shared name. Auto-generated if omitted, which is what makes two groups on one screen independent. */
  name?: string;
  /** Visible by default, one to two sentences (UX-17). */
  help?: ReactNode;
  /** Three-part, localized, from the caller. Renders the invalid state when present. */
  error?: ReactNode;
  /** Stable id of the group; also the anchor a FormErrorSummary link targets. Auto-generated if omitted. */
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

export function RadioGroup({
  label,
  options,
  defaultValue,
  value,
  onValueChange,
  name,
  help,
  error,
  id,
  labelHidden = false,
  labelledBy,
  disabled,
  required,
  className,
}: RadioGroupProps) {
  const autoId = useId();
  const groupId = id ?? autoId;
  const labelId = `${groupId}-label`;
  const helpId = `${groupId}-help`;
  const errorId = `${groupId}-error`;
  const groupName = name ?? groupId;

  const description =
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {labelledBy === undefined ? (
        <span id={labelId} className={labelHidden ? styles.labelHidden : `t-label ${styles.label}`}>
          {label}
        </span>
      ) : null}

      <div
        id={groupId}
        role="radiogroup"
        className={styles.options}
        aria-labelledby={labelledBy ?? labelId}
        aria-describedby={description}
        aria-invalid={error ? true : undefined}
        aria-required={required ? true : undefined}
        aria-disabled={disabled ? true : undefined}
      >
        {options.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              className={styles.radio}
              name={groupName}
              value={option.value}
              // Controlled when the caller holds the value — `undefined` then means *nothing chosen*, so no radio is
              // checked — and uncontrolled otherwise, from `defaultValue`.
              {...(value === undefined && onValueChange === undefined
                ? { defaultChecked: option.value === defaultValue }
                : { checked: option.value === value })}
              onChange={() => onValueChange?.(option.value)}
              disabled={disabled === true || option.disabled === true}
              required={required}
            />
            <span className={styles.words}>
              <span className={styles.optionLabel}>{option.label}</span>
              {option.description ? <span className={styles.description}>{option.description}</span> : null}
            </span>
          </label>
        ))}
      </div>

      {help ? (
        <span id={helpId} className={styles.help}>
          {help}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className={styles.error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
