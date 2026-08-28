'use client';

import { AccessConfirmation } from './access-confirmation';
import { AccessFilters } from './access-filters';
import { AccessList } from './access-list';
import { AccessNotice } from './access-notice';
import { useAccess } from './access-context';
import styles from './access.module.css';

/**
 * S-16's Index body — filter, sort, table, row action, pager (§4.6).
 *
 * **The server does the work; this changes the address.** Filtering, sorting and paging all happen
 * in the read model on the server, from `searchParams`; every control here writes the URL and lets
 * the page re-render. That is UX-4 taken literally — a filtered list can be linked, bookmarked and
 * reloaded — and it is why this island holds no copy of the rows and no derived state to keep in
 * step with them.
 *
 * The file is a composition and nothing else. Each region owns one question and reads what it needs
 * from `useAccess()`; the alternative, which this replaced, was one component holding every piece of
 * state and threading callbacks down through a table's column definitions into its cells.
 *
 * **It is the list half only, and it no longer owns the provider** (28 Aug 2026). `AccessProvider`
 * wraps both this and the invite panel, from the page, because the panel joined the same single
 * notice. A provider that wrapped only this region is precisely what let that panel keep an
 * outcome of its own, outside the reducer that clears one when the next action starts.
 */
export function AccessBoard() {
  const { navigating } = useAccess();

  return (
    <div className={styles.board} aria-busy={navigating}>
      <AccessNotice />
      <AccessFilters />
      <AccessList />
      <AccessConfirmation />
    </div>
  );
}
