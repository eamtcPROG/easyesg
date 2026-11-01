import type { ReactNode } from 'react';
import { MAIN_CONTENT_ID } from '../navigation/skip-link-vocabulary';
import styles from './content-shell.module.css';

/**
 * Content archetype (§4.6, the tenth — OQ-17) — *"be read"*: a reading measure rather than the workspace grid, the
 * heading hierarchy as the navigation, a peer strip where the page is one of a set, no primary action, and no chrome of
 * its own beyond the public shell. S-29, S-30 and S-33 are its instances; it is extracted here, at task 74.2, before
 * any of them is built, so the first one is an instance rather than the template.
 *
 * **What it owns is the frame and the heading structure.** One `<main>` — the skip link's target, since the `(public)`
 * layout renders no landmark — a head band holding the page's one `<h1>` in an `hgroup` with the set it belongs to and
 * a lede, and the body: the text at its measure, and beside it or above it the page's contents. `ContentSection` gives
 * each section its `<h2>` and the id the contents link to, so a page cannot nest its headings under nothing.
 *
 * **Its values are the delivered prototypes'** (OQ-10), extracted through the token cascade: the legal set's head band
 * on the default surface with a rule beneath, its body on the page ground, the text at 70ch and a wider block at 100ch
 * (`ContentWide`). The prototype's 36px title takes the `display` role, the nearest of the ten (UX-82).
 *
 * **A Server Component, and that is a property to keep**: §14.2 lets the framework cache this archetype and no other,
 * so nothing in its frame needs the browser — the contents' disclosure below `wide` is a native `<details>`, and the
 * peer strip's one client leaf only scrolls (`design_spec.md` §4.6, resolved 9 Oct 2026).
 *
 * States (§8.1; OQ-17's subset, nothing on a reading page being a task): **ready** — this frame and its text;
 * **error — recoverable** — the same frame, whatever heading the page knows without its text, and the caller's error
 * `Callout` as `children` in the text's place, so the reader still knows where they are and can reach a peer; **error —
 * not found** and **error — not yet available** — §4.5's address states, which answer in place of this frame, there
 * being no page to frame.
 *
 * **No text and no router**, per the package rule: every string arrives as a prop or a node.
 */
export interface ContentShellProps {
  /** The set the page belongs to, above its title — *Legal*. */
  eyebrow?: ReactNode;
  /** The page's one `<h1>`. */
  title: ReactNode;
  /** One or two sentences under the title saying what the page is. */
  lede?: ReactNode;
  /** The page's standing, at the head's far end — a legal document's version in force and the language that binds. */
  standing?: ReactNode;
  /** `ContentPeers`, where the page is one of a set. */
  peers?: ReactNode;
  /** `ContentContents`, the page's sections. */
  contents?: ReactNode;
  /** The text — `ContentSection`s, `ContentWide` blocks — or, while it cannot be read, the error callout. */
  children: ReactNode;
}

export function ContentShell({ eyebrow, title, lede, standing, peers, contents, children }: ContentShellProps) {
  return (
    // The skip link's target (task 203.3): `tabIndex={-1}` is what lets it take focus.
    <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.content}>
      <div className={styles.head}>
        <div className={styles.heading}>
          <hgroup className={styles.identity}>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            <h1 className={`t-display ${styles.title}`}>{title}</h1>
            {lede ? <p className={`t-body ${styles.lede}`}>{lede}</p> : null}
          </hgroup>
          {standing ? <div className={styles.standing}>{standing}</div> : null}
        </div>
        {peers}
      </div>
      <div className={contents ? styles.body : `${styles.body} ${styles.bodyAlone}`}>
        {contents}
        <div className={styles.text}>{children}</div>
      </div>
    </main>
  );
}
