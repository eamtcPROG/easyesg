import type { ReactNode } from 'react';
import styles from './content-section.module.css';

/**
 * One section of a Content page's text (§4.6; task 74.2) — the unit `ContentContents` links to.
 *
 * `<section aria-labelledby>` and an `<h2>`, as `RecordSection` is and for its reason: the shell owns the page's
 * `<h1>`, so the level is not the caller's to choose, and a region named by its own heading is one a screen reader can
 * move between. **The id is the caller's**, required, because the contents list and any link from elsewhere — S-31's
 * cookie choice pointing into the cookie policy — address the section by it.
 *
 * The legal set numbers its sections, and so may a caller: the number stands before the heading as a visual index,
 * hidden from assistive technology, so the heading's name stays its words.
 */
export interface ContentSectionProps {
  id: string;
  heading: ReactNode;
  /** The section's place in the text, shown before its heading where the set numbers its sections. */
  number?: number;
  children: ReactNode;
}

export function ContentSection({ id, heading, number, children }: ContentSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section id={id} className={styles.section} aria-labelledby={headingId}>
      <div className={styles.heading}>
        {number === undefined ? null : (
          <span className={styles.number} aria-hidden="true">
            {number}
          </span>
        )}
        <h2 id={headingId} className={`t-heading-2 ${styles.title}`}>
          {heading}
        </h2>
      </div>
      <div className={`t-body ${styles.body}`}>{children}</div>
    </section>
  );
}
