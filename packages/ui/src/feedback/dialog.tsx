'use client';

import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { DIALOG_SIZE, type DialogSize } from './dialog-vocabulary';
import styles from './dialog.module.css';

/**
 * Dialogue — the Components sheet's `ui/dialog.tsx`, added to §11.5 on 24 Sep 2026 (task 170): a modal
 * surface for **a record or a form**, which is what the console opens a row into (`design_spec.md`
 * §5.2's preamble). Titled, with a close control at its head, a body that scrolls on its own, and an
 * optional closing row of actions that stays in view while the body scrolls.
 *
 * **Not the consequence dialogue, and the difference is the API.** `ConsequenceDialogue` interrupts a
 * decision: it is an AlertDialog, it takes no children, and its props are UX-70's facts. This one
 * holds content the caller composes — a record's facts, a form — and a consequence it asks to confirm
 * opens **over** it, which works because both are Radix layers in one stacking world (§11.5's fifth
 * recorded addition): Radix routes an outside press to the topmost layer only, so confirming does not
 * also dismiss the record beneath.
 *
 * **An outside press does not close it**; Escape and the close control do. The console opens forms in
 * here, and a stray click beside a half-edited connection form should not discard the edit — the same
 * reasoning `ConsequenceDialogue` records for a decision, applied to work in progress.
 *
 * **It fills the frame at `compact`** (UX-77 as amended): below 40rem the measure a centred surface
 * leaves is a strip of dimmed page nobody can use, which is `ChromeDrawer`'s recorded reasoning.
 *
 * **Presentational, like every component here**: the title, the close control's name and every word
 * in the body arrive from the caller. `open` is controlled, because every consumer so far holds it in
 * the URL (UX-4) — the dialogue is a view of an address, not state of its own.
 *
 * States (§8.1, the applicable subset): closed · open · rest · hover and focus on the close control.
 * Loading, empty and error belong to the content the caller passes, which draws its own — a dialogue
 * that rendered them would need the caller's copy.
 */
export interface DialogProps {
  readonly open: boolean;
  /** Escape and the close control both arrive here, so the caller has one handler rather than two. */
  readonly onClose: () => void;
  /** The heading, and the dialogue's accessible name. */
  readonly title: ReactNode;
  /** A sentence under the title, and the dialogue's accessible description. */
  readonly description?: ReactNode;
  /** The close control's accessible name, localized by the caller. */
  readonly closeLabel: string;
  readonly children: ReactNode;
  /** The closing row of actions — at the end at `wide`, stacked full width at `compact`. */
  readonly footer?: ReactNode;
  readonly size?: DialogSize;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  closeLabel,
  children,
  footer,
  size = DIALOG_SIZE.DEFAULT,
}: DialogProps) {
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={styles.dialog}
          data-size={size}
          onPointerDownOutside={(event) => event.preventDefault()}
          // With no description, Radix warns unless the attribute is explicitly absent.
          {...(description === undefined ? { 'aria-describedby': undefined } : {})}
        >
          <div className={styles.head}>
            <RadixDialog.Title className={`t-heading-3 ${styles.title}`}>{title}</RadixDialog.Title>
            <RadixDialog.Close className={styles.close} aria-label={closeLabel}>
              <X aria-hidden="true" />
            </RadixDialog.Close>
          </div>
          {description === undefined ? null : (
            <RadixDialog.Description className={`t-body ${styles.description}`}>
              {description}
            </RadixDialog.Description>
          )}
          <div className={styles.body}>{children}</div>
          {footer === undefined ? null : <div className={styles.footer}>{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
