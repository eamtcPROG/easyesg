import type { AccountMembership } from '../models/membership.model';

/**
 * The *account's* side of membership — a second port beside `MembershipStore`, and the split is a
 * difference in transaction discipline rather than in subject matter.
 *
 * `MembershipStore` is tenant data read on the **request's** `QueryRunner`, with `app.current_org`
 * already bound. This one is read **before any tenant exists**: `AuthGuard` calls it to work out
 * which organization to bind, so by definition none is bound yet, and `TenantTransactionGuard`
 * has correctly opened no transaction. It therefore opens its own, binding only `app.current_user`
 * — which is what `membership_self_select` and `organization_directory_select` both read.
 *
 * Two ports rather than one method added to the first, because an adapter that sometimes borrows
 * the request transaction and sometimes opens its own is a Liskov violation with a very quiet
 * failure: the borrowed case would find `app.current_org` bound, and
 * `organization_directory_select`'s first conjunct would then be false, so the names would silently
 * disappear for exactly the callers that already had a tenant.
 */
export interface AccountMembershipStore {
  /**
   * Every organization this account is an **active** member of, with the organization's name and
   * the role held in it, ordered by name.
   *
   * The account id is bound as `app.current_user` rather than compared in a `WHERE` clause — the
   * policies are what scope the read, exactly as `MembershipStoreRepository` names no organization.
   * A caller belonging to nothing gets an empty list, which is a real answer: it is what tells
   * task 25.4 to send them to S-04.
   */
  listForAccount(accountId: string): Promise<AccountMembership[]>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const ACCOUNT_MEMBERSHIP_STORE = Symbol('ACCOUNT_MEMBERSHIP_STORE');
