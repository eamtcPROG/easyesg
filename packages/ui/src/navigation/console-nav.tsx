'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState } from 'react';
import { ConsoleNavSections } from './console-nav-sections';
import type { ConsoleNavItem, ConsoleSidebarProps } from './console-nav-types';
import styles from './console-nav.module.css';
import { useBelowWide } from './use-below-wide';

/**
 * Console nav — §11.5's Navigation entry for the administrative console (task 67.1): the console's sidebar, on its
 * dark surface, of headed sections, each destination an icon and its label, the current one filled, bold and marked
 * by the accent rule.
 *
 * **A collapsible sidebar since 25 Oct 2026** (project owner, from a mock-up beside the column it replaced; UX-77 as
 * amended that day). At `wide` it is the full 240px sidebar beside the page, and its foot folds it to a 64px icon
 * strip and back — `collapsed` is the operator's choice, which the consumer keeps. From `medium` to `wide` the strip is
 * the resting state, and the foot lays the full sidebar over the page, under the band, folding back when a destination
 * is chosen. Below `medium` it is not drawn: `ConsoleDrawer`'s control in the band opens the same sections.
 *
 * **In the strip a destination's label stands beside it on hover and focus**, and is its accessible name throughout —
 * the one span, drawn as a label or as that note, so the strip names nothing a screen reader does not hear. A section's
 * heading still names its list, and a short rule stands for it on screen.
 *
 * **A row of its own rather than a `WorkspaceNav` variant**, because the anatomy differs — headed sections, a vertical
 * list, and a count beside a destination that the artboard fills with exception-queue badges — which is UX-89's test
 * rather than a skin. It keeps `WorkspaceNav`'s API on purpose (task 105's lesson): items are data, `isActive` is the
 * consumer's predicate, the link is injected, and **this component builds the anchor**, so `aria-current` is
 * structural rather than a convention each caller re-remembers.
 *
 * **Each list is named by its heading**, through `aria-labelledby`, so a screen reader moving by list hears *Platform*
 * or *Billing* rather than an anonymous run of links.
 *
 * States (§8.1, the applicable subset): rest · hover · focus · **current** · **full** · **strip** · **over the page** ·
 * **empty**. A section with no destinations is not drawn, and a navigation with none renders nothing. There is no
 * disabled state: a destination an operator may not enter is absent, as `WorkspaceNav`'s are (UX-1).
 *
 * `'use client'` for the overlay's open state and the frame's width; its props and data are `console-nav-types.ts`'s,
 * which the part and the drawer read too — so the part never imports back from the component that draws it.
 */
export function ConsoleNav<TItem extends ConsoleNavItem = ConsoleNavItem>({
  label,
  sections,
  isActive,
  renderItem,
  linkComponent,
  collapsed,
  onCollapsedChange,
  collapseLabel,
  expandLabel,
}: ConsoleSidebarProps<TItem>) {
  const belowWide = useBelowWide();
  const [over, setOver] = useState(false);

  if (sections.every((section) => section.items.length === 0)) return null;

  const drawn = (
    <div className={styles.sections}>
      <ConsoleNavSections
        sections={sections}
        isActive={isActive}
        renderItem={renderItem}
        linkComponent={linkComponent}
      />
    </div>
  );

  return (
    <nav className={styles.nav} data-strip={belowWide || collapsed} aria-label={label}>
      {drawn}
      <div className={styles.foot}>
        {belowWide ? (
          <Dialog.Root open={over} onOpenChange={setOver}>
            <Dialog.Trigger className={styles.toggle}>
              <PanelLeftOpen aria-hidden="true" className={styles.icon} />
              <span className={styles.label}>{expandLabel}</span>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className={styles.scrim} />
              <Dialog.Content
                className={styles.over}
                aria-describedby={undefined}
                // `ConsoleDrawer`'s delegated close: an anchor navigates without unmounting anything, so the sidebar
                // would stand over the new screen.
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('a')) setOver(false);
                }}
              >
                {/* Required by Radix and hidden by design: the navigation inside it carries the same name. */}
                <Dialog.Title className={styles.hidden}>{label}</Dialog.Title>
                <nav className={styles.nav} data-strip={false} aria-label={label}>
                  {drawn}
                  <div className={styles.foot}>
                    <Dialog.Close className={styles.toggle}>
                      <PanelLeftClose aria-hidden="true" className={styles.icon} />
                      <span className={styles.label}>{collapseLabel}</span>
                    </Dialog.Close>
                  </div>
                </nav>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        ) : (
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={!collapsed}
            onClick={() => onCollapsedChange(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className={styles.icon} />
            ) : (
              <PanelLeftClose aria-hidden="true" className={styles.icon} />
            )}
            <span className={styles.label}>{collapsed ? expandLabel : collapseLabel}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
