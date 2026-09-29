import { Slash } from 'lucide-react';
import type { ReactNode } from 'react';
import { Anchor, type NavLinkComponent } from './nav-link';
import { ARIA_CURRENT } from './nav-link-vocabulary';
import styles from './breadcrumb.module.css';

/**
 * Breadcrumb — §11.5's Navigation entry, drawn on the Components sheet as *Reports / Raport VSME 2025 / B8* and on
 * S-13's record artboard as *Entities · Lina Logistic SRL* above the record's title. Built 28 Sep 2026 for S-13's
 * record (project owner: *"the page has no way back to /entities using the UI"*), which is the first screen whose
 * address lies beneath a workspace section's and so the first a reader can reach and not leave but by the band.
 *
 * **The trail is data and the anchors are this component's**, `WorkspaceNav`'s shape and for its reason: the current
 * page carries `aria-current`, and only the element that holds a semantics can be relied on to carry it. The app injects
 * its router as `linkComponent`, because a raw anchor would drop `apps/web`'s locale prefix.
 *
 * **The separators are drawn and hidden**, one per step after the first: a screen reader already hears a list of
 * links, and a slash read between them is noise. The specimen's slash, drawn from the icon set rather than written as
 * text, so the package still owns no characters a catalogue would have to.
 *
 * **Directive-free**: it holds no state, so a Server Component can render it as readily as a Client one.
 *
 * States (§8.1, the applicable subset): rest · hover and focus on each step · **current**, the last item, never a link.
 */
export interface BreadcrumbStep {
  readonly href: string;
  /** Localized by the caller: this package owns no text (UX-79). */
  readonly label: string;
}

export interface BreadcrumbProps {
  /** The navigation's accessible name, localized by the caller. */
  readonly label: string;
  /** The way back, outermost first. */
  readonly trail: readonly BreadcrumbStep[];
  /** This page — what the reader is on, drawn last and never as a link. */
  readonly current: ReactNode;
  /** The app's own link; a plain anchor where there is no router to inject. */
  readonly linkComponent?: NavLinkComponent;
}

export function Breadcrumb({ label, trail, current, linkComponent }: BreadcrumbProps) {
  const Link = linkComponent ?? Anchor;

  return (
    <nav aria-label={label}>
      <ol className={styles.list}>
        {trail.map((step, index) => (
          <li key={step.href} className={styles.step}>
            {index > 0 ? <Separator /> : null}
            <Link href={step.href} className={styles.link}>
              {step.label}
            </Link>
          </li>
        ))}
        <li className={styles.step}>
          {trail.length > 0 ? <Separator /> : null}
          <span className={styles.current} aria-current={ARIA_CURRENT.PAGE}>
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}

function Separator() {
  return <Slash className={styles.separator} aria-hidden="true" />;
}
