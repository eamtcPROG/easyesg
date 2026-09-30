'use client';

import { BUTTON_VARIANT, Button, type ButtonVariant } from '@easyesg/ui';
import { Popover } from 'radix-ui';
import { useId } from 'react';
import styles from './unavailable.module.css';

/**
 * An action S-07's bar draws before its screen exists — *Export* and *Review the report* (task 179.1; `design_spec.md`
 * S-07's amendment of 30 Sep 2026, the owner's choice over leaving them out until they ship).
 *
 * **Disabled in look, never in reach.** `aria-disabled` rather than `disabled`, so the button stays in the tab order
 * and a screen reader hears it as unavailable with the reason as its description; a press opens the reason beside it.
 * A `disabled` button would be skipped by the keyboard and say nothing — the states pass's rule that the product *never
 * disables something without saying why in the same breath*.
 *
 * **This app's, not the inventory's** (UX-89 as amended): only S-07 draws an action ahead of its screen, and each goes
 * the day its screen ships, replaced by the real control.
 */
export function PendingAction({
  label,
  reason,
  variant = BUTTON_VARIANT.SECONDARY,
}: {
  readonly label: string;
  /** Why it cannot be used yet, and what holds meanwhile. */
  readonly reason: string;
  readonly variant?: ButtonVariant;
}) {
  const reasonId = useId();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant={variant} className={styles.pending} aria-disabled="true" aria-describedby={reasonId}>
          {label}
        </Button>
      </Popover.Trigger>
      {/* The description a screen reader hears on reaching the button; `hidden` text is still read by reference. */}
      <span id={reasonId} hidden>
        {reason}
      </span>
      <Popover.Portal>
        <Popover.Content className={styles.note} align="end" sideOffset={6}>
          {reason}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
