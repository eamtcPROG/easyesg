import type { Clock } from '@api/contracts/clock.port';
import {
  SUPPORT_ACCESS_HORIZON_MS,
  SUPPORT_ACCESS_LAPSE_MS,
  supportAccessIsOutstanding,
  supportAccessRequestOf,
} from '../domain/support-access-request';
import {
  SupportAccessOrganizationNotFoundError,
  SupportAccessOutstandingError,
} from '../errors/support-access.errors';
import type { SupportAccessLedger } from '../interfaces/support-access-ledger.interface';

export interface RaiseSupportAccessRequestCommand {
  /** The Platform Administrator asking — the only one a grant will let read. */
  readonly operatorId: string;
  readonly organizationId: string;
  readonly ticketReference: string;
  /** Written for the organization, which reads it before it answers. */
  readonly reason: string;
}

export interface RaisedSupportAccessRequest {
  readonly id: string;
  readonly organizationId: string;
  readonly requestedAt: Date;
  readonly lapsesAt: Date;
}

/**
 * UC-85's first step (task 67.9; FR-78, amended 14 Sep 2026): a Platform Administrator asks an organization
 * for read-only access, with a ticket and a reason — and **that is all it does**. Nothing is granted here;
 * an Organization Administrator of that organization answers, and nobody at the platform can answer for it.
 *
 * **One request at a time, per operator and organization.** A request still waiting, or a grant still
 * running, holds the operator's place: a second would ask the organization the same question twice, and the
 * owner's *extend with a new request* means a new request once the first has ended.
 */
export class RaiseSupportAccessRequest {
  constructor(
    private readonly ledger: SupportAccessLedger,
    private readonly now: Clock,
  ) {}

  async execute(command: RaiseSupportAccessRequestCommand): Promise<RaisedSupportAccessRequest> {
    const at = this.now();
    const history = await this.ledger.operatorHistory({
      organizationId: command.organizationId,
      requesterId: command.operatorId,
      since: new Date(at.getTime() - SUPPORT_ACCESS_HORIZON_MS),
    });
    if (history === null) throw new SupportAccessOrganizationNotFoundError();

    const outstanding = history.requests.some((request) =>
      supportAccessIsOutstanding(supportAccessRequestOf({ request, decisions: history.decisions, now: at })),
    );
    if (outstanding) throw new SupportAccessOutstandingError();

    const { id } = await this.ledger.recordRequest({
      organizationId: command.organizationId,
      requesterId: command.operatorId,
      ticketReference: command.ticketReference,
      reason: command.reason,
      at,
    });

    return {
      id,
      organizationId: command.organizationId,
      requestedAt: at,
      lapsesAt: new Date(at.getTime() + SUPPORT_ACCESS_LAPSE_MS),
    };
  }
}
