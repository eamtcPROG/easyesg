import type { ReactNode } from 'react';
import styles from './record-shell.module.css';

/**
 * Record archetype (§4.6) — *"view and edit one object's attributes"*: identity header, grouped
 * fields, save/cancel affordance, change attribution.
 *
 * **Six tenant screens are Record** (S-13, S-14, S-15, S-23, S-27, S-28), and the archetype is
 * extracted here at the first of them — the precedent set on `IndexShell`, which was written at
 * the first Index rather than the fourth.
 *
 * **S-28 is an unusual first instance, and the API is shaped so the usual ones are not distorted
 * by it.** §4.6's distinguishing feature is the *explicit save*, and S-28 has none: it is six
 * independent actions, each its own transaction with its own confirmation. So `actions` is a slot
 * rather than a fixture — S-15's save/cancel pair goes there, S-28 leaves it empty — and the
 * per-section action lives on the section, where the screen that has six of them needs it.
 *
 * **What it owns is the heading structure, and that is the rule worth extracting.** A Record is a
 * page-level object with named groups beneath it, so it is one `<h1>` and an `<h2>` per section,
 * with each section labelled by its own heading via `aria-labelledby`. Written by hand six times
 * that becomes six chances to nest a `<h3>` under nothing, or to give a section a heading the
 * region is not associated with — a WCAG 2.2 AA failure (NFR-75) that renders identically and is
 * visible only to a screen reader. `IndexShell`'s empty-state evidence is the same kind of rule:
 * easy to get right once, easy to lose on the fourth screen.
 *
 * **No text and no router**, per the package rule: every string arrives as a prop or a node.
 */
export interface RecordShellProps {
  /** The identity header — what object this is. Rendered as the page's one `<h1>`. */
  title: ReactNode;
  /** One or two sentences under the title (UX-17), where the object needs explaining. */
  summary?: ReactNode;
  /**
   * Record-level save/cancel (§4.6's affordance). A **slot**, because a Record whose sections each
   * commit on their own has nothing to put here — and a fixture would have made S-28 render an
   * empty bar, or pass a boolean to suppress it, which is the smell UX-89 names.
   */
  actions?: ReactNode;
  /**
   * Change attribution (§4.6) — who last changed this object and when, in the caller's words.
   * Rendered last and quietly. Absent on S-28: a credential has no attribution worth showing, and
   * inventing one would be worse than omitting it.
   */
  attribution?: ReactNode;
  /** `RecordSection`s. */
  children: ReactNode;
}

export function RecordShell({ title, summary, actions, attribution, children }: RecordShellProps) {
  return (
    <div className={styles.record}>
      <header className={styles.identity}>
        <h1 className={styles.title}>{title}</h1>
        {summary ? <p className={styles.summary}>{summary}</p> : null}
      </header>

      <div className={styles.sections}>{children}</div>

      {actions ? <div className={styles.actions}>{actions}</div> : null}
      {attribution ? <p className={styles.attribution}>{attribution}</p> : null}
    </div>
  );
}

export interface RecordSectionProps {
  /**
   * The section's own id, used to label its region. Required rather than generated: a screen links
   * to its own sections (S-28's security settings are the destination of a refusal on S-01), and a
   * generated id cannot be the target of an anchor written anywhere else.
   */
  id: string;
  heading: ReactNode;
  /** What this group of fields is for, where it is not obvious (UX-17). */
  description?: ReactNode;
  /** This section's own commit — the shape a settings Record needs and a profile Record does not. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * One group of fields within a Record.
 *
 * `<section aria-labelledby>` rather than a bare `<div>`: it is what makes the group a landmark a
 * screen reader can jump between, and what ties the heading to the content it names. The heading is
 * an `<h2>` because the shell owns the `<h1>` — the level is not the caller's to choose, which is
 * the whole point of it being here.
 */
export function RecordSection({ id, heading, description, action, children }: RecordSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section id={id} className={styles.section} aria-labelledby={headingId}>
      <div className={styles.sectionHeader}>
        <h2 id={headingId} className={styles.sectionHeading}>
          {heading}
        </h2>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>

      <div className={styles.sectionBody}>{children}</div>

      {action ? <div className={styles.sectionAction}>{action}</div> : null}
    </section>
  );
}
