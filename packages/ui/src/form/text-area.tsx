'use client';

import { useId } from 'react';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import fieldStyles from './text-field.module.css';
import styles from './text-area.module.css';

/**
 * Textarea — §11.5's *Textarea* form control, first implemented for S-07's narrative kinds
 * (task 35.2).
 *
 * **`TextField`'s anatomy over a `<textarea>`**: label · control · help · inline state message,
 * wired identically — help and error through `aria-describedby`, invalidity through `aria-invalid`,
 * a stable error id for UX-111's summary. The control is the only thing that differs, which is why
 * this shares `TextField`'s stylesheet for the parts it shares and carries its own only for the
 * control's box.
 *
 * **This is UX-19's narrative field, minus one deferred value** (task 36.2). It supports
 * *"paragraph structure only — no rich formatting"* by being a plain textarea, imposes no hard
 * limit, and takes a `count` for the length indication. What it does not carry is the *"soft target
 * derived from the reference corpus"*: **no reference corpus exists in this repository**, which
 * task 36.1 recorded and the project owner deferred on 3 Sep 2026 rather than let a plausible
 * number be invented — a number with no authority reads to a reporter as guidance from the standard.
 * `architecture.md` §12.5.6 states what is assumed meanwhile; when a corpus exists the target is one
 * more node in the same slot, not a different control.
 *
 * **The count is a node, not a number**, like every other string here: the words are the caller's,
 * and so is the decision to count characters or words. It is described, never announced — a live
 * region updating on every keystroke would talk over the typing it is counting.
 *
 * States (§8.1 subset): inherited from `TextField` — rest, focus, filled, invalid, disabled — plus
 * its own resize behaviour, which is vertical only so the reading measure (UX-74) holds.
 */
export interface TextAreaProps extends Omit<ComponentPropsWithRef<'textarea'>, 'id'> {
  label: ReactNode;
  /** Visible by default, one to two sentences (UX-17). */
  help?: ReactNode;
  /** Three-part, localized, from the caller. Renders the invalid state when present. */
  error?: ReactNode;
  /** Stable id; also the anchor a summary link targets. Auto-generated if omitted. */
  id?: string;
  /** Hides the label visually while keeping it for assistive technology — `TextField`'s rule. */
  labelHidden?: boolean;
  /**
   * UX-19's length indication — already worded and already counted by the caller.
   *
   * Described rather than announced (see the header), and rendered whether or not `help` is, since
   * a narrative field with help and no count would otherwise be indistinguishable from one whose
   * count the caller forgot.
   */
  count?: ReactNode;
}

export function TextArea({
  label,
  help,
  error,
  id,
  labelHidden = false,
  count,
  className,
  'aria-describedby': describedBy,
  rows = 4,
  ...input
}: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;
  const countId = `${fieldId}-count`;

  const description =
    [error ? errorId : null, help ? helpId : null, count ? countId : null, describedBy ?? null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className={[fieldStyles.field, className].filter(Boolean).join(' ')}>
      <label className={labelHidden ? fieldStyles.labelHidden : fieldStyles.label} htmlFor={fieldId}>
        {label}
      </label>
      <span
        className={[fieldStyles.control, styles.control, error ? fieldStyles.invalid : '']
          .filter(Boolean)
          .join(' ')}
      >
        <textarea
          {...input}
          id={fieldId}
          rows={rows}
          className={styles.textarea}
          aria-invalid={error ? true : undefined}
          aria-describedby={description}
        />
      </span>
      {help ? (
        <span id={helpId} className={fieldStyles.help}>
          {help}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className={fieldStyles.error}>
          {error}
        </span>
      ) : null}
      {count ? (
        <span id={countId} className={styles.count}>
          {count}
        </span>
      ) : null}
    </div>
  );
}
