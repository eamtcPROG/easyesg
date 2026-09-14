import type { SystemAuditLogPage, SystemAuditLogQuery } from '../models/system-audit-log.model';

/**
 * A-08's read of the system audit log (task 67.4; UC-88). The writer is `SYSTEM_AUDIT_LOG` in
 * `contracts/`, used everywhere; this reader has one consumer and lives with it.
 *
 * **The operator is part of the read, not of the query**: the adapter reads through `esg_admin_ro`,
 * and every acquisition of that role is logged against who asked (§7.6) — so a read that could not
 * name its requester could not be made.
 */
export interface SystemAuditLogRead {
  readonly requesterId: string;
  readonly query: SystemAuditLogQuery;
}

export interface SystemAuditLogReader {
  list(read: SystemAuditLogRead): Promise<SystemAuditLogPage>;
}

export const SYSTEM_AUDIT_LOG_READER = Symbol('SYSTEM_AUDIT_LOG_READER');
