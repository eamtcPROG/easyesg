/**
 * `audit.support_access_log`'s two vocabularies (FR-79, NFR-66; §9.2) — owned by this module because
 * the log is, though task 67.3 wrote its first rows from `infrastructure/persistence/admin-readonly.ts`.
 *
 * The migration's `CHECK` on `entry_kind` is the database's copy of the first object and changes
 * with it by hand, per the root file's migration-SQL exception. `purpose` carries no `CHECK`, so the
 * second object is the only place its spelling is true.
 */

/**
 * What kind of row this is. **Acquisition only, until task 67.9** adds the grant half — a time-boxed
 * support-access grant (UC-85) — to the same table (project owner, 13 Sep 2026).
 */
export const SUPPORT_ACCESS_ENTRY_KIND = {
  /** One use of `esg_admin_ro`, the `BYPASSRLS` role — logged before the read runs (§7.6). */
  ACQUISITION: 'acquisition',
} as const;

export type SupportAccessEntryKind =
  (typeof SUPPORT_ACCESS_ENTRY_KIND)[keyof typeof SUPPORT_ACCESS_ENTRY_KIND];

/** What an acquisition read — FR-79's *"what was accessed"*, one member per read path. */
export const ACQUISITION_PURPOSE = {
  /** A-02's register: account-level metadata across every organization (FR-76). */
  ORGANIZATION_REGISTER: 'organization_register',
  /** A-08's read of `audit.system_audit_log` (task 67.4) — platform rows `esg_app` cannot see. */
  SYSTEM_AUDIT_LOG: 'system_audit_log',
} as const;

export type AcquisitionPurpose = (typeof ACQUISITION_PURPOSE)[keyof typeof ACQUISITION_PURPOSE];
