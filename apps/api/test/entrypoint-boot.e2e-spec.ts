import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { APP_MODE } from '../src/config/configuration';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import type { Job } from 'bullmq';
import type { DataSource } from 'typeorm';
import { ExportConsumer } from '../src/infrastructure/queue/export-consumer';
import { JobPlacement } from '../src/infrastructure/queue/job-placement';
import { OutboxConsumer } from '../src/infrastructure/queue/outbox-consumer';
import { EXPORT_QUEUE, OUTBOX_QUEUE } from '../src/infrastructure/queue/queue.constants';
import { DELIVERY_RETRY } from '../src/infrastructure/queue/retries-with';
import { ScheduleTicker } from '../src/infrastructure/schedule/schedule-ticker.service';
import { FACTOR_SET_REPLACED } from '../src/modules/core/calculator/constants/calculator.constants';
import { EXPORT_PDF_REQUESTED, EXPORT_XLSX_REQUESTED } from '../src/modules/core/export/constants/export.constants';
import { REPORT_NOTICE_CHECK, REPORT_NOTICE_SWEEP } from '../src/modules/core/validation/constants/validation.constants';
import { EMAIL_VERIFICATION_REQUESTED, PASSWORD_RESET_REQUESTED } from '../src/modules/identity/account/constants/account.constants';
import { INVITATION_ISSUED } from '../src/modules/identity/invitation/constants/invitation.constants';
import { AuthGuard } from '../src/modules/identity/session/guards/auth.guard';
import { PUSH_HINT_EVENT } from '../src/modules/platform/push/constants/push.constants';
import { ADMIN_INVITATION_ISSUED } from '../src/modules/platform/admin/constants/admin-invitation.constants';
import {
  NOTIFICATION_CANCELLED,
  NOTIFICATION_RAISED,
} from '../src/modules/platform/notification/constants/notification.constants';
import { connectAs, databaseNow, deleteScheduledRuns } from './support/database';

/**
 * AD-1's backstop: **one image, two entrypoints, and both of them boot.**
 *
 * This suite exists because a real defect shipped and no local gate could see it. Task 28.1
 * registered `AuthGuard` as an `APP_GUARD` unconditionally, while `SessionModule` provides it on
 * the HTTP side only — so `MODE=worker` failed dependency resolution and the worker container
 * refused to start. Everything green: `openapi:check` boots in preview mode and instantiates no
 * provider, and every other e2e boots HTTP. The first CI run after that task found it, in the
 * Images job that starts the container a deploy would use, and only because that job boots the
 * worker at all.
 *
 * **The mode is read at module-definition time**, so a single process cannot exercise both
 * branches — `configuration()` runs before dependency injection exists to answer it. This suite
 * therefore asserts against whichever mode it was launched in, and the gate set runs it in both:
 * `pnpm test:e2e` in HTTP mode with every other suite, `pnpm test:worker` in worker mode. Neither
 * run alone proves the split; the pair does. That is `billing-disabled.e2e-spec.ts`'s arrangement,
 * for the same reason and with the same honest limitation.
 *
 * **Booting is most of the assertion.** The failure it guards against is a graph that will not
 * resolve, so `createApplicationContext` returning at all is the check; what follows makes the
 * *reason* explicit, so nobody restores the coupling by moving one provider back.
 *
 * **It asserts on `AuthGuard`, not on `APP_GUARD`**, and the first draft got that wrong in a way
 * worth recording: `APP_GUARD` and `APP_INTERCEPTOR` are **enhancer tokens**, which Nest consumes
 * when it builds the pipeline and never exposes through `app.get`. So a `toThrow()` on them passed
 * in worker mode for a reason that had nothing to do with the worker — a rule matching nothing,
 * which this repository has now caught in four places and which looks identical to a rule that
 * passes. `AuthGuard` is the honest discriminator: `SessionModule` exports it in HTTP mode and does
 * not provide it at all on the worker, which is precisely the asymmetry that broke.
 */
const workerMode = process.env.MODE === APP_MODE.WORKER;

