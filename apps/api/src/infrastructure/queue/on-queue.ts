import { SetMetadata } from '@nestjs/common';

export const ON_QUEUE_METADATA = 'easyesg:on-queue';

/**
 * The queue a job goes to, **declared beside its `@HandlesJob`, on the handler that does the work** (task 44.5;
 * `architecture.md` §12.5.6's task-44 row (5)), as its retry is. The dispatcher puts the job there, and only that queue's
 * consumer runs it. A handler that declares none is on `OUTBOX_QUEUE`.
 */
export const OnQueue = (queue: string) => SetMetadata(ON_QUEUE_METADATA, queue);
