'use client';

import { Slot } from 'radix-ui';
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
 *
 * **`asChild` (Radix Slot), added 25 Aug 2026 for S-03 (task 26.3).** The same seam `TextLink` and
 * `ProviderButton` already carry, and added for the same reason: a screen's **primary action** is
 * sometimes a navigation, and `apps/web` must navigate through `@/i18n/navigation`'s locale-aware
 * `Link` — a raw `next/link` drops the locale prefix — which this package cannot import. S-03's
 * signed-out arm hands off to S-01, so its one primary action is a route; without this the screen
 * would either inline a bespoke anchor (the defect UX-89 names) or demote its primary action to a
 * text link, which the Focus archetype's "one primary action" does not survive.
 *
 * A UX-89 addition to an existing inventory entry rather than a new component: no new anatomy, no
 * new state set — the eleven §8.1 states are unchanged, since an anchor has rest, hover, active and
 * focus and cannot be disabled or busy. **That is enforced rather than documented:** the props are
 * a union, so `asChild` and `busy` cannot both be passed.
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

interface ButtonCommon {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}

/**
 * A real `<button>`: everything an element of that kind accepts, plus the pending-async state.
 */
/**
 * A real `<button>`: everything an element of that kind accepts, plus the pending-async state.
 *
 * It carries **no `asChild` key at all**, which is what makes the union discriminate by presence —
 * `'asChild' in props`. Declaring it as `asChild?: false` would put a prop in this shape that the
 * element branch must then destructure and discard, and a discarded destructure is the one thing
 * the lint config has no ignore pattern for.
 */
export type ButtonElementProps = ButtonCommon &
  Omit<ComponentPropsWithRef<'button'>, 'className' | 'children'> & {
    /** Pending-async: label + spinner, non-interactive, `aria-busy`. */
    busy?: boolean;
  };

/**
 * The caller's own element, styled as a button — an anchor, in practice.
 *
 * Deliberately narrow: no `busy`, no `disabled`, no `type`, because none of them means anything on
 * a link and `disabled` in particular would render an attribute browsers ignore while the control
 * stayed clickable. The caller's element carries its own href and handlers.
 */
export type ButtonSlotProps = ButtonCommon & { asChild: true };

export type ButtonProps = ButtonElementProps | ButtonSlotProps;

export function Button(props: ButtonProps) {
  const classes = (variant: ButtonVariant, className: string | undefined) =>
    [styles.button, styles[variant], className].filter(Boolean).join(' ');

  if ('asChild' in props) {
    const { variant = 'primary', className, children } = props;
    return <Slot.Root className={classes(variant, className)}>{children}</Slot.Root>;
  }

  const {
    variant = 'primary',
    className,
    children,
    busy = false,
    disabled,
    type = 'button',
    ...rest
  } = props;

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={classes(variant, className)}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}
