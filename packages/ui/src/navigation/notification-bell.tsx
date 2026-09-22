import { Bell } from 'lucide-react';
import type { ComponentPropsWithRef } from 'react';
import { Badge } from '../primitives/badge';
import { BADGE_TONE } from '../primitives/badge-vocabulary';
import styles from './notification-bell.module.css';

/**
 * The global bar's notification entry — §4.2's *notification centre* in the band, with the unread count visible
 * from any screen (tasks 50.2.1, 50.2.2; UX-62, FR-161). Drawn from the commerce artboard's global tier: a 32px control
 * on the band's own light surface, the bell, and the count at its corner.
 *
 * **Here rather than in the tenant app because the glyph is here.** `lucide-react` is this package's dependency and
 * no application's (`architecture.md` §12.1), and the band is `GlobalBar`'s — so the entry is a part of the band
 * that takes its words and its behaviour from the caller, as every part of it does.
 *
 * **A button since task 50.2.2**, which opens the panel the artboard draws (§12.5.6's task-50.2 row (1)). It spreads
 * what it is handed onto the element — the handler, the `aria-expanded` and `aria-controls` a popover trigger sets,
 * the ref — so a caller's Radix `Popover.Trigger asChild` can slot onto it; it introspects nothing, which is what
 * keeps it free of the directive `Slot` would demand.
 *
 * **The accessible name is the caller's whole sentence**, count included — *"Notifications, 4 unread"* — carried as
 * hidden text inside the button. The badge beside the glyph is therefore hidden from assistive technology, or the
 * number would be read twice.
 *
 * States (§8.1, the applicable subset): rest · hover · focus · expanded (its panel open) · count unknown (`null`, no
 * badge drawn) · nothing unread (zero, no badge drawn). No loading or error state of its own: an unknown count draws
 * the bell alone, which still opens the panel.
 */
export interface NotificationBellProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** The button's accessible name, count included — localized by the caller. */
  readonly label: string;
  /** Notices unread; `null` while unknown. Zero draws no badge. */
  readonly count: number | null;
}

export function NotificationBell({ label, count, className, ...rest }: NotificationBellProps) {
  return (
    <button type="button" {...rest} className={[styles.bell, className].filter(Boolean).join(' ')}>
      <Bell aria-hidden="true" className={styles.glyph} />
      <span className={styles.assistive}>{label}</span>
      {count !== null && count > 0 ? (
        <span className={styles.count}>
          <Badge tone={BADGE_TONE.QUIET} count={count} />
        </span>
      ) : null}
    </button>
  );
}
