'use client';

import { useTranslations } from 'next-intl';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import type { ReauthenticatingAccount } from '../tools/reauthentication-command';
import { ReauthenticationBody } from './reauthentication-body';
import styles from './reauthentication.module.css';

/**
 * UX-38's re-authentication, inline over the preserved context (task 92; UC-07, FR-5) — the Identity
 * artboard's *Re-authenticate, in place*.
 *
 * **It interrupts, and it cannot be dismissed.** Escape, a press on the scrim and focus leaving are all
 * refused: nothing on the screen behind can be sent until someone signs in again, so a dismissed dialogue
 * would leave a reader typing answers that go nowhere. The ways out are the artboard's two — continue, or
 * sign out and finish later — and closing the tab, which UX-37's unload guard already warns about while
 * anything is unsent.
 *
 * **Radix `Dialog`, not `AlertDialog`.** `ConsequenceDialogue` confirms an action and so focuses Cancel;
 * this one asks for a credential, so focus goes to the first field — the password, where the artboard puts
 * it and where a person arriving with a password manager needs it. It sits in the one stacking world §11.5
 * chose for every floating surface.
 *
 * **The body mounts with the content**, so each ending of the session starts the dialogue at the password
 * with nothing refused; a reducer kept above the portal would reopen at the last stage it reached.
 *
 * **`explanation` is the caller's words**: which screen was open and what it is holding is that screen's to
 * say (per-caller wording, `apps/web/CLAUDE.md`). The title and the ways out are this dialogue's own.
 *
 * States (§8.1's applicable subset): rest · submitting · invalid (inline, and the one-field summary) ·
 * error — recoverable (the api's refusal as received, or no answer) · the lockout, whose remedy is the reset
 * link · expired (a code after its challenge lapsed, back at the password) · another account holding the
 * browser.
 */
export function ReauthenticationDialogue({
  open,
  account,
  organizationId,
  explanation,
  returnTo,
  onResumed,
}: {
  readonly open: boolean;
  readonly account: ReauthenticatingAccount;
  /** The organization the screen was read under, restored on the new session. */
  readonly organizationId: string | null;
  readonly explanation: ReactNode;
  /** Where signing in again lands after *sign out and finish later* — the screen, with its locale. */
  readonly returnTo: string;
  /** A session is held again for this account: the screen may send what it holds. */
  readonly onResumed: () => void;
}) {
  const t = useTranslations('identity.reauthenticate');
  const refuse = (event: Event) => event.preventDefault();

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.dialogue} onEscapeKeyDown={refuse} onInteractOutside={refuse}>
          <Dialog.Title className={`t-heading-3 ${styles.title}`}>{t('title')}</Dialog.Title>
          <Dialog.Description className={`t-body ${styles.explanation}`}>{explanation}</Dialog.Description>
          <ReauthenticationBody
            account={account}
            organizationId={organizationId}
            returnTo={returnTo}
            onResumed={onResumed}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
