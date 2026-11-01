import { MAIN_CONTENT_ID } from '@easyesg/ui';
import type { ReactNode } from 'react';
import styles from '../styles/exports.module.css';

/**
 * S-11's frame (task 47.3): the bar above, then the one `<main>` — the skip link's target — scrolling beneath it at the
 * content's width. **This app's, not the inventory's** (UX-89 as amended): the Panel and Index archetypes it holds are
 * the inventory's; the column that stacks them under a wizard's bar is S-11's alone.
 */
export function ExportsFrame({ bar, children }: { readonly bar: ReactNode; readonly children: ReactNode }) {
  return (
    <div className={styles.shell}>
      {bar}
      {/* `tabIndex={-1}` is what lets the skip link give it focus. */}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.body}>
        <div className={styles.column}>{children}</div>
      </main>
    </div>
  );
}
