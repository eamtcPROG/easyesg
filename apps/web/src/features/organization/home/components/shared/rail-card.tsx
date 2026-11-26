import type { ReactNode } from 'react';
import styles from '../styles/home.module.css';

/**
 * The rail's card on S-05's artboard (task 255): a white card whose mono eyebrow names it, beside the three questions
 * at `wide` and between them below it.
 *
 * **In `components/shared/` on one test: is it read by more than one sibling?** `deadline/` and `memberships/` both
 * read it, and they are siblings at the top of `components/`, so this is the level both can see. The overview's
 * regions wear a different anatomy — the label above the card rather than inside it — which is why this is not the
 * same component with a flag.
 *
 * **The eyebrow is a level-2 heading**, as the regions' labels are: each card answers a question of its own under
 * the screen's one `h1`, and a reader moving by heading should land on *Filing deadline* as on *Needs your attention*.
 */
export function RailCard({
  heading,
  children,
}: {
  /** Localized by the caller: this file owns no namespace. */
  readonly heading: string;
  readonly children: ReactNode;
}) {
  return (
    <section className={`${styles.card} ${styles.railCard}`}>
      <div className={styles.railCardInner}>
        <h2 className={styles.railLabel}>{heading}</h2>
        {children}
      </div>
    </section>
  );
}
