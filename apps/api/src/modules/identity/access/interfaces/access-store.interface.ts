import type { AccessPage, AccessQuery } from '../models/access.model';

/**
 * The `identity/access` store — S-16's union, read as one page.
 *
 * **No `run()`, and no organization parameter**, for the reasons `MembershipStore` states: this is
 * tenant data, so AD-14 constraint 2 puts the query on the **request's** `QueryRunner` — the one
 * carrying `app.current_org`, without which RLS returns zero rows rather than an error. A method
 * taking an organization id would be the second, contradictory source of tenancy AD-2 and UX-2
 * forbid.
 *
 * **The list answers with counts as well as rows.** Splitting "the page" from "how many matched"
 * would be two statements that can disagree — a row removed between them makes a pager offer a page
 * that is no longer there.
 */
export interface AccessStore {
  /** UC-59 (FR-56) — the merged list, filtered, ordered and windowed in the database. */
  listAccess(query: AccessQuery): Promise<AccessPage>;

  /**
   * Task 142 — seats held: active members plus every pending invitation, lapsed included. The same
   * statement `IssueInvitation` and `AcceptInvitation` gate on, so S-16's region and the refusal cannot disagree;
   * and the same rows `listAccess` counts as `total`, which `test/seats.e2e-spec.ts` holds equal.
   */
  countSeatsHeld(): Promise<number>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const ACCESS_STORE = Symbol('ACCESS_STORE');
