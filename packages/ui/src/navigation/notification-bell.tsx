import { Bell } from 'lucide-react';
import { Badge } from '../primitives/badge';
import { BADGE_TONE } from '../primitives/badge-vocabulary';
import { Anchor, type NavLinkComponent } from './nav-link';
import { ARIA_CURRENT } from './nav-link-vocabulary';
import styles from './notification-bell.module.css';

/**
 * The global bar's notification entry — §4.2's *notification centre* in the band, with the unread count visible
 * from any screen (task 50.2.1; UX-62, FR-161). Drawn from the commerce artboard's global tier: a 32px control on
 * the band's own light surface, the bell, and the count at its corner.
 *
 * **Here rather than in the tenant app because the glyph is here.** `lucide-react` is this package's dependency and
 * no application's (`architecture.md` §12.1), and the band is `GlobalBar`'s — so the entry is a part of the band
 * that takes its words, its address and its router from the caller, as every part of it does.
 *
 * **The accessible name is the caller's whole sentence**, count included — *"Notifications, 4 unread"* — carried as
 * hidden text inside the link, because the injected link type takes no `aria-label`. The badge beside the glyph is
 * therefore hidden from assistive technology, or the number would be read twice.
 *
 * States (§8.1, the applicable subset): rest · hover · focus · **current** on S-26 itself · count unknown (`null`,
 * no badge drawn) · nothing unread (zero, no badge drawn). No loading or error state of its own: an unknown count
 * draws the bell alone, which is still the way to the centre.
 */
export interface NotificationBellProps {
  readonly href: string;
  /** The link's accessible name, count included — localized by the caller. */
  readonly label: string;
  /** Notices unread; `null` while unknown. Zero draws no badge. */
  readonly count: number | null;
  /** Whether the reader is on the centre itself, which the link then says (`aria-current`). */
  readonly current?: boolean;
  readonly linkComponent?: NavLinkComponent;
}

export function NotificationBell({ href, label, count, current = false, linkComponent }: NotificationBellProps) {
  const Link = linkComponent ?? Anchor;
  return (
    <Link href={href} className={styles.bell} {...(current ? ({ 'aria-current': ARIA_CURRENT.PAGE } as const) : {})}>
      <Bell aria-hidden="true" className={styles.glyph} />
      <span className={styles.assistive}>{label}</span>
      {count !== null && count > 0 ? (
        <span className={styles.count}>
          <Badge tone={BADGE_TONE.QUIET} count={count} />
        </span>
      ) : null}
    </Link>
  );
}
