import { Injectable } from '@nestjs/common';
import { HandlesJob, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { APPLICABILITY_REPLACED } from '../constants/disclosure.constants';
import {
  NotifyApplicabilityReplaced,
  type NotifyApplicabilityReplacedCommand,
} from '../use-cases/notify-applicability-replaced.use-case';

/**
 * An applicability rule set replaced in force, on the worker, from the outbox (task 67.8; FR-166, UC-81; AD-10). The
 * adapter and nothing more, `FactorSetReplacedHandler`'s shape: it validates the payload and hands it on.
 */
@Injectable()
@HandlesJob(APPLICABILITY_REPLACED)
export class ApplicabilityReplacedHandler implements JobHandler {
  constructor(private readonly notifyApplicabilityReplaced: NotifyApplicabilityReplaced) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    await this.notifyApplicabilityReplaced.execute(readEvent(payload));
  }
}

const isRevision = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** Validated rather than asserted over: a payload is data that crossed a process boundary. */
function readEvent(payload: Record<string, unknown>): NotifyApplicabilityReplacedCommand {
  const { scope, leavingRevision, enteringRevision } = payload;
  if (typeof scope !== 'string' || !isRevision(leavingRevision) || !isRevision(enteringRevision)) {
    throw new Error(`${APPLICABILITY_REPLACED} payload is missing its scope or a revision.`);
  }
  return { standard: scope, leavingRevision, enteringRevision };
}
