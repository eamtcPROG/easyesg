import type { ReactNode } from 'react';
import { BackArrow } from '../navigation/back-arrow';
import type { NavLinkComponent } from '../navigation/nav-link';
import styles from './page-heading.module.css';

/**
 * A page's heading with its way back — the trail above the title, the arrow before it, and the title with its summary
 * as the page's one `<h1>` group. S-13's record artboard drew it first and `RecordCard` built it there (28 Sep 2026);
 * **it left `RecordCard` on 30 Sep 2026 when a second archetype needed it** (project owner): S-14 — an Index and a
 * Record beneath an entity — takes S-13's conventions, and a heading written again per archetype is the one-off UX-89
 * names. `RecordCard` and `RecordShell` render it; an Index renders it itself, since its header is the caller's.
 *
 * **The back control is data**, `Breadcrumb`'s shape: the arrow is `BackArrow`, its own part since the wizard's bar
 * became its second reader (task 179.1), and the app injects its router — and, where leaving can lose work, a link
 * that asks first.
 *
 * **Directive-free**: it holds no state, so a Server Component renders it as readily as a Client one. **No text and no
 * router**, the package rule: every word arrives as a prop or a node.
 *
 * **It renders siblings, not a box**: the trail's margins place it midway in the page's top inset against the
 * parent's gap, so the caller's column is the frame.
 *
 * States (§8.1, the applicable subset): rest · the arrow's hover and focus · without a way back, the title alone.
 */
export interface PageBack {
  /** Where the page lies — the one a level up from it. */
  readonly href: string;
  /** What a screen reader hears for the arrow, naming where it leads. Localized by the caller. */
  readonly label: string;
}

export interface PageHeadingProps {
  /** The trail above the title — a `Breadcrumb`. It stands midway in the page's top inset. */
  breadcrumb?: ReactNode;
  /** The arrow before the title, back to where the page lies. */
  back?: PageBack;
  /** The app's link, for the arrow. A plain anchor where there is no router to inject. */
  linkComponent?: NavLinkComponent;
  /** What the page is — its one `<h1>`. */
  title: ReactNode;
  /** One or two sentences under the title (UX-17). */
  summary?: ReactNode;
}

export function PageHeading({ breadcrumb, back, linkComponent, title, summary }: PageHeadingProps) {
  const identity = (
    <hgroup className={styles.identity}>
      <h1 className={styles.title}>{title}</h1>
      {summary ? <p className={styles.summary}>{summary}</p> : null}
    </hgroup>
  );

  return (
    <>
      {breadcrumb ? <div className={styles.trail}>{breadcrumb}</div> : null}

      {/* The row exists for the arrow, so a heading without one is the group alone — the markup every `RecordShell`
          screen had before this file, unchanged for the ones that offer no way back. */}
      {back ? (
        <div className={styles.titleRow}>
          <BackArrow href={back.href} label={back.label} linkComponent={linkComponent} />
          {identity}
        </div>
      ) : (
        identity
      )}
    </>
  );
}
