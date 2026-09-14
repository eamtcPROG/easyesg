import type { Clock } from '@api/contracts/clock.port';
import { supportAccessRequestOf } from '../domain/support-access-request';
import {
  SupportAccessNotActiveError,
  SupportAccessRequestNotFoundError,
} from '../errors/support-access.errors';
import type { SupportAccessLedger } from '../interfaces/support-access-ledger.interface';
import { SUPPORT_ACCESS_STATE } from '../models/support-access-request.model';

export interface EndSupportAccessAsOperatorCommand {
  /** The Platform Administrator ending it — not necessarily the one who asked. */
  readonly operatorId: string;
  readonly organizationId: string;
  readonly requestId: string;
}

/**
 * A Platform Administrator ends running support access before its 60 minutes (task 67.9; UC-85 3a).
 *
 * **Any Platform Administrator, on any grant** (project owner, 14 Sep 2026): a privilege that needs
 * restraining is restrained by peers, so a colleague who sees access running that should not be can stop it.
 * Only running access ends — a request still waiting simply lapses, and one already over has nothing to end.
 */
export class EndSupportAccessAsOperator {
  constructor(
    private readonly ledger: SupportAccessLedger,
    private readonly now: Clock,
  ) {}

  async execute(command: EndSupportAccessAsOperatorCommand): Promise<void> {
    const history = await this.ledger.request({
      organizationId: command.organizationId,
      requestId: command.requestId,
    });
    const record = history?.requests[0];
    if (history === null || record === undefined) throw new SupportAccessRequestNotFoundError();

    const at = this.now();
    const request = supportAccessRequestOf({ request: record, decisions: history.decisions, now: at });
    if (request.state !== SUPPORT_ACCESS_STATE.ACTIVE) throw new SupportAccessNotActiveError();

    await this.ledger.recordEnd({ request: record, actorId: command.operatorId, at });
  }
}
