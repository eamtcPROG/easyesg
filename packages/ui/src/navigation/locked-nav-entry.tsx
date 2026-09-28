import { Lock } from 'lucide-react';
import styles from './locked-nav-entry.module.css';

/**
 * A navigation destination the reader's role may not open — its name, a lock, and nothing to follow
 * (task 173, project owner, 28 Sep 2026; `design_spec.md` §4.2's amendment of that date).
 *
 * **Shown locked rather than left out, which is the owner's choice between the two.** An editor or a
 * viewer still sees that *Organization* and *Users & access* exist, and that they are not theirs; the
 * boundary itself is still the api's, and a typed address still meets the screen's own permission
 * state. **No visible reason, also by that choice**: the lock is the whole of what a sighted reader is
 * told, and `note` is what a screen reader hears after the name — localized by the caller, since this
 * package owns no text (UX-79).
 *
 * **One part for three surfaces**, which is why it is an inventory entry rather than a branch inside
 * each: `WorkspaceNav`'s band and `ChromeDrawer`'s panel draw it, and so does `apps/web`'s account
 * rail, which cannot draw the glyph itself — the icon set is this package's alone (`architecture.md`
 * §12.1). `className` carries the surface's own row metrics; the locked look is this module's.
 *
 * **ARIA's disabled link**: `role="link"` with `aria-disabled` and no `href`, so a screen reader lists
 * it among the links as unavailable, and it is not in the tab order — there is nothing it would do.
 *
 * States (§8.1, the applicable subset): rest only. There is no hover, focus or current state, because
 * nothing can be pressed.
 */
export interface LockedNavEntryProps {
  /** The destination's name, as the surface draws it when open. */
  readonly label: string;
  /** What assistive technology hears after the name — *"(administrators only)"* — localized by the caller. */
  readonly note: string;
  /** The surface's own row metrics — padding, type — so the entry lines up with its open siblings. */
  readonly className?: string;
}

export function LockedNavEntry({ label, note, className }: LockedNavEntryProps) {
  return (
    <span
      role="link"
      aria-disabled="true"
      className={className ? `${styles.entry} ${className}` : styles.entry}
    >
      {label} <span className={styles.note}>{note}</span>
      <Lock aria-hidden="true" className={styles.glyph} />
    </span>
  );
}
