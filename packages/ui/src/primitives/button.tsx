'use client';

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Spinner } from './spinner';
import styles from './button.module.css';

/**
 * Button — §11.5: four variants and there is no fifth (primary · secondary · subtle ·
 * destructive). 40px height, because everything a first-time user must hit is 40px
 * (WCAG 2.2 Target Size, NFR-75); the global two-layer focus ring applies via `:focus-visible`.
 *
 * States (§8.1, the applicable subset): rest · hover · active · focus · disabled · **busy**.
 * `busy` is the pending-async state for the button's own action: the label stays visible
 * beside a spinner — a bare spinner would discard the answer to "what is happening" — the
 * button stops accepting clicks, and `aria-busy` says so. It is distinct from `disabled`,
 * which means "not available", not "in progress".
 */
/**
 * The four variants, as an `as const` object with the union derived (CLAUDE.md, "Conventions").
 * Deriving changes no caller — `variant="primary"` still compiles — and it gives the set a
 * runtime value, which is what a specimen page needs to render every variant without a second
 * hand-written list going stale beside this one.
 */
export const BUTTON_VARIANT = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  SUBTLE: 'subtle',
  DESTRUCTIVE: 'destructive',
} as const;

export type ButtonVariant = (typeof BUTTON_VARIANT)[keyof typeof BUTTON_VARIANT];

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  /** Pending-async: label + spinner, non-interactive, `aria-busy`. */
  busy?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  busy = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={[styles.button, styles[variant], className].filter(Boolean).join(' ')}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}
