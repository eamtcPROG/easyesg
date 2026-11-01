import { Inject, Injectable } from '@nestjs/common';
import { PUSH_PUBLISHER, type PushPublisher } from '@api/contracts/push.port';
import { HandlesJob, occurredAtMicrosOf, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { PUSH_HINT_EVENT } from '../constants/push.constants';
import { readPushHint } from '../domain/push-hint';

/**
 * The worker publishing a request-tier hint as it drains the outbox (task 148; §12.5.6's task-148 row) — **after** the
 * transaction that wrote it committed, which is what the outbox guarantees and what makes the refetch a hint
 * triggers see the change. `since` is the outbox row's own time, the moment the change was made.
 *
 * A payload that names nothing routable throws — an outbox row exists because a transaction committed a decision, and
 * a failed job is visible where a dropped one is not.
 */
@Injectable()
@HandlesJob(PUSH_HINT_EVENT)
export class PushHintHandler implements JobHandler {
  constructor(@Inject(PUSH_PUBLISHER) private readonly publisher: PushPublisher) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    const hint = readPushHint({
      event: payload.event,
      organizationId: payload.organizationId,
      accountIds: payload.accountIds,
      since: new Date(occurredAtMicrosOf(payload, PUSH_HINT_EVENT) / 1000),
    });
    if (hint === null) throw new Error(`${PUSH_HINT_EVENT} payload names no event or audience this release can route.`);
    await this.publisher.publish(hint);
  }
}
