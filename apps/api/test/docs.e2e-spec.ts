import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';

/**
 * The interactive docs surface (P-5, DR-11).
 *
 * The strong assertion here is the last one: the document `/docs-json` serves at runtime is
 * **deep-equal to the committed contract** `openapi:check` diffs. One generator feeds both, so
 * this should be true by construction — but "by construction" is a claim about today's wiring,
 * and the two are produced differently (the gate emits from a `preview` app before `init`, the
 * runtime serves from a booted one). If a future change makes Swagger read anything only a full
 * boot provides, the emitted contract silently loses it while the served one keeps it; this is
 * the test that notices.
 */
describe('API docs (P-5, DR-11)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('serves the interactive UI at /docs, outside the versioned prefix like /health', async () => {
    const response = await request(app.getHttpServer()).get('/docs').expect(200);
    expect(response.headers['content-type']).toContain('text/html');
  });

  it('serves at /docs exactly, not under /api/v1', async () => {
    await request(app.getHttpServer()).get('/api/v1/docs').expect(404);
  });

  it('serves the raw document at /docs-json, equal to the committed contract', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);

    const committed: unknown = JSON.parse(
      readFileSync(resolve(__dirname, '../../../packages/contracts/openapi/v1.json'), 'utf8'),
    );

    expect(response.body).toEqual(committed);
  });
});
