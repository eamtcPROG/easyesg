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
 * **`action={null}` is how a caller says the next step is already inside `children`** (27 Aug
 * 2026). The slot stays required, so it cannot be forgotten — but a *server-composed* message is
 * the case the original rule did not anticipate: NFR-79 makes the API's `detail` carry all three
 * parts in one sentence, so `identity.sign_in.credential_invalid` already ends *"Verificați datele
 * introduse și încercați din nou"*. Five screens were passing a catalogue string beside it that
 * duplicated that clause verbatim — and, worse, kept saying "try again" over a throttle refusal
 * whose detail says to wait. `null` is a decision the reader of the code can see; leaving the slot
 * to a fixed sentence was one nobody had taken.
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
  /**
   * What now — the action or next step. **Required, and `null` is a legitimate value**: pass a node
   * where this screen owns a step the message cannot express (typically one that *navigates*), and
   * `null` where `children` is a server-composed message already carrying it. Required-but-nullable
   * is the shape that forces the question without forcing an answer that would be a duplicate.
   */
  action: ReactNode | null;
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
