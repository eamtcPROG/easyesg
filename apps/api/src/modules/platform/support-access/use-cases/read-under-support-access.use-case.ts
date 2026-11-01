import type { Clock } from '@api/contracts/clock.port';
import { supportAccessRequestOf } from '../domain/support-access-request';
import { SupportAccessRequiredError } from '../errors/support-access.errors';
import type { GrantedReads } from '../interfaces/granted-reads.interface';
import type { SupportAccessReadPurpose } from '../models/support-access-log.model';
import { SUPPORT_ACCESS_STATE } from '../models/support-access-request.model';

export interface ReadUnderSupportAccessCommand<T> {
  readonly operatorId: string;
  readonly organizationId: string;
  readonly requestId: string;
  readonly purpose: SupportAccessReadPurpose;
  /** What within that kind of read is opened — a report, or a report and its module. */
  readonly subject: string | null;
  /** The read itself — the organization's own report read models, run inside the grant's binding. */
  readonly read: () => Promise<T>;
}

/**
 * A read of an organization's report data under a support-access grant (task 67.9; FR-77, FR-78, FR-79).
 *
 * **The only path by which a Platform Administrator reaches tenant report data** (D-5), and it holds three
 * things in order:
 *
 * 1. **The grant permits it**: the request is active and it is this operator's — a grant is given to the
 *    person who asked, not to the platform. Anything else is one refusal.
 * 2. **The read is logged before it runs**, and a failed log write refuses it — FR-79's *what was accessed*
 *    is the condition of the access, not a note made after.
 * 3. **The read runs bound to that one organization, read-only**, so the policies that scope a member's read
 *    scope this one, and nothing under a grant can write.
 */
export class ReadUnderSupportAccess {
  constructor(
    private readonly reads: GrantedReads,
    private readonly now: Clock,
  ) {}

  execute<T>(command: ReadUnderSupportAccessCommand<T>): Promise<T> {
    return this.reads.within({ organizationId: command.organizationId }, async (session) => {
      const history = await session.request({ requestId: command.requestId });
      const record = history?.requests[0];
      if (history === null || record === undefined) throw new SupportAccessRequiredError();

      const at = this.now();
      const request = supportAccessRequestOf({ request: record, decisions: history.decisions, now: at });
      if (request.state !== SUPPORT_ACCESS_STATE.ACTIVE || request.requesterId !== command.operatorId) {
        throw new SupportAccessRequiredError();
      }

      await session.recordAccess({
        request: record,
        purpose: command.purpose,
        subject: command.subject,
        at,
      });
      return command.read();
    });
  }
}
