import type { DiscoveryService, Reflector } from '@nestjs/core';
import type { Job } from 'bullmq';
import { JOB_NAME_METADATA, type JobContext, type JobHandler } from './job-handler';
import { OutboxConsumer } from './outbox-consumer';

/**
 * The router that makes AD-10's single queue workable.
 *
 * Two of these three cases are about failing loudly, and both matter more than the happy path: a
 * job silently dropped and a job silently handled by the wrong class are the two ways name-based
 * routing goes wrong, and neither raises anything on its own.
 */
class RecordingHandler implements JobHandler {
  readonly calls: { payload: Record<string, unknown>; context: JobContext }[] = [];

  handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    this.calls.push({ payload, context });
    return Promise.resolve();
  }
}

/** Stands in for the Nest container: whatever these two return is what discovery would have found. */
const consumerOver = (handlers: Record<string, JobHandler>) => {
  const instances = Object.values(handlers);
  const names = new Map<unknown, string>(
    Object.entries(handlers).map(([name, handler]) => [handler.constructor, name]),
  );

  const discovery = {
    getProviders: () => instances.map((instance) => ({ instance })),
  } as unknown as DiscoveryService;

  const reflector = {
    get: (key: string, target: unknown) => (key === JOB_NAME_METADATA ? names.get(target) : undefined),
  } as unknown as Reflector;

  return new OutboxConsumer(discovery, reflector);
};

const jobNamed = (name: string, data: Record<string, unknown> = {}): Job<Record<string, unknown>> =>
  ({ id: 'idempotency-key-1', name, data, attemptsMade: 0 }) as unknown as Job<Record<string, unknown>>;

describe('OutboxConsumer (AD-10)', () => {
  it('routes a job to the handler that claimed its name', async () => {
    const email = new RecordingHandler();
    const consumer = consumerOver({ 'identity.email_verification.requested': email });
    consumer.onModuleInit();

    await consumer.process(jobNamed('identity.email_verification.requested', { accountId: 'a' }));

    expect(email.calls).toHaveLength(1);
    expect(email.calls[0].payload).toEqual({ accountId: 'a' });
  });

  /**
   * §8.4 requires an outbound call to carry an idempotency key generated in the originating
   * transaction. The outbox row's key IS the job id, so a handler must be able to reach it without
   * a second scheme — this is what makes that true.
   */
  it('hands the handler the job id, which is the outbox row idempotency key', async () => {
    const email = new RecordingHandler();
    const consumer = consumerOver({ 'identity.email_verification.requested': email });
    consumer.onModuleInit();

    await consumer.process(jobNamed('identity.email_verification.requested'));

    expect(email.calls[0].context).toEqual({
      jobId: 'idempotency-key-1',
      jobName: 'identity.email_verification.requested',
      attempt: 1,
    });
  });

  /**
   * An outbox row exists because a transaction committed a decision to do something. Dropping it
   * because nothing is listening would make that decision disappear with no error anywhere, which
   * is the silent-loss failure the outbox exists to remove.
   */
  it('fails a job no handler claimed, rather than discarding it', async () => {
    const consumer = consumerOver({});
    consumer.onModuleInit();

    await expect(consumer.process(jobNamed('export.pdf.requested'))).rejects.toThrow(
      /No handler is registered for job "export.pdf.requested"/,
    );
  });

  it('refuses to start when two handlers claim one name', () => {
    const first = new RecordingHandler();
    // A second instance of the same class shares its constructor, which is exactly the collision
    // the reflector would see for two classes both marked with one job name.
    const second = new RecordingHandler();
    const discovery = {
      getProviders: () => [{ instance: first }, { instance: second }],
    } as unknown as DiscoveryService;
    const reflector = { get: () => 'identity.email_verification.requested' } as unknown as Reflector;

    expect(() => new OutboxConsumer(discovery, reflector).onModuleInit()).toThrow(
      /One job name, one handler/,
    );
  });
});
