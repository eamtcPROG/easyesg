import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './app/filters/problem-details.filter';
import { correlationMiddleware } from './infrastructure/observability/correlation.middleware';
import { initialiseCatalogue } from './app/messages/catalogue';
import { buildOpenApiDocument } from './infrastructure/openapi/document.factory';
import { rollbackTenantTransaction } from './infrastructure/persistence/tenant-transaction';

/**
 * Everything that shapes the HTTP surface, in one place so it cannot drift from what is tested.
 *
 * `bootstrapHttp` calls this and then listens; the e2e suite calls it and does not. That matters
 * more than it looks: an end-to-end test against a hand-assembled app proves the pipeline that
 * test built, not the one that ships — and the first casualty is usually the global prefix or the
 * filter registration order, both of which are silent when wrong.
 */
export function configureHttpApp(app: NestExpressApplication): void {
  // `health` stays outside the versioned surface; NFR-16's route-coverage gate treats that
  // as an allowlist entry rather than an exemption.
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // app.use, not MiddlewareConsumer: this must wrap the guards, and Express 5 changed
  // wildcard path matching.
  app.use(correlationMiddleware);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      // whitelist strips unknown properties; forbidNonWhitelisted turns a typo in a client
      // payload into a 400 rather than a value silently ignored.
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Registered first — see the note in ProblemDetailsFilter about filter scan order.
  //
  // The rollback is passed in here rather than lived inside the filter so the filter stays a pure
  // error formatter with no persistence dependency. It is the only component every failure
  // reaches: a guard that throws never reaches an interceptor, so TransactionInterceptor's commit
  // has no rollback counterpart and this is it (§6.2).
  app.useGlobalFilters(new ProblemDetailsFilter(() => rollbackTenantTransaction()));

  // The interactive UI over the SAME document the CI gate diffs (P-5, DR-11) — one generator,
  // two consumers, so what a developer clicks through cannot drift from what the contract says.
  // Mounted here rather than in bootstrapHttp because this file's whole point is that the e2e
  // suite runs the same surface that ships; a docs route mounted only at boot would be the one
  // route no test ever saw. Serves the UI at /docs and the raw document at /docs-json.
  //
  // `/docs` sits outside `/api/v1` like `health`, and NFR-16's route-coverage diff treats both
  // as explicit allowlist entries. The mount is unconditional: whether the production edge
  // exposes /docs is task 71's routing decision, and a config flag here deferring it would be
  // the flag-that-defers-a-choice anti-pattern CLAUDE.md names. `persistAuthorization` keeps a
  // pasted bearer token across reloads — usable the day task 21 starts issuing them.
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app), {
    swaggerOptions: { persistAuthorization: true },
  });
}

export async function bootstrapHttp(): Promise<void> {
  // Before anything can serve. The ICU engine is ESM-only and this app is CommonJS, so the
  // catalogue is loaded through a dynamic import (see app/messages/catalogue.ts). A request
  // served before this resolves would carry no wording at all — problem documents with no
  // title, envelope messages with no text.
  await initialiseCatalogue();

  // rawBody is required for webhook HMAC verification: re-serialising JSON changes the
  // bytes the provider signed, and the signature fails for reasons that look like anything
  // except the real cause.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  configureHttpApp(app);

  app.enableShutdownHooks();

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
}
