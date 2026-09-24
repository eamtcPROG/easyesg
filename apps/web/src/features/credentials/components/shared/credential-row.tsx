import type { ReactNode } from 'react';
import styles from '../styles/credentials.module.css';

/**
 * One credential at rest, as `EasyESG Identity.dc.html` draws S-28 (task 169; OQ-19 closed 24 Sep 2026): its name
 * with a state chip, one line saying where it stands, its trigger at the far end — and, below, the body the trigger
 * opens in place.
 *
 * **In `components/shared/` on one test: more than one sibling reads it** — `password/` and `factor/`. The linked
 * identities are not a row but a group of them under one heading, which is why `providers/` draws its own.
 *
 * **This application's, not the inventory's** (UX-89 as amended 14 Sep 2026): only S-28 draws it today. A-19 shares
 * S-28's shape, and the day the console takes the rows this moves to `packages/ui` with §8.1's states designed —
 * never copied across. It takes colour, space and type from the token cascade only and owns no text.
 *
 * **The trigger is a disclosure button, not a mode switch**: it carries `aria-expanded` and names the body with
 * `aria-controls`, and the body follows it in reading order, so a keyboard reader tabs from the trigger into the form
 * it opened with no focus moved for them. `rowBodyId` is how a trigger and the body agree on that id.
 */
export interface CredentialRowProps {
  /** The region key — the row's landmark id, and the stem of its body's. */
  readonly id: string;
  readonly heading: ReactNode;
  /** A `StatusChip`, beside the heading rather than in it, so the region's name stays the credential's. */
  readonly status?: ReactNode;
  /** Where the credential stands, in one line; absent where its read did not resolve. */
  readonly description?: ReactNode;
  /** The row's triggers; none where the row cannot act — its read did not resolve. */
  readonly triggers?: ReactNode;
  /** What a trigger opened, or a standing state the row carries at rest (the recovery codes run out). */
  readonly children?: ReactNode;
}

export const rowBodyId = (id: string): string => `${id}-body`;

export function CredentialRow({ id, heading, status, description, triggers, children }: CredentialRowProps) {
  const headingId = `${id}-heading`;

  return (
    <section id={id} className={styles.row} aria-labelledby={headingId}>
      <div className={styles.rowSummary}>
        <div className={styles.rowIdentity}>
          <div className={styles.rowName}>
            <h2 id={headingId} className={styles.rowHeading}>
              {heading}
            </h2>
            {status}
          </div>
          {description ? <p className={styles.rowDescription}>{description}</p> : null}
        </div>
        {triggers ? <div className={styles.rowTriggers}>{triggers}</div> : null}
      </div>
      {children ? (
        <div id={rowBodyId(id)} className={styles.rowBody}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
