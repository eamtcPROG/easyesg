import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './callout.module.css';

/**
 * Callout — §8.3's context-scoped feedback vehicle, five intents (info · attention · warning ·
 * error · success).
 *
 * Nothing in Feedback ships with fewer than three parts (§11.5), and the API enforces it the
 * way the inventory asks — **the "what now" slot is required rather than optional**: `title` is
 * what happened, `children` is the consequence, `action` is the step that resolves or follows
 * it. A message with no next step is a defect at the type level, not a review finding.
 *
 * Error and warning announce (`role="alert"`); the rest are polite (`role="status"`). The icon
 * is never the sole carrier (UX-102): intent is also stated by the title the caller writes.
 */
/**
 * The five intents, as an `as const` object with the union derived (CLAUDE.md, "Conventions").
 * The set already existed as `ICONS`' keys; naming it means the icon map, the prop type and the
 * announce test below all read from one declaration instead of three copies of the same five
 * words. Deriving changes no caller — `intent="warning"` still compiles.
 */
export const CALLOUT_INTENT = {
  INFO: 'info',
  ATTENTION: 'attention',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success',
} as const;

export type CalloutIntent = (typeof CALLOUT_INTENT)[keyof typeof CALLOUT_INTENT];

export interface CalloutProps {
  intent: CalloutIntent;
  /** What happened. Localized by the caller, like every string in this package. */
  title: ReactNode;
  /** So what — the consequence. */
  children: ReactNode;
  /** What now — the action or next step. Required by design. */
  action: ReactNode;
}

// Typed by the vocabulary, so adding an intent without giving it an icon is a compile error
// rather than an `undefined` component at render.
const ICONS: Record<CalloutIntent, typeof Info> = {
  [CALLOUT_INTENT.INFO]: Info,
  [CALLOUT_INTENT.ATTENTION]: CircleAlert,
  [CALLOUT_INTENT.WARNING]: TriangleAlert,
  [CALLOUT_INTENT.ERROR]: CircleAlert,
  [CALLOUT_INTENT.SUCCESS]: CircleCheck,
};

export function Callout({ intent, title, children, action }: CalloutProps) {
  const Icon = ICONS[intent];
  return (
    <div
      role={
        intent === CALLOUT_INTENT.ERROR || intent === CALLOUT_INTENT.WARNING ? 'alert' : 'status'
      }
      className={`${styles.callout} ${styles[intent]}`}
    >
      <Icon aria-hidden="true" className={styles.icon} />
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        <div className={styles.body}>{children}</div>
        <div className={styles.action}>{action}</div>
      </div>
    </div>
  );
}
