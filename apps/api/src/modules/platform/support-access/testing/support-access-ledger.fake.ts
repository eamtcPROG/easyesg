import type { SupportAccessLedger } from '../interfaces/support-access-ledger.interface';
import { SUPPORT_ACCESS_ENTRY_KIND } from '../models/support-access-log.model';
import {
  SUPPORT_ACCESS_ACTOR_REALM,
  type SupportAccessDecisionRecord,
  type SupportAccessHistory,
  type SupportAccessRequestRecord,
} from '../models/support-access-request.model';

/**
 * The platform ledger in memory (task 67.9). It models what the use cases depend on and nothing else: which
 * organizations exist, that an organization sees only its own requests, and that an operator's history is
 * narrowed to what that operator raised since the instant asked for.
 */
export class FakeSupportAccessLedger implements SupportAccessLedger {
  readonly organizations = new Set<string>();
  readonly requests: SupportAccessRequestRecord[] = [];
  readonly decisions: SupportAccessDecisionRecord[] = [];
  private issued = 0;

  operatorHistory(query: {
    readonly organizationId: string;
    readonly requesterId: string;
    readonly since: Date;
  }): Promise<SupportAccessHistory | null> {
    if (!this.organizations.has(query.organizationId)) return Promise.resolve(null);
    const requests = this.requests.filter(
      (request) =>
        request.organizationId === query.organizationId &&
        request.requesterId === query.requesterId &&
        request.requestedAt.getTime() >= query.since.getTime(),
    );
    return Promise.resolve(this.withDecisions(requests));
  }

  request(query: {
    readonly organizationId: string;
    readonly requestId: string;
  }): Promise<SupportAccessHistory | null> {
    const found = this.requests.filter(
      (request) => request.id === query.requestId && request.organizationId === query.organizationId,
    );
    return Promise.resolve(found.length === 0 ? null : this.withDecisions(found));
  }

  recordRequest(command: {
    readonly organizationId: string;
    readonly requesterId: string;
    readonly ticketReference: string;
    readonly reason: string;
    readonly at: Date;
  }): Promise<{ readonly id: string }> {
    this.issued += 1;
    const id = `request-${this.issued}`;
    this.requests.push({
      id,
      organizationId: command.organizationId,
      requesterId: command.requesterId,
      requesterEmail: null,
      ticketReference: command.ticketReference,
      reason: command.reason,
      requestedAt: command.at,
    });
    return Promise.resolve({ id });
  }

  recordEnd(command: {
    readonly request: SupportAccessRequestRecord;
    readonly actorId: string;
    readonly at: Date;
  }): Promise<void> {
    this.decisions.push({
      requestId: command.request.id,
      kind: SUPPORT_ACCESS_ENTRY_KIND.END,
      actorId: command.actorId,
      actorRealm: SUPPORT_ACCESS_ACTOR_REALM.PLATFORM,
      actorEmail: null,
      occurredAt: command.at,
    });
    return Promise.resolve();
  }

  private withDecisions(requests: SupportAccessRequestRecord[]): SupportAccessHistory {
    return {
      requests,
      decisions: this.decisions.filter((decision) =>
        requests.some((request) => request.id === decision.requestId),
      ),
    };
  }
}