describe(`${workerMode ? 'worker' : 'http'} entrypoint boots (AD-1)`, () => {
  let app: INestApplicationContext;
  // The worker's boot schedules the day's sweep once its slot has passed (task 51.2), and closes before draining it — so
  // the suite removes the row it caused, from its own start, or the next `pnpm e2e` names it a stray (task 42.1).
  let owner: DataSource | undefined;
  let since: Date | undefined;

  beforeAll(async () => {
    await initialiseCatalogue();
    if (workerMode) {
      owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-entrypoint-boot-owner');
      since = await databaseNow(owner);
    }
    // `createApplicationContext` and not `create`: this is the worker's own factory, and using it
    // for both means the HTTP run exercises the same resolution path rather than a friendlier one.
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    if (owner !== undefined && since !== undefined) {
      await deleteScheduledRuns({ owner, eventType: REPORT_NOTICE_SWEEP, since });
      await owner.destroy();
    }
  });

  it('resolves its whole dependency graph', () => {
    expect(app).toBeDefined();
  });

  if (workerMode) {
    /**
     * The request pipeline is HTTP-only, and this is what says so where someone would otherwise
     * "tidy" the conditional away. A worker serves no requests, so a guard there governs nothing —
     * and `AuthGuard` in particular is not even constructible, which is how the coupling announced
     * itself.
     */
    it('does not provide AuthGuard — it serves no requests', () => {
      expect(() => {
        app.get(AuthGuard, { strict: false });
      }).toThrow();
    });

    /**
     * **Every job the worker must answer reaches a handler** (task 49's parent close, from its gate review). A boot
     * proves the providers resolve, not that a handler is routed: with a `@HandlesJob` line deleted everything else
     * stays green, and the first real job lands in the failed set as *"No handler is registered"*. So each is given
     * to the real consumer with an empty payload — a routed job fails on its handler's own payload check, which
     * sends nothing; an unrouted one fails on the routing, and this is the one place that can tell the two apart.
     */
    it.each([
      NOTIFICATION_RAISED,
      NOTIFICATION_CANCELLED,
      EMAIL_VERIFICATION_REQUESTED,
      PASSWORD_RESET_REQUESTED,
      INVITATION_ISSUED,
      ADMIN_INVITATION_ISSUED,
      // Task 148: a request-tier hint, published by the worker as the outbox drains.
      PUSH_HINT_EVENT,
      // Task 37.3's factor notice — routed since then, and missing from this list until task 51.2 found it.
      FACTOR_SET_REPLACED,
      // Task 51.2: the day's sweep, and one period's check.
      REPORT_NOTICE_SWEEP,
      REPORT_NOTICE_CHECK,
    ])('routes %s to its handler', async (name) => {
      const job = { id: 'boot-probe', name, data: {}, attemptsMade: 0, opts: {} } as unknown as Job<
        Record<string, unknown>
      >;

      await expect(app.get(OutboxConsumer, { strict: false }).process(job)).rejects.toThrow(/payload/);
    });

    /**
     * **The export queue's jobs are routed by its own consumer** (tasks 44.5, 46.1): the same probe as above, on the
     * export queue's consumer — and AD-10's consumer refuses each, so an export put on the wrong queue fails loudly
     * rather than running beside the emails it was given a queue of its own to stay out of the way of.
     */
    it.each([EXPORT_PDF_REQUESTED, EXPORT_XLSX_REQUESTED])('routes %s on the export queue alone', async (name) => {
      const job = { id: 'boot-probe', name, data: {}, attemptsMade: 0, opts: {} } as unknown as Job<Record<string, unknown>>;
      await expect(app.get(ExportConsumer, { strict: false }).process(job)).rejects.toThrow(/payload/);
      await expect(app.get(OutboxConsumer, { strict: false }).process(job)).rejects.toThrow(/on queue "easyesg"/);
    });

    /**
     * **A job's queue and retry are the ones its handler declares** (task 44; §12.5.6's task-44 rows (4) and (5)): the
     * dispatcher puts them on the job, so a deleted `@OnQueue` would put exports back in front of every email, and a
     * deleted `@RetriesWith` would retry a broken one for most of a day — with every other check green.
     */
    it('places both exports on their own queue with their own retry, and every other job as before', () => {
      const placement = app.get(JobPlacement, { strict: false });
      for (const name of [EXPORT_PDF_REQUESTED, EXPORT_XLSX_REQUESTED]) {
        expect(placement.of(name)).toEqual({ queue: EXPORT_QUEUE, retry: { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } } });
      }
      expect(placement.of(EMAIL_VERIFICATION_REQUESTED)).toEqual({ queue: OUTBOX_QUEUE, retry: DELIVERY_RETRY });
    });

    /**
     * **Every daily job is scheduled** (task 51.2): the routing probe above proves a job reaches its handler once its
     * row exists, and this proves the row is written — a `@RunsDaily` line deleted resolves everything and starts nothing.
     */
    it('schedules the notices’ sweep daily at 07:00 in Chișinău', () => {
      expect(app.get(ScheduleTicker, { strict: false }).scheduled()).toEqual([
        { jobName: REPORT_NOTICE_SWEEP, slot: { at: '07:00', timezone: 'Europe/Chisinau' } },
      ]);
    });
  } else {
    it('provides AuthGuard, which is what the pipeline binds by useExisting', () => {
      expect(app.get<AuthGuard>(AuthGuard, { strict: false })).toBeDefined();
    });
  }
});
