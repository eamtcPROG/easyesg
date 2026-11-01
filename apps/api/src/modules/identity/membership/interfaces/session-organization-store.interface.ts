/**
 * Where a session is pointed at an organization — UC-16's *switch* half (FR-12; task 83.1).
 *
 * **A port of its own rather than a method on `AccountMembershipStore`**, whose reader lists
 * memberships and never writes a session (the interface-segregation rule the port surface keeps).
 * What the two share is the transaction discipline, and the reason is the same one: this runs with
 * the request's tenant possibly bound to the organization being *left*, and while an organization is
 * bound only its own memberships are readable (task 130). On the request's runner the check below
 * would see no membership anywhere else, and every switch away from the current organization would
 * be refused. So the adapter opens its own transaction and binds only `app.current_user`.
 */
export interface SessionOrganizationStore {
  /**
   * Points the session at `organizationId` **only where the account holds an active membership in
   * it**, and answers whether it did.
   *
   * **The write is the check, in one statement.** A membership never held, one held as `removed`,
   * and an id naming no organization all leave the session untouched and answer `false` — one
   * answer, because telling them apart would say which organization ids exist. A read followed by a
   * write would leave a removal free to land between the two; the read side already degrades a
   * choice that goes stale afterwards (`selectActiveMembership`), so the one statement is what keeps
   * this side from *making* one.
   *
   * `accountId` is in the predicate as well as the binding: `identity.session` carries no row
   * security, so it is the only thing keeping the write to a session the account owns.
   */
  pointSessionAt(input: {
    readonly sessionId: string;
    readonly accountId: string;
    readonly organizationId: string;
  }): Promise<boolean>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const SESSION_ORGANIZATION_STORE = Symbol('SESSION_ORGANIZATION_STORE');
