import type { ReactNode } from 'react';
import styles from './usage-counter.module.css';
import { USAGE_STANDING, type UsageStanding } from './usage-counter-vocabulary';

/**
 * Usage counter — consumption against a limit, in context (§6.10, UX-52). **Added to §11.5 by task
 * 142**, and not invented for one screen: the artboards draw it on S-13's header (*"4 of 5 entities
 * used on the Practice plan · one left"*, with its path), on S-16's (*"4 of 10 seats used"*) and on
 * S-17's usage rows — and UX-52 requires the approaching warning *against the counter*, so a counter
 * with no component would be a one-off per screen, each deciding what "approaching" looks like.
 *
 * **Not the entitlement gate.** The gate is the block a refused action shows, with the limit, the
 * allowance, the consumption and the path in UX-50's order; this is the one line that sits beside the
 * action before anyone presses it. They differ in anatomy, which is UX-89's test for two components.
 *
 * **The standing is never carried by colour alone (UX-102).** The row's tint, border and dot mark it,
 * and the caller's words must state it — *one left*, *none left* — which this component cannot supply,
 * because it owns no text. Its spec holds the markup; the words are the screen's to author.
 *
 * States (§8.1): **success** — within, approaching and reached are standings of a settled figure, not
 * states, the conflation `VersionPinIndicator`'s first docblock made; **partial** — `unknown`, drawn
 * quietly rather than as an alarm, because everything around it did resolve; **loading** — none of its
 * own, the region's skeleton stands in; no empty, error, offline or read-only instance.
 */
export interface UsageCounterProps {
  standing: UsageStanding;
  /** The figure in the caller's words — "9 of 10 seats in use · one left". */
  children: ReactNode;
  /** A next step where the screen owns one — S-13's "See the plan". Absent where there is none. */
  action?: ReactNode;
  className?: string;
}

export function UsageCounter({ standing, children, action, className }: UsageCounterProps) {
  const marked = standing === USAGE_STANDING.APPROACHING || standing === USAGE_STANDING.REACHED;

  return (
    // `data-standing` rather than a conditional class, for `VersionPinIndicator`'s reason: the
    // stylesheet keys off it and a spec can read it, so deleting the signal cannot leave tests green.
    <p
      className={['t-caption', styles.counter, className].filter(Boolean).join(' ')}
      data-standing={standing}
    >
      {marked ? <span className={styles.dot} aria-hidden="true" /> : null}
      <span>{children}</span>
      {action ? <span className={styles.action}>{action}</span> : null}
    </p>
  );
}
