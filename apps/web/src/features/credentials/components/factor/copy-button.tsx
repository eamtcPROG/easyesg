'use client';

import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FACTOR_MESSAGES } from '../shared/credentials-messages';
import styles from '../styles/credentials.module.css';

/**
 * Copies one value to the clipboard and says so — the key an authenticator is set up with, or the recovery codes
 * (task 169, the owner's review of the rebuilt S-28).
 *
 * **In `factor/` because both readers are its siblings** — the enrolment and the codes. It moves up when a second
 * region needs it, and to `packages/ui` when A-19 does.
 *
 * **What happened is announced, not only painted**: the confirmation is a polite live region beside the button, so a
 * screen reader hears *Copied* where the label change alone would be silent. **A refusal says what to do instead** —
 * the clipboard is refused outside a secure context and by some browser settings, and the value is on screen to
 * select by hand, which is the fallback the enrolment's printed key has always been.
 *
 * One `useState`, the copy-confirmation case the root `CLAUDE.md` names as one: nothing else moves with it.
 */
const COPY_STATE = {
  IDLE: 'idle',
  COPIED: 'copied',
  FAILED: 'failed',
} as const;

type CopyState = (typeof COPY_STATE)[keyof typeof COPY_STATE];

export function CopyButton({ value, label }: { readonly value: string; readonly label: string }) {
  const t = useTranslations(FACTOR_MESSAGES);
  const [state, setState] = useState<CopyState>(COPY_STATE.IDLE);

  const copy = () => {
    // `clipboard` is absent outside a secure context, where calling it would throw rather than reject.
    const written = navigator.clipboard?.writeText(value) ?? Promise.reject(new Error('no clipboard'));
    written.then(
      () => setState(COPY_STATE.COPIED),
      () => setState(COPY_STATE.FAILED),
    );
  };

  return (
    <span className={styles.copy}>
      <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={copy}>
        {label}
      </Button>
      <span className={styles.copyStatus} role="status">
        {state === COPY_STATE.COPIED ? t('copied') : state === COPY_STATE.FAILED ? t('copyFailed') : null}
      </span>
    </span>
  );
}
