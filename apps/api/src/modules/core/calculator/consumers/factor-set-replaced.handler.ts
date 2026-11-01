import { Injectable } from '@nestjs/common';
import { HandlesJob, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { FACTOR_SET_REPLACED } from '../constants/calculator.constants';
import {
  NotifyFactorSetReplaced,
  type NotifyFactorSetReplacedCommand,
} from '../use-cases/notify-factor-set-replaced.use-case';

/**
 * A factor set replaced in its window, on the worker, from the outbox (task 37.3; FR-166, UC-171; AD-10).
 *
 * `ConfigurationPublisher` writes the row on the transaction that put the new revision in force — a publication over
 * an occupied window or a revert — and the dispatcher enqueues it as `calculator.factor_set_replaced`. **The adapter and
 * nothing more**, as the notification handlers are: it validates the payload and hands it to `NotifyFactorSetReplaced`.
 */
@Injectable()
@HandlesJob(FACTOR_SET_REPLACED)
export class FactorSetReplacedHandler implements JobHandler {
  constructor(private readonly notifyFactorSetReplaced: NotifyFactorSetReplaced) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    await this.notifyFactorSetReplaced.execute(readEvent(payload));
  }
}

const isRevision = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** Validated rather than asserted over: a payload is data that crossed a process boundary. */
function readEvent(payload: Record<string, unknown>): NotifyFactorSetReplacedCommand {
  const { scope, leavingRevision, enteringRevision } = payload;
  if (typeof scope !== 'string' || !isRevision(leavingRevision) || !isRevision(enteringRevision)) {
    throw new Error(`${FACTOR_SET_REPLACED} payload is missing its scope or a revision.`);
  }
  return { country: scope, leavingRevision, enteringRevision };
}
