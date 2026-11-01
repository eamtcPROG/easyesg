import { Processor } from '@nestjs/bullmq';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { OUTBOX_QUEUE } from './queue.constants';
import { QueueConsumer } from './queue-consumer';

/**
 * The consumer of AD-10's queue — every job whose handler declares no other (`QueueConsumer` holds the routing).
 */
@Processor(OUTBOX_QUEUE)
export class OutboxConsumer extends QueueConsumer {
  constructor(discovery: DiscoveryService, reflector: Reflector) {
    super(discovery, reflector, OUTBOX_QUEUE);
  }
}
