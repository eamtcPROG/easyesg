import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { APP_MODE } from '../src/config/configuration';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { AuthGuard } from '../src/modules/identity/session/guards/auth.guard';

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

  beforeAll(async () => {
    await initialiseCatalogue();
    // `createApplicationContext` and not `create`: this is the worker's own factory, and using it
    // for both means the HTTP run exercises the same resolution path rather than a friendlier one.
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
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
  } else {
    it('provides AuthGuard, which is what the pipeline binds by useExisting', () => {
      expect(app.get<AuthGuard>(AuthGuard, { strict: false })).toBeDefined();
    });
  }
});
