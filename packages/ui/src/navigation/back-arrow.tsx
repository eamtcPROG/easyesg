import { ArrowLeft } from 'lucide-react';
import { Anchor, type NavLinkComponent } from './nav-link';
import styles from './back-arrow.module.css';

/**
 * The square arrow that leads a screen's reader back — §11.5's Back-to-context, drawn as S-13's record artboard and
 * the wizard's bar both draw it: a bordered 36px square with the arrow in it, named by a visually hidden sentence.
 *
 * **Its own part since 30 Sep 2026 (task 179.1)**, when the wizard's bar became its second reader: it was
 * `PageHeading`'s markup until then, and a copy in the bar would be the one-off UX-89 names.
 *
 * **The name is a sentence inside the anchor, not a label attribute**, so a link the app injects — one that asks
 * before leaving unsent work, as the wizard's does — carries it without having to forward an attribute.
 *
 * **Directive-free**: it holds no state, so a Server Component renders it; the router and any guard arrive as the
 * injected link. **No text**: the sentence is the caller's.
 *
 * States (§8.1, the applicable subset): rest · hover · focus.
 */
export interface BackArrowProps {
  /** Where it leads. */
  readonly href: string;
  /** What a screen reader hears — naming where it leads, or what leaving means. Localized by the caller. */
  readonly label: string;
  /** The app's link. A plain anchor where there is no router to inject. */
  readonly linkComponent?: NavLinkComponent;
}

export function BackArrow({ href, label, linkComponent }: BackArrowProps) {
  const Link = linkComponent ?? Anchor;

  return (
    <Link href={href} className={styles.back}>
      <ArrowLeft aria-hidden="true" className={styles.icon} />
      <span className={styles.visuallyHidden}>{label}</span>
    </Link>
  );
}
