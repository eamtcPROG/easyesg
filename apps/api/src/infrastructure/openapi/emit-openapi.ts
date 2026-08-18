import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { buildOpenApiDocument } from './document.factory';

/**
 * Emits the spec as a committed artefact so CI can diff it (P-5).
 *
 * The application is created but never listens: this runs in the build, and a process
 * that binds a port in CI is a flake waiting to happen.
 *
 * A PR that changes a route must commit the regenerated spec, which is what makes
 * "OpenAPI generated from source and diffed in CI" a gate rather than an aspiration.
 */
async function emit(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const document = buildOpenApiDocument(app);
  const target = resolve(process.cwd(), '../../packages/contracts/openapi/v1.json');

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
  process.stdout.write(`OpenAPI ${document.openapi} written to ${target}\n`);
}

void emit();
