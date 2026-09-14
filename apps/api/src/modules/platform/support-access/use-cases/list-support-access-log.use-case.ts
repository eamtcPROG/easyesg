import type { Clock } from '@api/contracts/clock.port';
import { supportAccessRequestOf } from '../domain/support-access-request';
import type { SupportAccessLogReader } from '../interfaces/support-access-log-reader.interface';
import type { SupportAccessLogPage } from '../models/support-access-request.model';

export interface ListSupportAccessLogQuery {
  /** The Platform Administrator reading — whoever reads the log is recorded as having read it. */
  readonly requesterId: string;
  readonly take: number;
  readonly skip: number;
}

/**
 * UC-86 (task 67.9; FR-79): every support-access request, newest first — who asked, over which organization,
 * for what reason, what the organization decided and who decided it, how it ended, and what was read under it.
 *
 * **Every Platform Administrator reads the whole log** (project owner, 14 Sep 2026). **Each entry's state is
 * folded here at the instant of the read**, so *lapsed* and *expired* are shown the moment they are true,
 * though no row was written when they became so.
 */
export class ListSupportAccessLog {
  constructor(
    private readonly reader: SupportAccessLogReader,
    private readonly now: Clock,
  ) {}

  async execute(query: ListSupportAccessLogQuery): Promise<SupportAccessLogPage> {
    const rows = await this.reader.list(query);
    const now = this.now();

    return {
      entries: rows.requests.map((request) => ({
        ...supportAccessRequestOf({ request, decisions: rows.decisions, now }),
        organizationName: request.organizationName,
        accesses: rows.accesses.filter((access) => access.requestId === request.id),
      })),
      total: rows.total,
    };
  }
}
