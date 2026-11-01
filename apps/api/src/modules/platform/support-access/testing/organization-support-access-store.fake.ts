import type { OrganizationSupportAccessStore } from '../interfaces/organization-support-access-store.interface';
import {
  SUPPORT_ACCESS_ACTOR_REALM,
  type SupportAccessDecisionKind,
  type SupportAccessDecisionRecord,
  type SupportAccessHistory,
  type SupportAccessRequestRecord,
} from '../models/support-access-request.model';

/**
 * The organization's store in memory (task 67.9), bound to one organization the way the tenant request's
 * transaction is: another organization's request is invisible to it, as the log's select policy makes it.
 * `locked` records which requests were locked before an answer, so a spec can assert the use case asked.
 */
export class FakeOrganizationSupportAccessStore implements OrganizationSupportAccessStore {
  readonly requests: SupportAccessRequestRecord[] = [];
  readonly decisions: SupportAccessDecisionRecord[] = [];
  readonly locked: string[] = [];

  constructor(private readonly organizationId: string) {}

  history(query: { readonly since: Date }): Promise<SupportAccessHistory> {
    const requests = this.mine().filter((request) => request.requestedAt.getTime() >= query.since.getTime());
    return Promise.resolve(this.withDecisions(requests));
  }

  lock(query: { readonly requestId: string }): Promise<SupportAccessHistory | null> {
    this.locked.push(query.requestId);
    const found = this.mine().filter((request) => request.id === query.requestId);
    return Promise.resolve(found.length === 0 ? null : this.withDecisions(found));
  }

  record(decision: {
    readonly request: SupportAccessRequestRecord;
    readonly kind: SupportAccessDecisionKind;
    readonly actorId: string;
    readonly at: Date;
  }): Promise<void> {
    this.decisions.push({
      requestId: decision.request.id,
      kind: decision.kind,
      actorId: decision.actorId,
      actorRealm: SUPPORT_ACCESS_ACTOR_REALM.ORGANIZATION,
      actorEmail: null,
      occurredAt: decision.at,
    });
    return Promise.resolve();
  }

  private mine(): SupportAccessRequestRecord[] {
    return this.requests.filter((request) => request.organizationId === this.organizationId);
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
