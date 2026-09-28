'use client';

import { X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Callout, type CalloutIntent } from './callout';
import { NOTICE_DWELL_MS } from './dwell';
import styles from './expiring-callout.module.css';
import { useDwell } from './use-dwell';

/**
 * What the server said about the reader's own submit — a success, a warning, a refusal — which leaves on its own after
 * a while, or when they close it (`design_spec.md` §8.1, amended 28 Sep 2026 by the project owner: a message from the
 * server that *"repeats on every submit should disappear after some time"*).
 *
 * **A variant rather than a prop on `Callout`.** A Callout that stands — a whole-page result, a load failure, a
 * standing condition — is still `Callout`, and nothing about it changes; a boolean deciding which one a caller gets is
 * the split drawn in the wrong place. `Callout` also stays directive-free, which matters: `CALLOUT_INTENT` is declared
 * in it and Server Components import it.
 *
 * **It never removes itself.** It says it is done — the dwell ran out, or the close control was pressed — through
 * `onDismiss`, and the caller stops rendering that outcome; `useDismissible` is the one way the two apps do that. So a
 * screen has one answer to *is there a notice*, and the next submit's outcome shows again even when its words are the
 * same.
 *
 * **A new outcome needs a new mount, so a caller clears the last one when the next attempt starts.** The dwell and the
 * collapse are this component's state; an outcome that replaced the last one in place would inherit what the last had
 * left of its dwell — and, arriving mid-collapse, be dismissed by the end of a collapse it never began. Every caller
 * in both apps passes through *no notice* on a new submit, which is also what keeps a stale answer from sitting above
 * a request still in flight.
 *
 * **The close control is outside the status region**, laid over the Callout's corner, so a screen reader announcing
 * the message reads its three parts and not the button's name as a fourth.
 *
 * **Leaving collapses rather than vanishing.** The notice sits in the flow above a form, and taking a hundred pixels
 * out from under a reader in one frame moves whatever they were about to press. The collapse runs for `--motion-panel`,
 * and `tokens.css`'s reduced-motion rule cuts it to a millisecond — which still ends the animation, so `onDismiss` still
 * arrives.
 *
 * States (§8.1, the applicable subset): rest · held (hovered, focused, off screen or tab hidden — drawn as rest, since
 * nothing about pausing needs to be seen) · leaving · hover and focus on the close control. Loading, empty and error are
 * the screen's; this only reports what already happened.
 */
export interface ExpiringCalloutProps {
  /** `Callout`'s five, announced as `Callout` announces them — error and warning assertively. */
  readonly intent: CalloutIntent;
  /** What happened. */
  readonly title: ReactNode;
  /** So what — the consequence. */
  readonly children: ReactNode;
  /** What now, and `null` where `children` already says it — `Callout`'s slot, unchanged. */
  readonly action: ReactNode | null;
  /** The close control's accessible name, localized by the caller. */
  readonly dismissLabel: string;
  /** The dwell ran out or the reader closed it: stop rendering this outcome. */
  readonly onDismiss: () => void;
}

export function ExpiringCallout({ intent, title, children, action, dismissLabel, onDismiss }: ExpiringCalloutProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);

  useDwell({ target: frame, durationMs: NOTICE_DWELL_MS, onElapsed: () => setLeaving(true) });

  return (
    <div
      ref={frame}
      className={leaving ? `${styles.frame} ${styles.leaving}` : styles.frame}
      // Only the frame's own collapse ends it — an animation inside the Callout's action slot bubbles here too.
      onAnimationEnd={(event) => {
        if (leaving && event.target === event.currentTarget) onDismiss();
      }}
    >
      <div className={styles.overlay}>
        <Callout intent={intent} title={title} action={action}>
          {children}
        </Callout>
        <button type="button" className={styles.close} aria-label={dismissLabel} onClick={() => setLeaving(true)}>
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
