'use client';

import { useId } from 'react';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import styles from './text-field.module.css';

/**
 * Text input — §11.5 form control, §7.1's anatomy reduced to the parts an identity field has:
 * label · input · help text · inline state message. (The disclosure field of §6.2 adds unit,
 * comparative and reason capture on top of this anatomy; it is its own component, Phase 4.)
 *
 * States (§8.1 subset): rest — on `--field-border-rest`, i.e. `border-strong`, because a field
 * must look enterable (§11.5) — focus · filled · **invalid** · disabled.
 *
 * Accessibility is structural, not decorative: help and error are wired through
 * `aria-describedby`, invalidity through `aria-invalid`, and the error element carries a stable
 * id so a form-level summary (UX-111) can deep-link to the field. UX-108 binds on every
 * instance: nothing here blocks paste or a password manager, and nothing may.
 *
 * The error text arrives from the caller already in NFR-79's three-part shape and already
 * localized — this package renders text and never owns any.
 */
export interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'id'> {
  label: ReactNode;
  /** Visible by default, one to two sentences (UX-17). */
  help?: ReactNode;
  /** Three-part, localized, from the caller. Renders the invalid state when present. */
  error?: ReactNode;
  /** Stable id; also the anchor a FormErrorSummary link targets. Auto-generated if omitted. */
  id?: string;
  /** Rendered inside the field's border, after the input — the password reveal lives here. */
  trailing?: ReactNode;
}

export function TextField({
  label,
  help,
  error,
  id,
  trailing,
  className,
  'aria-describedby': describedBy,
  ...input
}: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;

  const description =
    [error ? errorId : null, help ? helpId : null, describedBy ?? null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <span className={[styles.control, error ? styles.invalid : ''].filter(Boolean).join(' ')}>
        <input
          {...input}
          id={fieldId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={description}
        />
        {trailing}
      </span>
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
