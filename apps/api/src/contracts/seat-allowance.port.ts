/**
 * The interim seat ceiling's source (task 142; `architecture.md` §12.5.6's task-142 row).
 *
 * **One function, and it is here so that task 54.2 can delete what stands behind it.** Until AD-5's
 * entitlement service exists, the ceiling is the `seat_allowance` configuration artefact — which is
 * configuration and not an entitlement (DR-1): routed through billing, `BILLING_ENABLED=false` could
 * no longer serve UC-17 … UC-48. When 54.2 lands, the implementation becomes a call to
 * `EntitlementPort.check` for `org.seats.max`, the artefact and its AD-4 row are deleted, and **no
 * call site moves for a ceiling that is a number** — which is the reason this is a port rather than a
 * direct read of the configuration store in `IssueInvitation` and `AcceptInvitation`. AD-5 also
 * answers *grants everything* (billing off) and *allow granted keys* (billing unreachable), which
 * `null` here cannot express; how 54.2 represents those is a recorded deferral (§12.5.6's task-142
 * row, point (c)), not something this signature has settled.
 *
 * **It is not a second entitlement service and must not grow into one.** A method per quota here
 * would make NFR-17 false by construction, which is the argument AD-5 already made against a method
 * per feature. Seats are the one ceiling Stage 1 needs; anything else waits for the real service.
 *
 * In `contracts/` because two modules read it — `identity/invitation` gates on it and
 * `identity/access` publishes it — and because 54.2's implementation will live in the billing
 * context, which the compliance core may reach only through this directory.
 */

export interface SeatAllowanceQuery {
  /**
   * The organization asking. **The configured source ignores it** — one `global` value (§12.5.6,
   * decided 13 Sep 2026) — and it is on the query anyway because `EntitlementQuery` needs it, so
   * task 54.2's swap changes an implementation rather than a signature every caller shares.
   */
  readonly organizationId: string;
}

export interface SeatAllowance {
  /**
   * The organization's ceiling on active members plus pending invitations, or **null when it cannot
   * be read**.
   *
   * Null is not "unlimited", and no caller may read it that way: the ceiling fails **closed**
   * (§12.5.6), so a caller that meets null refuses the write it was guarding. A missing ceiling is
   * exactly the false claim task 142 exists to remove, and a silent default would reinstate it.
   */
  allowanceFor(query: SeatAllowanceQuery): Promise<number | null>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const SEAT_ALLOWANCE = Symbol('SEAT_ALLOWANCE');
