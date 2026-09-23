import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { initialiseCatalogue } from './app/messages/catalogue';

/** What a started worker logs, once — the browser suite waits on it (`e2e/playwright.config.ts`). */
const WORKER_READY = 'The worker is running: queues consumed and the outbox dispatched.';

/**
 * Worker mode. Same image as `api`, different entrypoint (AD-1, §5.4) — one build, one
 * version, two roles, which is what NFR-89's reproducibility drill rests on.
 *
 * No HTTP listener: this process consumes queues, dispatches the outbox and runs the
 * scheduler. It runs as `esg_worker`, which is RLS-enforced like `esg_app`. Granting the
 * worker BYPASSRLS would be the obvious shortcut and is wrong — the worker is what turns
 * one tenant's regulatory and fiscal record into a PDF, an e-Factura payload and an email.
 */
export async function bootstrapWorker(): Promise<void> {
  // The worker needs this more than the HTTP tier does: it renders every PDF, Excel export and
  // email, and there is no client downstream to resolve a key it leaves unresolved.
  await initialiseCatalogue();

  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  // The one line that says the worker is up — every module initialised, the consumers and the outbox dispatcher
  // started. An HTTP process has a port to answer on; this one has only its log, which is what an operator reads and
  // what the browser suite waits for before its first journey (task 150).
  new Logger('Worker').log(WORKER_READY);
}

