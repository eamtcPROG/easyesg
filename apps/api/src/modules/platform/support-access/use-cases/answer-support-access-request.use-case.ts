import type { Clock } from '@api/contracts/clock.port';
import { supportAccessRequestOf } from '../domain/support-access-request';
import {
  SupportAccessNotAwaitingError,
  SupportAccessRequestNotFoundError,
} from '../errors/support-access.errors';
import type { OrganizationSupportAccessStore } from '../interfaces/organization-support-access-store.interface';
import { SUPPORT_ACCESS_ENTRY_KIND } from '../models/support-access-log.model';
import { SUPPORT_ACCESS_STATE } from '../models/support-access-request.model';

export interface AnswerSupportAccessRequestCommand {
  readonly requestId: string;
  /** The Organization Administrator answering — the bound member. */
  readonly actorId: string;
  readonly answer: typeof SUPPORT_ACCESS_ENTRY_KIND.GRANT | typeof SUPPORT_ACCESS_ENTRY_KIND.DECLINE;
}

/**
 * UC-85's second step (task 67.9; FR-78, amended 14 Sep 2026): an Organization Administrator grants or declines
 * a Platform Administrator's request — **the organization's consent, which nobody at the platform can give
 * for it**. A grant starts 60 minutes of read-only access.
 *
 * **Only a request still waiting can be answered**, and the store holds the request so two administrators
 * answering at once decide in turn: the second meets an answered request and is told so.
 */
export class AnswerSupportAccessRequest {
  constructor(
    private readonly store: OrganizationSupportAccessStore,
    private readonly now: Clock,
  ) {}

  async execute(command: AnswerSupportAccessRequestCommand): Promise<void> {
    const history = await this.store.lock({ requestId: command.requestId });
    const record = history?.requests[0];
    if (history === null || record === undefined) throw new SupportAccessRequestNotFoundError();

    const at = this.now();
    const request = supportAccessRequestOf({ request: record, decisions: history.decisions, now: at });
    if (request.state !== SUPPORT_ACCESS_STATE.AWAITING) throw new SupportAccessNotAwaitingError();

    await this.store.record({ request: record, kind: command.answer, actorId: command.actorId, at });
  }
}
