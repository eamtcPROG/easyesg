'use client';

import { useId } from 'react';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import styles from './checkbox.module.css';

/**
 * Checkbox — §11.5's Form controls row, built at its first consumer (S-01's *Keep me signed in on
 * this device*, task 97 / OQ-35).
 *
 * **An inventory entry that already existed in the specification and not in code**, which makes
 * this UX-89 step 1 rather than step 2: §11.5 enumerates *Checkbox* between Radio group and
 * Switch, so what is decided here is the anatomy, not whether the component belongs.
 *
 * **A real `<input type="checkbox">`, not a painted `<span>`.** The platform control carries the
 * space-key binding, the indeterminate state, form participation, `:focus-visible`, forced-colours
 * mode and every assistive technology's checkbox semantics; a div with `role="checkbox"` carries
 * whichever of those someone remembered. It is styled with `appearance: none` and drawn from
 * `currentColor`, so nothing is reimplemented — which is `CodeField`'s lesson (UX-108) applied to
 * the control where it is cheapest to get right.
 *
 * **The label wraps the input.** An implicit label needs no id agreement to work, so the control is
 * still labelled if a caller forgets `id` — and the whole row becomes the hit target, which is what
 * gets it past NFR-75's 24×24 minimum without a padded box around a 16px square.
 *
 * States (§8.1, the applicable subset — the others have no instance on a checkbox): **rest ·
 * hover · focus · checked · disabled · invalid**. There is no loading, empty, partial, pending or
 * offline state: a checkbox is a value, and whatever is fetching around it owns those. `help` and
 * `error` are wired through `aria-describedby` exactly as `TextField` wires them, and the error
 * element carries a stable id so UX-111's summary can link to it.
 *
 * Like every control here it renders text and owns none: the label, the help and the three-part
 * error (NFR-79) arrive localized from the caller.
 */
export interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'id' | 'type'> {
  label: ReactNode;
  /** Visible by default, one to two sentences (UX-17). */
  help?: ReactNode;
  /** Three-part, localized, from the caller. Renders the invalid state when present. */
  error?: ReactNode;
  /** Stable id; also the anchor a FormErrorSummary link targets. Auto-generated if omitted. */
  id?: string;
}

export function Checkbox({
  label,
  help,
  error,
  id,
  className,
  'aria-describedby': describedBy,
  ...input
}: CheckboxProps) {
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
      <label className={styles.row} htmlFor={fieldId}>
        <input
          {...input}
          id={fieldId}
          type="checkbox"
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={description}
        />
        <span className={styles.label}>{label}</span>
      </label>
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
