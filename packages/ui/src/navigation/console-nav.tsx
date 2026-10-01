import { ConsoleNavSections } from './console-nav-sections';
import type { ConsoleNavItem, ConsoleNavProps } from './console-nav-types';
import styles from './console-nav.module.css';

/**
 * Console nav — §11.5's Navigation entry for the administrative console (task 67.1), drawn on every
 * signed-in frame of `EasyESG Admin Console Screens.dc.html`: a dark column of headed sections, the
 * current destination marked by a left rule, a surface and a weight.
 *
 * **A row of its own rather than a `WorkspaceNav` variant**, because the anatomy differs — headed
 * sections, a vertical list, and a count beside a destination that the artboard fills with
 * exception-queue badges — which is UX-89's test rather than a skin. It keeps `WorkspaceNav`'s API on
 * purpose (task 105's lesson): items are data, `isActive` is the consumer's predicate, the link is
 * injected, and **this component builds the anchor**, so `aria-current` is structural rather than a
 * convention each caller re-remembers.
 *
 * **Each list is named by its heading**, through `aria-labelledby`, so a screen reader moving by list
 * hears *Platform* or *Billing* rather than an anonymous run of links.
 *
 * **Drawn at `wide` and above only, since task 170** (UX-77 as amended): below 64rem the column is not
 * drawn and `ConsoleDrawer` — a menu control in the bar — opens the same sections, through the same
 * `ConsoleNavSections`, so the two frames cannot disagree about which destination is current.
 *
 * States (§8.1, the applicable subset): rest · hover · focus · **current** · **empty**. A section with
 * no destinations is not drawn, and a navigation with none renders nothing — the console's state until
 * its first screen ships (`design_spec.md` §5.2: the chrome carries what renders). There is no
 * disabled state: a destination an operator may not enter is absent, as `WorkspaceNav`'s are (UX-1).
 *
 * Its props and data are `console-nav-types.ts`'s, which the part and the drawer read too — so the
 * part never imports back from the component that draws it.
 */
export function ConsoleNav<TItem extends ConsoleNavItem = ConsoleNavItem>({
  label,
  sections,
  isActive,
  renderItem,
  linkComponent,
}: ConsoleNavProps<TItem>) {
  if (sections.every((section) => section.items.length === 0)) return null;

  return (
    <nav className={styles.nav} aria-label={label}>
      <ConsoleNavSections
        sections={sections}
        isActive={isActive}
        renderItem={renderItem}
        linkComponent={linkComponent}
      />
    </nav>
  );
}
