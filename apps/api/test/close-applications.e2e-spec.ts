import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { CORE_DATA_SOURCE } from '../src/infrastructure/persistence/data-source';
import { configureHttpApp } from '../src/main.http';
import { closeTrackedApplications, trackedApplicationCount } from './support/close-applications';

/**
 * Proves the application teardown's three claims (task 178): an application a suite closes is untracked; one a suite
 * left open is closed when the file ends; and one that finishes booting after the file ended is closed on arrival.
 *
 * **It does not prove jest exits**, which cannot be asserted from inside jest — two throwaway probes established that,
 * each a process that held the test Postgres and Redis open until this teardown existed and exited once it did
 * (`support/close-applications.ts` records them). What this proves is that the application's pool is closed, which is
 * the handle the probes found. The core data source stands for the pool: `isInitialized` goes false only when
 * `app.close()` has run the shutdown that ends it.
 *
 * **The order is the arrangement**: the third case needs the file to have "ended", which the second case's call does.
 */
describe('the e2e application teardown (task 178)', () => {
  const boot = async (): Promise<NestExpressApplication> => {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
    return app;
  };
  const poolOf = (app: NestExpressApplication) => app.get<DataSource>(getDataSourceToken(CORE_DATA_SOURCE));

  beforeAll(async () => {
    await initialiseCatalogue();
  });

  it('untracks an application its suite closes, and a second close is harmless', async () => {
    const before = trackedApplicationCount();
    const app = await boot();
    expect(trackedApplicationCount()).toBe(before + 1);

    await app.close();
    expect(trackedApplicationCount()).toBe(before);
    expect(poolOf(app).isInitialized).toBe(false);
    // A suite's teardown that resumes after this one closed its application calls `close` again.
    await expect(app.close()).resolves.toBeUndefined();
  }, 60_000);

  it('closes an application a suite left open when the file ends', async () => {
    const app = await boot();
    expect(poolOf(app).isInitialized).toBe(true);

    expect(await closeTrackedApplications()).toBeGreaterThan(0);
    expect(poolOf(app).isInitialized).toBe(false);
    expect(trackedApplicationCount()).toBe(0);
  }, 60_000);

  it('closes an application that finishes booting after the file ended, on arrival', async () => {
    // The previous case ended the "file", so this creation is the real run's shape: a setup that timed out mid-boot,
    // whose application arrives with nobody left to close it. Created and not initialised — the teardown is already
    // closing it, and the pool opens at creation.
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    const deadline = Date.now() + 10_000;
    while (poolOf(app).isInitialized && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(poolOf(app).isInitialized).toBe(false);
    expect(trackedApplicationCount()).toBe(0);
  }, 60_000);
});
