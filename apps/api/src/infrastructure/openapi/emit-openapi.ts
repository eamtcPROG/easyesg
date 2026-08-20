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
 *
 * **`preview: true` since task 11**, when `PersistenceModule` began opening connections at boot.
 * Preview mode builds the module graph without instantiating providers, so no `DataSource`
 * connects and this gate keeps running with no database — verified as emitting a byte-identical
 * document with a real path present, because Swagger reads decorator metadata rather than
 * instances.
 *
 * **The cost is real and is accepted rather than overlooked:** a full boot also proved the DI
 * graph resolves, and preview mode does not. A missing provider or a circular dependency will now
 * surface when the app actually starts instead of here. That trade buys eight of the nine gates
 * staying runnable without Docker; the ninth, `migrations:check`, needs it by nature.
 */
async function emit(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false, preview: true });
  await app.init();

  const document = buildOpenApiDocument(app);
  const target = resolve(process.cwd(), '../../packages/contracts/openapi/v1.json');

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
  process.stdout.write(`OpenAPI ${document.openapi} written to ${target}\n`);
}

void emit();
