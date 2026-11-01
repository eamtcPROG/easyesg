import type { GrantedReadSession, GrantedReads } from '../interfaces/granted-reads.interface';
import type { SupportAccessReadPurpose } from '../models/support-access-log.model';
import type {
  SupportAccessDecisionRecord,
  SupportAccessRequestRecord,
} from '../models/support-access-request.model';

/**
 * The grant's window in memory (task 67.9). It records the order things happened in — `events` — so a spec
 * can assert that the access row was written before the read ran, and it can be told to fail the access write,
 * which is how a spec proves a refused log refuses the read.
 */
export class FakeGrantedReads implements GrantedReads {
  readonly requests: SupportAccessRequestRecord[] = [];
  readonly decisions: SupportAccessDecisionRecord[] = [];
  readonly events: string[] = [];
  readonly accesses: { requestId: string; purpose: SupportAccessReadPurpose; subject: string | null }[] = [];
  failAccessWrite = false;

  within<T>(
    scope: { readonly organizationId: string },
    work: (session: GrantedReadSession) => Promise<T>,
  ): Promise<T> {
    this.events.push(`bound:${scope.organizationId}`);
    const session: GrantedReadSession = {
      request: ({ requestId }) => {
        const found = this.requests.filter(
          (request) => request.id === requestId && request.organizationId === scope.organizationId,
        );
        if (found.length === 0) return Promise.resolve(null);
        return Promise.resolve({
          requests: found,
          decisions: this.decisions.filter((decision) => decision.requestId === requestId),
        });
      },
      recordAccess: (access) => {
        if (this.failAccessWrite) return Promise.reject(new Error('the access row could not be written'));
        this.events.push('access');
        this.accesses.push({ requestId: access.request.id, purpose: access.purpose, subject: access.subject });
        return Promise.resolve();
      },
    };
    return work(session);
  }
}
