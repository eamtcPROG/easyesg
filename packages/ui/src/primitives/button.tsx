import { Slot } from 'radix-ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import {
  BUTTON_TONE,
  BUTTON_VARIANT,
  type ButtonTone,
  type ButtonVariant,
} from './button-vocabulary';
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
 *
 * **And this module carries no `'use client'`, which the `asChild` seam makes load-bearing** (7 Sep
 * 2026). It had one from task 20 and never needed it — no hook, no browser API, no handler of its
 * own — but the directive is not inert here, because `Slot` does not *render* its child, it
 * **introspects** it: `React.Children.count`, `isValidElement`, then `cloneElement` with the merged
 * props. A `'use client'` module is a boundary, and children a Server Component writes for a
 * boundary cross it as a Flight reference — `$$typeof: Symbol(react.lazy)` — not as an element.
 * Radix unwraps one such layer (`use(children._payload)`, react-slot 1.3.3) and the payload here is
 * already *fulfilled*, so the guard fires and still does not yield a single element; Slot then
 * throws *"Slot failed to slot onto its children"* and takes the whole route down with a 500.
 *
 * Three things make that worth this paragraph rather than a one-line commit message:
 *
 * - **It presented as a screen bug and was a directive.** `S-13` and `S-06` died on their *"Add"*
 *   action while `apps/admin` and every client-side caller were fine, because a client → client
 *   `asChild` never crosses Flight and never sees a lazy.
 * - **It was intermittent**, which is worse than broken: the arm renders only when the tenant read
 *   answers READY, so a screen whose data call had failed served a clean error state and looked
 *   healthy.
 * - **`TextLink` was the control all along.** It carries the identical seam, has never had the
 *   directive, and has rendered from a Server Component since **task 22** — `set-password/page.tsx`,
 *   which is the first page to call it without one. The seam itself is task 20's, and dating the
 *   control to *there* would overstate it: every task-20 consumer was a Client Component, so the
 *   mechanism went unexercised on both primitives at once. That is the same latency twice, and it
 *   is why neither the bug nor its control showed up for a year of screens. The two are now
 *   consistent, and consistency is the property to preserve: a component that slots may not be a
 *   client boundary.
 *
 * The vocabulary split into `button-vocabulary.ts` (task 74.1) stays exactly as it is. It was made
 * for a different failure — a `'use client'` module's *exports* reaching a Server Component as
 * `undefined` — and it is now enforced by an ESLint selector; that a directive-free `Button` would
 * no longer need it is not a reason to fold it back in.
 */
interface ButtonCommon {
  variant?: ButtonVariant;
  /** The surface behind the button. `band` is the dark chrome band — see `BUTTON_TONE`. */
  tone?: ButtonTone;
  className?: string;
  children: ReactNode;
}

/**
 * A real `<button>`: everything an element of that kind accepts, plus the pending-async state.
 */
export type ButtonElementProps = ButtonCommon &
  Omit<ComponentPropsWithRef<'button'>, 'className' | 'children'> & {
    /** Present and false is the same as absent — see the discriminator in `Button`. */
    asChild?: false;
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
  const classes = [
    styles.button,
    styles[props.variant ?? BUTTON_VARIANT.PRIMARY],
    // Additive rather than replacing the variant class: the band pairing overrides colour and
    // nothing else, so geometry, type and the focus ring stay the variant's own.
    props.tone === BUTTON_TONE.BAND ? styles.band : undefined,
    props.className,
  ]
    .filter(Boolean)
    .join(' ');

  // **On the VALUE, never on `'asChild' in props`.** The key-presence form was written first, to
  // dodge a lint rule that has since been configured out of the way, and it was wrong twice over:
  // `asChild={false}` and a spread carrying `asChild: undefined` both took the Slot branch, where
  // Radix's `React.Children.only` throws on a string child and takes the screen with it. A union
  // discriminated by value cannot be entered by a key that happens to exist.
  if (props.asChild === true) {
    return <Slot.Root className={classes}>{props.children}</Slot.Root>;
  }

  // `asChild` and `busy` are this component's own vocabulary and must not reach the DOM — React
  // forwards unknown attributes to `<button>` and warns on every render. Omitting them by
  // destructure is what `ignoreRestSiblings` exists for (eslint.config.mjs).
  const {
    variant,
    tone,
    className,
    children,
    asChild,
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
      className={classes}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}
