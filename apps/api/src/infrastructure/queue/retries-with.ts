import { SetMetadata } from '@nestjs/common';
import type { JobsOptions } from 'bullmq';

/** How many times a job is attempted and how long it waits between attempts — BullMQ's own two options. */
export type JobRetry = Required<Pick<JobsOptions, 'attempts' | 'backoff'>>;

/**
 * NFR-107's bounded retry, as job options (task 51.4; §12.5.6's task-51.4 row) — **the retry every job takes unless its
 * handler declares its own** with `@RetriesWith`.
 *
 * **Eleven attempts on an exponential backoff from a minute** — 60s, 120s, 240s … 61440s — which sums to about 17 hours
 * and therefore lands the last attempt inside the 24 the requirement fixes. A twelfth would put it past 34 hours and
 * outside it, which is why the count is stated here rather than rounded up to a comfortable number.
 *
 * **It belongs on the job rather than on a schedule of its own** because `DeliverNotification` already derives what is
 * owed from what is recorded: a retried job re-sends only the recipients with no delivery row, so retrying the whole
 * job costs nothing and reaches nobody twice. A second scheduler beside AD-10's would be the dual-write that decision
 * exists to refuse.
 *
 * **A hard bounce never takes this path.** The channel records it and returns, so the job succeeds; only a transient
 * failure throws, and only a throw retries. Retrying a refused address would spend all eleven attempts learning the
 * same thing eleven times.
 */
export const DELIVERY_RETRY: JobRetry = {
  attempts: 11,
  backoff: { type: 'exponential', delay: 60_000 },
};

export const RETRIES_WITH_METADATA = 'easyesg:retries-with';

/**
 * A job's own retry, **declared beside its `@HandlesJob`, on the handler that does the work** — as `@RunsDaily` is —
 * so the module that owns a job owns how often it is tried, and the dispatcher, which puts the options on the job,
 * names no module (task 44; §12.5.6's task-44 row (4)). A job that declares none takes `DELIVERY_RETRY`.
 */
export const RetriesWith = (retry: JobRetry) => SetMetadata(RETRIES_WITH_METADATA, retry);
