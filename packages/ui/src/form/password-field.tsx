'use client';

import { useState } from 'react';
import { TextField, type TextFieldProps } from './text-field';
import styles from './password-field.module.css';

/**
 * Password input — the Text control with the reveal toggle the Identity prototype shows.
 *
 * UX-108 (Accessible Authentication) is the governing rule and it is why this component
 * exists at all: paste and password-manager autofill must work, so the input is a real
 * `<input type="password">` with the caller's `autoComplete` value (`new-password` on S-01,
 * `current-password` on sign-in) and nothing intercepts input events.
 *
 * The toggle's labels arrive as props — this package owns no text. The toggle is a plain
 * button, not inside the tab order's way: it sits after the input, and revealing is stateful
 * per instance, never persisted.
 */
export interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'trailing'> {
  /** Localized label for the reveal action while the password is hidden ("Show"). */
  revealLabel: string;
  /** Localized label while the password is visible ("Hide"). */
  concealLabel: string;
}

export function PasswordField({ revealLabel, concealLabel, ...field }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...field}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? concealLabel : revealLabel}
        </button>
      }
    />
  );
}
