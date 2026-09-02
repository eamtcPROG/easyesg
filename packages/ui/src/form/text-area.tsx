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
 * **This is not the narrative disclosure control UX-19 describes.** That one carries a length
 * indication and *"a soft target derived from the reference corpus"*, and no reference corpus exists
 * in this repository — task 36.1 recorded the gap and named task 36.2 as where it is met. What this
 * is: a multi-line text input that keeps paragraph breaks, which a single-line field silently
 * flattens. It supports *"paragraph structure only — no rich formatting"* by being a plain textarea.
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
}

export function TextArea({
  label,
  help,
  error,
  id,
  labelHidden = false,
  className,
  'aria-describedby': describedBy,
  rows = 4,
  ...input
}: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;

  const description =
    [error ? errorId : null, help ? helpId : null, describedBy ?? null]
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
    </div>
  );
}
