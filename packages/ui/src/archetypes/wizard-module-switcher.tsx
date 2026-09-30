'use client';

import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { Anchor, type NavLinkComponent } from '../navigation/nav-link';
import { ARIA_CURRENT } from '../navigation/nav-link-vocabulary';
import { WizardStepMark } from './wizard-step-mark';
import { stripWindow } from './wizard-strip-window';
import type { WizardStepState } from './wizard-step-vocabulary';
import styles from './wizard-module-switcher.module.css';

/**
 * The Wizard step list below `wide` — the *S-07/S-08 narrow* frame (task 179.1): at `medium` a strip of the steps'
 * references, each with its mark, and a *+n* for the rest; at `compact` a stepper naming the current step and its
 * position, with *All modules*. Both open the whole list as a drawer.
 *
 * **`'use client'` for the drawer's open state**, and so it takes the strip's steps as data and builds their anchors
 * itself — `chrome-drawer.tsx`'s reason: a caller's node wrapped in a Radix part's `asChild` arrives from a Server
 * Component as a Flight reference. The drawer's list is the caller's node, **rendered and never introspected**, which
 * is the safe half of that rule — the same list the docked rail draws at `wide`.
 *
 * **A chip's name is the step's whole label**: the visible reference is hidden from assistive technology and the label
 * — *B1 — Basis for preparation* — stands in a visually hidden span, so the name contains what is seen (WCAG 2.5.3) and
 * says what the step is. Its state is the anchor's description, as in the rail.
 *
 * **Choosing a step closes the drawer**, by a listener on the panel: a client-side navigation changes the route
 * beneath it and nothing unmounts, so the drawer would stay open over the step the reader asked for. Delegated rather
 * than per-link, since the list is the caller's node.
 *
 * States (§8.1, the applicable subset): rest · hover · focus · current · drawer closed and open, and the six step
 * states on the chips.
 */
export interface WizardSwitcherStep {
  readonly key: string;
  readonly href: string;
  /** *B1* — the standard's own reference, what a chip shows. */
  readonly reference: string;
  /** *B1 — Basis for preparation* — the step's name for assistive technology. */
  readonly label: string;
  /** *Basis for preparation* — the stepper's line; `null` where the step has no name to show. */
  readonly name: string | null;
  readonly state: WizardStepState;
  /** *In progress · 3 outstanding* — the chip's description. */
  readonly status: string;
}

export interface WizardModuleSwitcherProps {
  readonly steps: readonly WizardSwitcherStep[];
  readonly currentKey: string;
  /** Names the strip and the drawer's list — the rail's own name. */
  readonly listLabel: string;
  /** *All modules* — the stepper's control and the drawer's title. */
  readonly allLabel: string;
  /** The *+n* control's name for `n` steps outside the strip. */
  readonly moreLabel: (hidden: number) => string;
  /** *B1 · 1 of 11* — the stepper's position line. */
  readonly position: string;
  readonly closeLabel: string;
  readonly linkComponent?: NavLinkComponent;
  /** How many chips the strip shows. */
  readonly stripSize?: number;
  /** The whole list, as the rail draws it — rendered in the drawer. */
  readonly children: ReactNode;
}

export function WizardModuleSwitcher({
  steps,
  currentKey,
  listLabel,
  allLabel,
  moreLabel,
  position,
  closeLabel,
  linkComponent,
  stripSize = 6,
  children,
}: WizardModuleSwitcherProps) {
  const Link = linkComponent ?? Anchor;
  const [open, setOpen] = useState(false);
  const index = steps.findIndex((step) => step.key === currentKey);
  const current = index === -1 ? undefined : steps[index];
  const shown = stripWindow({ count: steps.length, current: index, size: stripSize });

  const closeOnLeave = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a')) setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <nav className={styles.strip} aria-label={listLabel}>
        <ol className={styles.chips}>
          {steps.slice(shown.start, shown.end).map((step) => {
            const isCurrent = step.key === currentKey;
            return (
              <li key={step.key}>
                <Link
                  href={step.href}
                  className={isCurrent ? styles.chipCurrent : styles.chip}
                  aria-description={step.status}
                  {...(isCurrent ? ({ 'aria-current': ARIA_CURRENT.STEP } as const) : {})}
                >
                  <WizardStepMark state={step.state} />
                  <span aria-hidden="true">{step.reference}</span>
                  <span className={styles.visuallyHidden}>{step.label}</span>
                </Link>
              </li>
            );
          })}
        </ol>
        {shown.hidden > 0 ? (
          <Dialog.Trigger className={styles.more} aria-label={moreLabel(shown.hidden)}>
            {`+${shown.hidden}`}
          </Dialog.Trigger>
        ) : null}
      </nav>

      <div className={styles.stepper}>
        <p className={styles.position}>
          <span className={styles.where}>{position}</span>
          {current?.name ? <span className={styles.name}>{current.name}</span> : null}
        </p>
        <Dialog.Trigger className={styles.all}>{allLabel}</Dialog.Trigger>
      </div>

      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} onClick={closeOnLeave} aria-describedby={undefined}>
          <div className={styles.head}>
            <Dialog.Title className={styles.title}>{allLabel}</Dialog.Title>
            <Dialog.Close className={styles.close} aria-label={closeLabel}>
              <X aria-hidden="true" />
            </Dialog.Close>
          </div>
          <nav className={styles.body} aria-label={listLabel}>
            {children}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
