'use client';

import { useId } from 'react';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import styles from './code-field.module.css';

/**
 * One-time code input — a **§11.5 inventory addition** (UX-89), drawn by the A-01 artboard as six
 * cells and consumed by both realms: the admin factor step (task 23, retrofitted here) and the
 * tenant challenge S-01 builds at 27.8. A one-off in either screen is the defect UX-89 names.
 *
 * ## It is ONE input, painted to look like several
 *
 * This is the whole design, and it is UX-108 rather than a preference. WCAG 2.2's Accessible
 * Authentication requires that **paste and password managers work everywhere**, and the platform's
 * own autofill — the code an authenticator sheet offers on iOS and Android, and what Chrome fills
 * from an SMS or an authenticator — targets a single field carrying `autocomplete="one-time-code"`.
 * Six `<input>` elements, which is how this component is usually built, break every one of those:
 * autofill has no single target, a paste lands in one cell, and a screen reader announces six
 * unlabelled fields where there is one question. `factor-step.tsx` already recorded that reasoning
 * when it shipped a plain field meanwhile — this keeps the property and adds the cells.
 *
 * So: a real `<input>` spans the whole control, and the cells beneath it are `aria-hidden`
 * presentation painted from the value. Selection, paste, undo, autofill, dictation and every
 * keyboard convention are the platform's, untouched. There is no focus-management code in this
 * file at all, which is the second thing the single-input form buys: the per-cell focus dance is
 * where the usual implementation's bugs live.
 *
 * ## States (§8.1 subset, UX-90 — all applicable states designed before the first instance)
 *
 * Applicable here: **rest** (`--field-border-rest`, so it looks enterable — §11.5), **focus** (the
 * ring is on the control, and the *next* empty cell is marked so the reader can see where typing
 * lands), **filled**, **invalid**, **disabled**. Deliberately not applicable: the empty, loading,
 * partial, offline, pending and success states describe a *region* that fetches, and this is a
 * control that does not. `Button`'s `busy` carries the submit that follows.
 *
 * The countdown the artboard draws beside the label ("valid for 21 s") is **`hint`, a slot** — the
 * two consumers time different things (a 30-second TOTP step; task 27.3's five-minute challenge),
 * so a timer inside this component would tick for a window it cannot know, and every consumer
 * would inherit a per-second re-render of a shared control.
 */
/**
 * The omitted keys are the attributes this control **fixes** and a caller may not set.
 *
 * `autoComplete`, `inputMode`, `autoCorrect` and `spellCheck` are what UX-108 actually turns on —
 * the platform's one-time-code autofill, the numeric keypad, and the two corrections that fight a
 * transcribed code — so switching one off would defeat the reason this component exists rather than
 * customise it. They were already written *after* the prop spread below, which silently discarded a
 * caller's value; omitting them here is what makes that a compile error instead (27 Aug 2026), the
 * way `id`, `value` and `type` already are. A control that needs a different keypad is a different
 * control, not this one with a flag — the recovery-code field is the live example, and it is a
 * `TextField`.
 *
 * Written inline rather than as a named alias: an `Omit` key union selects property names and is
 * exempt from the closed-vocabulary rule (root CLAUDE.md), and extracting it moves it out of the
 * exempted shape — which the lint rule catches, correctly.
 */
export interface CodeFieldProps
  extends Omit<
    ComponentPropsWithRef<'input'>,
    'id' | 'value' | 'type' | 'autoComplete' | 'inputMode' | 'autoCorrect' | 'spellCheck'
  > {
  label: ReactNode;
  /**
   * Painted into the cells, so the control is **always** controlled. An uncontrolled variant
   * would have to mirror the DOM value into state to render, which is the second source of truth
   * a form binding exists to remove.
   */
  value: string;
  /** How many cells. Six for TOTP (RFC 6238); a caller with another length says so. */
  length?: number;
  /** Visible by default, one to two sentences (UX-17). */
  help?: ReactNode;
  /** Three-part, localized, from the caller. Renders the invalid state when present. */
  error?: ReactNode;
  /** Beside the label, right-aligned — the artboard's code-window countdown goes here. */
  hint?: ReactNode;
  /** Stable id; also the anchor a FormErrorSummary link targets. Auto-generated if omitted. */
  id?: string;
}

const DEFAULT_LENGTH = 6;

export function CodeField({
  label,
  value,
  length = DEFAULT_LENGTH,
  help,
  error,
  hint,
  id,
  className,
  disabled,
  'aria-describedby': describedBy,
  ...input
}: CodeFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;

  const description =
    [error ? errorId : null, help ? helpId : null, describedBy ?? null]
      .filter(Boolean)
      .join(' ') || undefined;

  const characters = [...value].slice(0, length);

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <span className={styles.labelRow}>
        <label className={styles.label} htmlFor={fieldId}>
          {label}
        </label>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </span>

      <span
        className={[styles.control, error ? styles.invalid : '', disabled ? styles.disabled : '']
          .filter(Boolean)
          .join(' ')}
      >
        {/*
          Presentation only. `aria-hidden` because the input above already carries the label, the
          value and the invalid state — announcing six boxes as well would read the answer back
          one character at a time, which is worse than useless while typing a code.
        */}
        <span className={styles.cells} aria-hidden="true">
          {Array.from({ length }, (_, index) => (
            <span
              key={index}
              className={[
                styles.cell,
                // The next empty cell, marked so a sighted reader can see where typing lands —
                // the affordance six real inputs get from the caret and this one must draw.
                index === characters.length ? styles.next : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {characters[index] ?? ''}
            </span>
          ))}
        </span>

        <input
          {...input}
          id={fieldId}
          type="text"
          value={value}
          disabled={disabled}
          maxLength={length}
          className={styles.input}
          // The three attributes UX-108 actually turns on. `one-time-code` is what surfaces the
          // authenticator sheet's own suggestion; `numeric` is the keypad without `type="number"`,
          // whose spinner, scroll-to-change and locale-dependent parsing are all wrong for a code.
          autoComplete="one-time-code"
          inputMode="numeric"
          // Never `off`: a code is transcribed under time pressure and the browser's own
          // correction of it is noise, but the correction machinery is not what autofill uses.
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={description}
        />
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
