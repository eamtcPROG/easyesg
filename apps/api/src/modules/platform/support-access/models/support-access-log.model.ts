/**
 * `audit.support_access_log`'s two vocabularies (FR-79, NFR-66; §9.2) — owned by this module because
 * the log is, though task 67.3 wrote its first rows from `infrastructure/persistence/admin-readonly.ts`.
 *
 * The migration's `CHECK` on `entry_kind` is the database's copy of the first object and changes
 * with it by hand, per the root file's migration-SQL exception. `purpose` carries no `CHECK`, so the
 * second object is the only place its spelling is true.
 */

/**
 * What kind of row this is. **The grant half arrived with task 67.9** in the same table, as the project
 * owner decided on 13 Sep 2026: a request and every answer to it are rows, and a request's state is folded
 * from them (`domain/support-access-request.ts`) rather than stored.
 */
export const SUPPORT_ACCESS_ENTRY_KIND = {
  /** One use of `esg_admin_ro`, the `BYPASSRLS` role — logged before the read runs (§7.6). */
  ACQUISITION: 'acquisition',
  /** A Platform Administrator asked an organization for read-only access, with a ticket and a reason. */
  REQUEST: 'request',
  /** An Organization Administrator granted a request: 60 minutes of read-only access begin. */
  GRANT: 'grant',
  /** An Organization Administrator declined a request. */
  DECLINE: 'decline',
  /** A running grant ended early — by an Organization Administrator or a Platform Administrator. */
  END: 'end',
  /** One read under a grant — FR-79's *what was accessed* — logged before it runs. */
  ACCESS: 'access',
} as const;

export type SupportAccessEntryKind =
  (typeof SUPPORT_ACCESS_ENTRY_KIND)[keyof typeof SUPPORT_ACCESS_ENTRY_KIND];

/** What an acquisition read — FR-79's *"what was accessed"*, one member per read path. */
export const ACQUISITION_PURPOSE = {
  /** A-02's register: account-level metadata across every organization (FR-76). */
  ORGANIZATION_REGISTER: 'organization_register',
  /** A-08's read of `audit.system_audit_log` (task 67.4) — platform rows `esg_app` cannot see. */
  SYSTEM_AUDIT_LOG: 'system_audit_log',
  /** A-07's log and A-08's per-operator count (task 67.9) — every organization's requests at once. */
  SUPPORT_ACCESS_LOG: 'support_access_log',
} as const;

export type AcquisitionPurpose = (typeof ACQUISITION_PURPOSE)[keyof typeof ACQUISITION_PURPOSE];

/**
 * What a read under a grant opened — an `access` row's `purpose` (task 67.9), with the report or the report
 * and module in its `subject`. One member per read path, `ACQUISITION_PURPOSE`'s rule.
 */
export const SUPPORT_ACCESS_READ_PURPOSE = {
  /** The organization's report list. */
  REPORTS: 'reports',
  /** One report's modules, with how much of each is answered. */
  REPORT_MODULES: 'report_modules',
  /** One module of one report, with its values. */
  REPORT_MODULE: 'report_module',
} as const;

export type SupportAccessReadPurpose =
  (typeof SUPPORT_ACCESS_READ_PURPOSE)[keyof typeof SUPPORT_ACCESS_READ_PURPOSE];
