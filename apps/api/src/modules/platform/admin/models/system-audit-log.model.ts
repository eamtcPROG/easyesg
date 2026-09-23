import type { SocialProvider } from '@api/contracts/identity-provider.port';
import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { AuditAction } from '@api/modules/platform/audit/models/audit-action.model';

/**
 * A-08's reading of `audit.system_audit_log` (task 67.4; UC-88, FR-81). The writing side is the port
 * in `contracts/`; this is what a Platform Administrator is shown, which is narrower — named parties
 * rather than ids, and never the pseudonymous subject, which exists to group attempts and not to be
 * read.
 */

/** Narrowed by `domain/system-audit-log-query.ts`; every filter is optional and ANDed. */
export interface SystemAuditLogQuery {
  /** The acting account. */
  readonly operatorId: string | null;
  readonly action: AuditAction | null;
  /** Inclusive lower bound on when it happened. */
  readonly from: Date | null;
  /** Exclusive upper bound — a client sends the start of the day after the last day it means. */
  readonly to: Date | null;
  readonly skip: number;
  readonly take: number;
}

/**
 * A party to an event. `email` is null where the id names nothing the realm holds any more — which
 * the append-only log outliving a row is the ordinary case of, not an error.
 */
export interface SystemAuditLogParty {
  readonly id: string;
  readonly email: string | null;
}

/**
 * What an event acted on: an account or an invitation, named by address, or since task 67.11 a social provider's
 * configuration version, named by the provider it configures, and since task 67.10 a notification category's, named by
 * the category.
 */
export interface SystemAuditLogTarget extends SystemAuditLogParty {
  readonly provider: SocialProvider | null;
  readonly category: NotificationCategoryKey | null;
}

export interface SystemAuditLogEntry {
  readonly id: string;
  readonly occurredAt: Date;
  readonly action: AuditAction;
  /** Null for the provisioning CLI, and for a sign-in attempt against an address with no account. */
  readonly actor: SystemAuditLogParty | null;
  readonly target: SystemAuditLogTarget | null;
}

export interface SystemAuditLogPage {
  readonly entries: readonly SystemAuditLogEntry[];
  /** What the filters admitted — what pages are counted from. */
  readonly matched: number;
  /** Every entry, which is what tells an empty page whether nothing happened or nothing matched. */
  readonly total: number;
}
