'use client';

import { AccessConfirmation } from '../regions/access-confirmation';
import { AccessFilters } from '../regions/access-filters';
import { AccessList } from '../list/access-list';
import { AccessNotice } from '../regions/access-notice';
import { InviteButton } from '../regions/invite-button';
import { useAccess } from '../../shared/access-context';
import styles from '../../styles/access.module.css';

/**
 * S-16's Index body — filter, sort, table, row action, pager (§4.6), and since 28 Sep 2026 the button
 * that opens the invitation dialogue, at the end of the filter row.
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
 * wraps both this and the invitation, from the page, because the invitation joined the same single
 * notice. A provider that wrapped only this region is precisely what let the invitation — a panel
 * then — keep an outcome of its own, outside the reducer that clears one when the next action starts.
 */
export function AccessBoard() {
  const { navigating } = useAccess();

  return (
    <div className={styles.board} aria-busy={navigating}>
      <AccessNotice />
      <div className={styles.toolbar}>
        <AccessFilters />
        <InviteButton />
      </div>
      <AccessList />
      <AccessConfirmation />
    </div>
  );
}
