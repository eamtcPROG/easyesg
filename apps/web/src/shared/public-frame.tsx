import type { ReactNode } from 'react';
import { PublicFooter } from './public-footer';
import { PublicHeader } from './public-header';
import styles from './public-frame.module.css';

/**
 * The public chrome around a page — the band, the page, the footer — read by two layouts: `(public)`'s, which draws it on
 * every screen of the tier, and since task 77 `(help)`'s, which draws it for a reader with no session (§12.5.6's task-77
 * row (10)). **Here rather than in either layout** because a frame composed twice is two frames free to drift, and a
 * route file holds no component (UX-89). It reads nothing: §5.1b's public screens carry no session.
 */
export function PublicFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
