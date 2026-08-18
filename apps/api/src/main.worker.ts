import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

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
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
}
