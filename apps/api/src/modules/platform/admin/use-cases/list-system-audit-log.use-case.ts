import type {
  SystemAuditLogRead,
  SystemAuditLogReader,
} from '../interfaces/system-audit-log-reader.interface';
import type { SystemAuditLogPage } from '../models/system-audit-log.model';

/**
 * UC-88 — A-08's log (task 67.4; FR-81): the platform-wide record of what was done, by whom, to what,
 * newest first, one page at a time.
 *
 * A thin use case on purpose, like `ListOrganizationRegister`: the filters are narrowed before this
 * (`system-audit-log-query.ts`), and the read's one rule — that it acquires `esg_admin_ro` and is
 * logged against its requester — belongs to the adapter that holds the role. The seam is here so a
 * later task that joins another table's events composes them without the controller learning of it.
 */
export class ListSystemAuditLog {
  constructor(private readonly reader: SystemAuditLogReader) {}

  execute(read: SystemAuditLogRead): Promise<SystemAuditLogPage> {
    return this.reader.list(read);
  }
}
