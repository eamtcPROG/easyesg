import type { SupportAccessReadPurpose } from '../models/support-access-log.model';
import type {
  SupportAccessHistory,
  SupportAccessRequestRecord,
} from '../models/support-access-request.model';

export const GRANTED_READS = Symbol('GRANTED_READS');

/**
 * What a read under a grant may do inside its window (task 67.9).
 *
 * Everything here runs inside `GrantedReads.within`, on a `READ ONLY` transaction bound to the granted
 * organization, so the report reads the caller then makes are scoped by the same policies a member's are.
 */
export interface GrantedReadSession {
  /** The request and its rows, as the organization's policies show them. */
  request(query: { readonly requestId: string }): Promise<SupportAccessHistory | null>;

  /**
   * Record FR-79's *what was accessed* — committed on a connection of its own before the read runs, so a
   * read that fails still left its row, and a row that fails refuses the read.
   */
  recordAccess(access: {
    readonly request: SupportAccessRequestRecord;
    readonly purpose: SupportAccessReadPurpose;
    readonly subject: string | null;
    readonly at: Date;
  }): Promise<void>;
}

export interface GrantedReads {
  within<T>(
    scope: { readonly organizationId: string },
    work: (session: GrantedReadSession) => Promise<T>,
  ): Promise<T>;
}
