import type {
  SupportAccessAccessRecord,
  SupportAccessDecisionRecord,
  SupportAccessRequestRecord,
} from '../models/support-access-request.model';

export const SUPPORT_ACCESS_LOG_READER = Symbol('SUPPORT_ACCESS_LOG_READER');

/** A request as A-07's log shows it: with the organization's name beside its id. */
export interface SupportAccessLogRequestRecord extends SupportAccessRequestRecord {
  readonly organizationName: string | null;
}

/** One page of the log's raw rows, newest request first. */
export interface SupportAccessLogRows {
  readonly requests: readonly SupportAccessLogRequestRecord[];
  readonly decisions: readonly SupportAccessDecisionRecord[];
  readonly accesses: readonly SupportAccessAccessRecord[];
  /** Every request ever raised — what the pages are counted from. */
  readonly total: number;
}

/**
 * A-07's log (task 67.9; UC-86, FR-79) — every request by every operator, read through `esg_admin_ro`
 * because it crosses organizations, and that read is itself logged.
 */
export interface SupportAccessLogReader {
  list(read: {
    /** The operator reading — the acquisition row names them. */
    readonly requesterId: string;
    readonly take: number;
    readonly skip: number;
  }): Promise<SupportAccessLogRows>;
}
