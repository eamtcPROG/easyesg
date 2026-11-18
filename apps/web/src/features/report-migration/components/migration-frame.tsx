import { MAIN_CONTENT_ID } from '@easyesg/ui';
import type { ReactNode } from 'react';
import styles from './migration.module.css';

/**
 * S-49's frame (task 67.20): the report's bar above, then the one `<main>` — the skip link's target — holding a column
 * at the Focus card's measure. **This app's** (UX-89 as amended): S-11's frame's arrangement, one card wide.
 */
export function MigrationFrame({ bar, children }: { readonly bar: ReactNode; readonly children: ReactNode }) {
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
