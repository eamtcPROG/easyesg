import type { DiscoveryService, Reflector } from '@nestjs/core';
import { JOB_NAME_METADATA } from './job-handler';
import { JobPlacement } from './job-placement';
import { ON_QUEUE_METADATA } from './on-queue';
import { EXPORT_QUEUE, OUTBOX_QUEUE } from './queue.constants';
import { DELIVERY_RETRY, RETRIES_WITH_METADATA, type JobRetry } from './retries-with';

class Handler {}
class Declaring {}

const OWN: JobRetry = { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } };

const placementOver = (providers: { instance: object; name: string; queue?: string; retry?: JobRetry }[]) => {
  const discovery = { getProviders: () => providers.map(({ instance }) => ({ instance })) } as unknown as DiscoveryService;
  const reflector = {
    get: (key: string, target: unknown) => {
      const provider = providers.find(({ instance }) => instance.constructor === target);
      if (key === JOB_NAME_METADATA) return provider?.name;
      if (key === ON_QUEUE_METADATA) return provider?.queue;
      return key === RETRIES_WITH_METADATA ? provider?.retry : undefined;
    },
  } as unknown as Reflector;
  return new JobPlacement(discovery, reflector);
};

describe('JobPlacement (task 44)', () => {
  it('answers the queue and the retry a handler declared beside its job name', () => {
    const placement = placementOver([
      { instance: new Declaring(), name: 'export.pdf.requested', queue: EXPORT_QUEUE, retry: OWN },
    ]);
    expect(placement.of('export.pdf.requested')).toEqual({ queue: EXPORT_QUEUE, retry: OWN });
  });

  it('answers AD-10’s queue and the delivery retry for a job that declares neither, and for a name nothing claimed', () => {
    const placement = placementOver([{ instance: new Handler(), name: 'identity.email_verification.requested' }]);
    expect(placement.of('identity.email_verification.requested')).toEqual({ queue: OUTBOX_QUEUE, retry: DELIVERY_RETRY });
    expect(placement.of('nobody.claimed')).toEqual({ queue: OUTBOX_QUEUE, retry: DELIVERY_RETRY });
  });
});
