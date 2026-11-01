import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { CALLOUT_INTENT, type CalloutIntent } from './callout';
import styles from './banner.module.css';

/**
 * Banner — §8.3's *persistent, page-level* feedback vehicle: *"A standing condition: read-only cause
 * (UX-13), unsynced queue (UX-37), superseded version pin."* Built at its first two instances,
 * both in S-07 (task 35.2).
 *
 * **Distinct from `Callout` by scope, not by anatomy.** A callout is context-scoped feedback inside
 * a region; a banner states a condition that holds for the whole screen for as long as it is true,
 * and stays where it is while the reader works beneath it. That is why it spans the page rather than
 * sitting in a column, and why it never carries a dismiss control — a condition the reader could
 * hide would still hold.
 *
 * **Three parts, required** (§11.5: *"nothing in Feedback ships with fewer than three parts"*):
 * `title` is what is standing, `children` is what it means for the reader, `action` is what ends
 * it — and `null` where the body already says so, on `Callout`'s recorded reasoning (27 Aug 2026).
 *
 * **Always `role="status"`, never `alert`.** A banner appears when a condition begins and stays; an
 * assertive announcement on every render of a screen that is merely offline would talk over the
 * reader's own work (UX-112 wants polite regions for autosave). The intents reuse `Callout`'s
 * vocabulary rather than declaring a second one — feedback has five intents, whichever vehicle
 * carries them.
 *
 * States (§8.1): **success only** — like the version pin indicator, a banner is a settled fact the
 * screen has already established; it has no loading or error instance of its own.
 */
export interface BannerProps {
  intent: CalloutIntent;
  /** What is standing. Localized by the caller, like every string in this package. */
  title: ReactNode;
  /** What it means for the reader — what is affected and what happens next. */
  children: ReactNode;
  /** What ends the condition, or `null` where `children` already carries it. Required-but-nullable. */
  action: ReactNode | null;
}

const ICONS: Record<CalloutIntent, typeof Info> = {
  [CALLOUT_INTENT.INFO]: Info,
  [CALLOUT_INTENT.ATTENTION]: CircleAlert,
  [CALLOUT_INTENT.WARNING]: TriangleAlert,
  [CALLOUT_INTENT.ERROR]: CircleAlert,
  [CALLOUT_INTENT.SUCCESS]: CircleCheck,
};

export function Banner({ intent, title, children, action }: BannerProps) {
  const Icon = ICONS[intent];
  return (
    <div role="status" className={`${styles.banner} ${styles[intent]}`}>
      <Icon aria-hidden="true" className={styles.icon} />
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        <div className={styles.body}>{children}</div>
      </div>
      {action === null ? null : <div className={styles.action}>{action}</div>}
    </div>
  );
}
