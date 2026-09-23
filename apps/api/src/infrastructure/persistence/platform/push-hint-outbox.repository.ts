import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { PushHintCommand, PushHints } from '@api/contracts/push.port';
import { writeOutboxEvent, type OutboxEvent } from '@api/infrastructure/outbox/outbox-writer';
import { PUSH_HINT_EVENT } from '@api/modules/platform/push/constants/push.constants';
import { CORE_DATA_SOURCE } from '../data-source';
import { requestContext } from '../request-context';

/**
 * `PUSH_HINTS` (task 148; §12.5.6's task-148 row): a hint from the request tier is an outbox row, which the worker
 * publishes only once it can read it — so never before the change it announces is visible to the refetch it triggers.
 *
 * **On the request's own transaction wherever the request has one**, so the hint commits with the change or not at
 * all — `NotificationOutboxRepository`'s shape, for `raise()`'s reason. **A request bound to no organization has
 * none** (`openTenantTransaction`: no organization, no transaction), and one producer meets that: an account accepting
 * its first invitation, whose acceptance commits in the invitation's own transaction. There the row is written in a
 * transaction of its own, **after** that commit — so still never before the change, and at worst lost, which costs
 * one hint and never correctness: the channel is lossy by design and the poll is the authority.
 *
 * **The organization is the hint's, written explicitly**, never the request's bound one.
 */
@Injectable()
export class PushHintOutboxRepository implements PushHints {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async hint(command: PushHintCommand): Promise<void> {
    const event: OutboxEvent = {
      eventType: PUSH_HINT_EVENT,
      organizationId: command.organizationId,
      payload:
        'accountIds' in command ? { event: command.event, accountIds: [...command.accountIds] } : { event: command.event },
    };
    const requestRunner = requestContext()?.queryRunner;
    if (requestRunner !== undefined) {
      await writeOutboxEvent(requestRunner, event);
      return;
    }
    const own = this.dataSource.createQueryRunner();
    await own.connect();
    try {
      await writeOutboxEvent(own, event);
    } finally {
      await own.release();
    }
  }
}
