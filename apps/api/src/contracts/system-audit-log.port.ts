/**
 * Writing a platform event to `audit.system_audit_log` (FR-81, FR-159; task 28.4).
 *
 * **In `contracts/` rather than inside `platform/audit`, because the log's writers are everywhere
 * and its owner is one module.** `platform/admin` writes sign-in events today; task 67.4's
 * `AuditInterceptor` adds the rest of FR-159, and 67's console screens add version rollouts,
 * content publications, migration runs and factor-set updates. A port every module reaches for is
 * what this directory is (P-7), and the alternative — each writer importing `platform/audit` —
 * would make the audit module a dependency of half the tree to gain nothing.
 *
 * **One method, and it is `record`, not `save`.** An audit write is a statement that something
 * happened; the caller has no decision left to make about it and no result to branch on.
 */

/**
 * A platform-level event. Deliberately **not** a tenant one: `organization_id` is left NULL by the
 * adapter and the table's own `system_audit_log_platform_insert` policy refuses the row unless no
 * organization is bound, so a tenant request cannot forge one (task 14's migration argues it).
 */
export interface SystemAuditEvent {
  /** A member of a closed vocabulary — see `platform/audit/models/audit-action.model.ts`. */
  readonly action: string;

  /**
   * Who acted, where that resolved. Null for an attempt against an address matching no account —
   * which is precisely the case `subject` exists for.
   *
   * No foreign key backs it (task 14's reasoning for `core.field_change`, and the same here):
   * historical attribution must survive the removal of the account it names.
   */
  readonly actorId?: string | null;

  /**
   * **A digest, never an address** — the SHA-256 of the normalised identifier the caller presented
   * (§12.5.6's admin-sign-in row). It answers "every attempt against this address" without the
   * table, which is append-only and retained 24 months, ever holding personal data.
   *
   * Build it with `auditSubject`; passing a hash computed any other way silently breaks the
   * grouping this column exists for.
   */
  readonly subject?: Buffer | null;
}

export interface SystemAuditLog {
  /**
   * Records the event, **committing independently of whatever the caller is doing**.
   *
   * That is the contract and not an implementation note. Every interesting sign-in event is a
   * *failure*, and a failure throws — so a write enlisted in the caller's transaction would be
   * rolled back by the very refusal it exists to record. It is the shape `SignIn`'s throttle
   * counters already take, stated here because a later adapter that "tidied" this into the ambient
   * transaction would erase exactly the rows an operator opens the log for, and no test asserting a
   * successful sign-in would notice.
   */
  record(event: SystemAuditEvent): Promise<void>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const SYSTEM_AUDIT_LOG = Symbol('SYSTEM_AUDIT_LOG');
