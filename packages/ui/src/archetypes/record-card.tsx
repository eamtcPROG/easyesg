import type { ReactNode } from 'react';
import type { NavLinkComponent } from '../navigation/nav-link';
import { PageHeading, type PageBack } from './page-heading';
import styles from './record-shell.module.css';

/**
 * The Record archetype (§4.6) in its **card** form — the S-13 record artboard's anatomy, built 28 Sep 2026 (project
 * owner) for S-13 first: the way back above the title, the record's groups inside **one** surface with its commit at
 * the surface's foot, and a side column beside it from `wide`.
 *
 * **A second form rather than a flag on `RecordShell`**, because the anatomy differs, which is UX-89's test: a
 * `RecordShell` is a measure-bounded column of boxed sections with its save below them, and this is one wide surface
 * holding the sections, a foot bar inside it, and a column beside it. The other Record screens keep `RecordShell`
 * until someone chooses otherwise for them. **The heading structure is the same and is shared, not restated**: the
 * sections are `RecordSection`, one `<h2>` each under this file's one `<h1>`, and the stylesheet they share is what
 * takes their boxes off inside the surface.
 *
 * **The heading with its way back is `PageHeading`'s** since 30 Sep 2026, when S-14 needed it on an Index and on
 * `RecordShell` too; it was built here first, and this card renders it unchanged.
 *
 * **No text and no router**, the package rule: every word arrives as a prop or a node.
 *
 * States (§8.1): those of the Record it frames — the caller's notices and read-only state go in `children`, above the
 * sections, and a Record with nothing to commit passes no `actions`.
 */
/** The arrow's destination and its name — `PageHeading`'s, kept under the name S-13's caller already imports. */
export type RecordCardBack = PageBack;

export interface RecordCardProps {
  /** The trail above the title — a `Breadcrumb`. It stands midway in the page's top inset. */
  breadcrumb?: ReactNode;
  /** The arrow before the title, back to where the record lies. */
  back?: RecordCardBack;
  /** The app's link, for the arrow. A plain anchor where there is no router to inject. */
  linkComponent?: NavLinkComponent;
  /** What object this is — the page's one `<h1>`. */
  title: ReactNode;
  /** One or two sentences under the title (UX-17). */
  summary?: ReactNode;
  /** The record's commit, in the surface's foot bar. */
  actions?: ReactNode;
  /** The side column: beside the surface from `wide`, beneath it below. */
  aside?: ReactNode;
  /** Notices first, then `RecordSection`s. */
  children: ReactNode;
}

export function RecordCard({
  breadcrumb,
  back,
  linkComponent,
  title,
  summary,
  actions,
  aside,
  children,
}: RecordCardProps) {
  return (
    <div className={styles.card}>
      <PageHeading
        breadcrumb={breadcrumb}
        back={back}
        linkComponent={linkComponent}
        title={title}
        summary={summary}
      />

      <div className={aside ? `${styles.layout} ${styles.layoutWithAside}` : styles.layout}>
        <div className={styles.surface}>
          <div className={styles.surfaceBody}>{children}</div>
          {actions ? <div className={styles.surfaceActions}>{actions}</div> : null}
        </div>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </div>
    </div>
  );
}
