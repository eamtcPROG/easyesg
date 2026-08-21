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
export interface CalloutProps {
  intent: 'info' | 'attention' | 'warning' | 'error' | 'success';
  /** What happened. Localized by the caller, like every string in this package. */
  title: ReactNode;
  /** So what — the consequence. */
  children: ReactNode;
  /** What now — the action or next step. Required by design. */
  action: ReactNode;
}

const ICONS = {
  info: Info,
  attention: CircleAlert,
  warning: TriangleAlert,
  error: CircleAlert,
  success: CircleCheck,
} as const;

export function Callout({ intent, title, children, action }: CalloutProps) {
  const Icon = ICONS[intent];
  return (
    <div
      role={intent === 'error' || intent === 'warning' ? 'alert' : 'status'}
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
