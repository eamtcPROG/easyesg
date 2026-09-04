'use client';

import { AlertDialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { Button } from '../primitives/button';
import { BUTTON_VARIANT } from '../primitives/button-vocabulary';
import styles from './consequence-dialogue.module.css';

/**
 * Consequence dialogue — §11.5's Feedback entry and §6.14's instrument.
 *
 * **UX-70 is the whole API: "explicit confirmation that names the specific object and the specific
 * consequence. Generic 'Are you sure?' is prohibited."** So `object` and `consequence` are required
 * props, not optional decoration on a confirm box — a dialogue that could be rendered without them
 * would be exactly the generic prompt the requirement forbids, and the type is what makes that
 * unrepresentable rather than a review comment.
 *
 * **`retained` is UX-69's slot**, separate from `consequence` because they are opposite facts and a
 * reader needs both: what stops (their access) and what does not (their attributed history). S-16
 * is the case the requirement names — *"the interface shall state at the point of removal that
 * their historical contributions remain attributed in the change history"* — and a dialogue that
 * left it to the caller's `consequence` prose would make it optional in practice.
 *
 * **Radix AlertDialog, not a native `<dialog>` — corrected 26 Aug 2026** (project owner, task 26.4's
 * component review), under §11.5's fifth recorded addition. The native modal is better tech taken
 * alone: `showModal()` gives the browser's own top layer, focus containment, an inert background,
 * Escape and `::backdrop`, none of it reimplemented. It was given up because **every floating
 * surface must live in one stacking world**. A Radix menu portals to `document.body`, the top layer
 * sits above `body` entirely, so a `Select` opened inside a native dialogue would render behind its
 * own backdrop — invisible until the two are composed, which UX-47's export dialogue (format and
 * language, both chosen inside a dialogue) is the first screen to do.
 *
 * `AlertDialog` rather than `Dialog` is the semantic choice, and it earns two behaviours worth
 * knowing: an outside click does **not** dismiss it (a consequential decision interrupts, and is
 * not dismissed by a stray click), and initial focus goes to **Cancel** rather than to the
 * destructive action. Both are pinned in the spec beside this file.
 *
 * Distinguished from an ordinary confirmation by the destructive button variant and by naming the
 * object in the heading (UX-71's principle, applied to the reversible-but-consequential case).
 *
 * States (§8.1, the applicable subset): rest · confirming (pending-async on the primary action).
 * There is no error state — a failed confirmation is the *screen's* to report, beside the thing
 * that failed, because the dialogue is gone by then.
 */
export interface ConsequenceDialogueProps {
  readonly open: boolean;
  /** What is being acted on, by name. UX-70: never a category, always the specific object. */
  readonly object: ReactNode;
  /** The heading. Localized by the caller, and it should name the action. */
  readonly title: ReactNode;
  /** What will stop, change or be lost. Specific to this object. */
  readonly consequence: ReactNode;
  /** What will NOT change — UX-69's reassurance. Omitted where nothing survives the action. */
  readonly retained?: ReactNode;
  readonly confirmLabel: ReactNode;
  readonly cancelLabel: ReactNode;
  readonly busy?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConsequenceDialogue({
  open,
  object,
  title,
  consequence,
  retained,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ConsequenceDialogueProps) {
  return (
    <AlertDialog.Root
      open={open}
      // Escape and the Cancel button arrive here alike, which is why the caller has one `onCancel`
      // rather than two handlers that must agree. **While `busy`, a close request is dropped**: an
      // in-flight destructive operation cannot be un-asked, and letting Escape report "cancelled"
      // to the screen while the request is still running is how a list ends up disagreeing with the
      // database.
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.overlay} />
        <AlertDialog.Content className={styles.dialogue}>
          <AlertDialog.Title className={`t-heading-3 ${styles.title}`}>{title}</AlertDialog.Title>

          {/* One Description spanning all three facts, so assistive technology is given the whole
              case rather than the middle sentence of it. `asChild` because Description renders a
              `<p>` by default and these are three paragraphs. */}
          <AlertDialog.Description asChild>
            <div>
              {/* The object gets its own line rather than being folded into the prose: UX-70 asks
                  for it to be named, and a name inside a sentence is one a reader skims past. */}
              <p className={`t-body-strong ${styles.object}`}>{object}</p>
              <p className={`t-body ${styles.consequence}`}>{consequence}</p>
              {retained ? <p className={`t-body ${styles.retained}`}>{retained}</p> : null}
            </div>
          </AlertDialog.Description>

          <div className={styles.actions}>
            {/* `Cancel` is a Radix part because it is what takes initial focus — the safe choice
                under the pointer, on a dialogue whose other button is destructive. Closing is left
                to `onOpenChange` above. */}
            <AlertDialog.Cancel asChild>
              <Button variant={BUTTON_VARIANT.SUBTLE} disabled={busy}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            {/* Deliberately NOT `AlertDialog.Action`: that part closes the dialogue itself, which
                fires `onOpenChange(false)` while `busy` is still false — so a confirmation would
                report a cancellation on its way out. The caller closes by setting `open`. */}
            <Button variant={BUTTON_VARIANT.DESTRUCTIVE} busy={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
