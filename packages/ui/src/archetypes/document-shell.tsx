import type { ReactNode } from 'react';
import { MAIN_CONTENT_ID } from '../navigation/skip-link-vocabulary';
import styles from './document-shell.module.css';

/**
 * Document archetype (§4.6) — *a faithful preview of a rendered artefact*: page-shaped, paginated, print-accurate. S-10
 * is its one instance (task 43.2), where the artefact is the report's document, rendered by the api and framed here.
 *
 * **What it owns is the frame of the screen**: the bar above, then one `<main>` — the skip link's target — holding the
 * screen's heading with its controls and the document's pages (`DocumentPages`) beside the document (`DocumentFrame`)
 * at `wide`, above it below, the document filling what is left. The document's own layout is the document's: this archetype draws none of it, which is
 * what keeps it print-accurate (§11.8, `architecture.md` §12.5.6's task-43 row).
 *
 * States (§8.1; the archetype's subset, nothing on it being editable): **loading — initial** and **pending — async**
 * are the frame's while the document is assembled; **error — recoverable** is the caller's error `Callout` as
 * `children`, the bar still there so the reader can go back; **read-only** by nature.
 *
 * **No text and no router**, per the package rule.
 */
export interface DocumentShellProps {
  /** The bar above the document — S-07's, with its way back. */
  bar: ReactNode;
  /** The screen's one `<h1>` and what it controls — S-10's language — above the pages. */
  heading: ReactNode;
  /** `DocumentPages`, the document's pages. */
  pages?: ReactNode;
  /** The document — `DocumentFrame` — or, while it cannot be shown, the error callout. */
  children: ReactNode;
}

export function DocumentShell({ bar, heading, pages, children }: DocumentShellProps) {
  return (
    <div className={styles.shell}>
      {bar}
      {/* The skip link's target (task 203.3): `tabIndex={-1}` is what lets it take focus. */}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.body}>
        <div className={styles.side}>
          <div className={styles.heading}>{heading}</div>
          {pages}
        </div>
        <div className={styles.document}>{children}</div>
      </main>
    </div>
  );
}
