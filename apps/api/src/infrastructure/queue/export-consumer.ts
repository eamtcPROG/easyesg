import { Processor } from '@nestjs/bullmq';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { EXPORT_QUEUE } from './queue.constants';
import { QueueConsumer } from './queue-consumer';

/**
 * The consumer of the export queue (task 44.5; `architecture.md` §12.5.6's task-44 row (5)) — document generation, on a
 * queue of its own so an export burst, or a hung render, holds no other job behind it. Its concurrency is BullMQ's
 * default, one: the renderer prints one document at a time per instance, so exports scale by adding workers and
 * renderers together (§13.1), not by queueing more renders onto one browser.
 */
@Processor(EXPORT_QUEUE)
export class ExportConsumer extends QueueConsumer {
  constructor(discovery: DiscoveryService, reflector: Reflector) {
    super(discovery, reflector, EXPORT_QUEUE);
  }
}
