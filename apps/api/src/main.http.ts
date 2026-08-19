import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './app/filters/problem-details.filter';
import { correlationMiddleware } from './infrastructure/observability/correlation.middleware';
import { initialiseCatalogue } from './app/messages/catalogue';

export async function bootstrapHttp(): Promise<void> {
  // Before anything can serve. The ICU engine is ESM-only and this app is CommonJS, so the
  // catalogue is loaded through a dynamic import (see app/messages/catalogue.ts). A request
  // served before this resolves would carry no wording at all — problem documents with no
  // title, envelope messages with no text.
  await initialiseCatalogue();

  // rawBody is required for webhook HMAC verification: re-serialising JSON changes the
  // bytes the provider signed, and the signature fails for reasons that look like anything
  // except the real cause.
  const app = await NestFactory.create(AppModule, { rawBody: true });

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
  app.useGlobalFilters(new ProblemDetailsFilter());

  app.enableShutdownHooks();

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
}
