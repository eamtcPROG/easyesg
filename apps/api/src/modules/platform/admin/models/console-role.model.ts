/**
 * The console's role-based access control (task 67.13; FR-80 behaviour 10, UC-87; 182/3; `architecture.md` §12.5.6's
 * task-67.13 row).
 *
 * **A permission is the unit** — one per guarded action or screen capability — and a route declares the one it needs
 * with `@RequiresAdminPermission`. **A role is a named set of permissions, and the set is code**, so what a role can do
 * changes only by a reviewed release (row (2)); **who holds a role is data**, `identity.admin_console_role`, assigned on
 * A-08. FR-80's separation of content, operations and support is the catalogue below: a content role holds no
 * operations or support permission, and none of the five needs another's to do its work.
 *
 * **The realm is still the realm** (NFR-65): a Billing Operator holds no console role, and its authority is the realm's
 * until task 68 decides the billing screens' permissions (row (3)). `packages/contracts/src/admin.ts` mirrors both
 * vocabularies for the console, held to the generated contract at compile time.
 */
export const ADMIN_PERMISSION = {
  /** A-02's register and an organization's record — its people and entities, never report content (D-5). */
  ORGANIZATIONS_READ: 'organizations.read',
  /** One person's phone on A-02's record (task 167). */
  MEMBER_PHONE_DISCLOSE: 'organizations.member_phone.disclose',
  /** A locked member released on A-02's record (task 67.12). */
  MEMBER_LOCKOUT_RELEASE: 'organizations.member_lockout.release',
  /** A-07's requests in progress and its log. */
  SUPPORT_ACCESS_READ: 'support_access.read',
  /** A-07's request, its early end, and the reports read under a grant. */
  SUPPORT_ACCESS_REQUEST: 'support_access.request',
  /** A-08's accounts and invitations. */
  ACCOUNTS_READ: 'accounts.read',
  /** Inviting, resending, revoking, suspending, reactivating, removing and an operator's lockout release. */
  ACCOUNTS_MANAGE: 'accounts.manage',
  /** Changing which roles an account holds (FR-80 behaviour 10). */
  ACCOUNT_ROLES_ASSIGN: 'accounts.roles.assign',
  /** A-08's system audit log (FR-81). */
  AUDIT_LOG_READ: 'audit_log.read',
  /** A-18's identity providers. */
  IDENTITY_PROVIDERS_MANAGE: 'identity_providers.manage',
  /** A-17's notification categories. */
  NOTIFICATION_CATEGORIES_MANAGE: 'notification_categories.manage',
  /** A-21's platform operator. */
  LEGAL_CONTROLLER_MANAGE: 'legal_controller.manage',
  /** A-03's drafts and their review (task 67.5). */
  CONTENT_EDIT: 'content.edit',
  /** A-03's publication of a reviewed set, its sign-off and its revert (task 67.5). */
  CONTENT_PUBLISH: 'content.publish',
  /** A-04's versions, mappings and the exposure view (tasks 67.6, 67.21, 67.22). */
  TAXONOMY_MANAGE: 'taxonomy.manage',
  /** A-04's migration runs (tasks 67.7, 67.23). */
  MIGRATION_RUNS_MANAGE: 'taxonomy.migration_runs.manage',
  /** A-05's factor sets, thresholds and validation rules (task 67.8). */
  RULES_MANAGE: 'rules.manage',
} as const;

export type AdminPermission = (typeof ADMIN_PERMISSION)[keyof typeof ADMIN_PERMISSION];

export const isAdminPermission = (value: unknown): value is AdminPermission =>
  typeof value === 'string' && (Object.values(ADMIN_PERMISSION) as readonly string[]).includes(value);

/** The first role catalogue (row (2)) — the `admin_console_role_known` CHECK's vocabulary. */
export const CONSOLE_ROLE = {
  ACCOUNT_ADMINISTRATION: 'account_administration',
  SUPPORT: 'support',
  OPERATIONS: 'operations',
  CONTENT_AUTHOR: 'content_author',
  CONTENT_PUBLISHER: 'content_publisher',
} as const;

export type ConsoleRole = (typeof CONSOLE_ROLE)[keyof typeof CONSOLE_ROLE];

/** `isAdminRole`'s reason: an unknown value is refused, never mapped to a member. */
export const isConsoleRole = (value: unknown): value is ConsoleRole =>
  typeof value === 'string' && (Object.values(CONSOLE_ROLE) as readonly string[]).includes(value);

/**
 * What each role holds. A `Record` over the vocabulary, so a role added without its permissions does not compile.
 * Accounts administration reads the log, because who did what is how an account's roles are reviewed; support reads
 * organizations, because its every act starts on one.
 */
export const CONSOLE_ROLE_PERMISSIONS: Readonly<Record<ConsoleRole, readonly AdminPermission[]>> = {
  [CONSOLE_ROLE.ACCOUNT_ADMINISTRATION]: [
    ADMIN_PERMISSION.ACCOUNTS_READ,
    ADMIN_PERMISSION.ACCOUNTS_MANAGE,
    ADMIN_PERMISSION.ACCOUNT_ROLES_ASSIGN,
    ADMIN_PERMISSION.AUDIT_LOG_READ,
  ],
  [CONSOLE_ROLE.SUPPORT]: [
    ADMIN_PERMISSION.ORGANIZATIONS_READ,
    ADMIN_PERMISSION.MEMBER_PHONE_DISCLOSE,
    ADMIN_PERMISSION.MEMBER_LOCKOUT_RELEASE,
    ADMIN_PERMISSION.SUPPORT_ACCESS_READ,
    ADMIN_PERMISSION.SUPPORT_ACCESS_REQUEST,
  ],
  [CONSOLE_ROLE.OPERATIONS]: [
    ADMIN_PERMISSION.IDENTITY_PROVIDERS_MANAGE,
    ADMIN_PERMISSION.NOTIFICATION_CATEGORIES_MANAGE,
    ADMIN_PERMISSION.LEGAL_CONTROLLER_MANAGE,
    ADMIN_PERMISSION.TAXONOMY_MANAGE,
    ADMIN_PERMISSION.MIGRATION_RUNS_MANAGE,
    ADMIN_PERMISSION.RULES_MANAGE,
  ],
  [CONSOLE_ROLE.CONTENT_AUTHOR]: [ADMIN_PERMISSION.CONTENT_EDIT],
  [CONSOLE_ROLE.CONTENT_PUBLISHER]: [ADMIN_PERMISSION.CONTENT_EDIT, ADMIN_PERMISSION.CONTENT_PUBLISH],
};

/** Every permission the roles hold together, each once, in the vocabulary's order. */
export const permissionsOf = (roles: readonly ConsoleRole[]): readonly AdminPermission[] => {
  const held = new Set(roles.flatMap((role) => CONSOLE_ROLE_PERMISSIONS[role]));
  return Object.values(ADMIN_PERMISSION).filter((permission) => held.has(permission));
};

/** The roles in the vocabulary's order, each once — how a set is stored, compared and answered. */
export const orderedConsoleRoles = (roles: readonly ConsoleRole[]): readonly ConsoleRole[] => {
  const given = new Set(roles);
  return Object.values(CONSOLE_ROLE).filter((role) => given.has(role));
};
