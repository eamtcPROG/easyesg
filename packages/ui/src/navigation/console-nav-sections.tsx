import { useId } from 'react';
import { Anchor } from './nav-link';
import { ARIA_CURRENT } from './nav-link-vocabulary';
import type { ConsoleNavItem, ConsoleNavItemState, ConsoleNavProps } from './console-nav-types';
import styles from './console-nav.module.css';

/**
 * The console navigation's headed sections — what the side column draws at `wide` and the drawer
 * draws below it (task 170). **One rendering for both**, so the two frames cannot disagree about which
 * destination is current or how a section is named: each list is labelled by its heading, and the
 * active item's anchor carries `aria-current`.
 *
 * Not in the barrel: it is a part of `ConsoleNav` and `ConsoleDrawer`, not an inventory entry.
 */
export function ConsoleNavSections<TItem extends ConsoleNavItem>({
  sections,
  isActive,
  renderItem,
  linkComponent,
}: Omit<ConsoleNavProps<TItem>, 'label'>) {
  const id = useId();
  const Link = linkComponent ?? Anchor;

  return sections
    .filter((section) => section.items.length > 0)
    .map((section) => {
      const headingId = `${id}-${section.key}`;

      return (
        <div key={section.key} className={styles.section}>
          <p id={headingId} className={styles.heading}>
            {section.heading}
          </p>
          <ul className={styles.list} aria-labelledby={headingId}>
            {section.items.map((item) => {
              const active = isActive(item);
              // Built once and handed to both paths, so the default rendering and a `renderItem`
              // one cannot disagree about what "current" means on the wire.
              const state: ConsoleNavItemState = {
                isActive: active,
                linkProps: active ? { 'aria-current': ARIA_CURRENT.PAGE } : {},
              };

              return (
                <li key={item.key} className={active ? styles.current : styles.item}>
                  {renderItem ? (
                    renderItem(item, state)
                  ) : (
                    <Link href={item.href} {...state.linkProps}>
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      );
    });
}
