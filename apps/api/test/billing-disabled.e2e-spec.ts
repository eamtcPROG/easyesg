import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import {
  BILLING_DATA_SOURCE,
  CORE_DATA_SOURCE,
} from '../src/infrastructure/persistence/data-source';

/**
 * NFR-1 and DR-1's backstop: with `BILLING_ENABLED=false`, the compliance core must still work.
 *
 * **This suite exists because "the suites pass with the flag set" proves nothing.** They passed
 * before the flag did anything, and would keep passing if someone deleted the conditional
 * registration — the rule that matches nothing, which this repository has now caught three times.
 * What makes the backstop real is asserting the flag has an observable effect: billing's connection
 * is present when it is on and **absent** when it is off.
 *
 * The flag is read at module-definition time (`PersistenceModule` calls `configuration()` before
 * dependency injection exists to answer it), so a single process cannot exercise both branches.
 * The suite therefore asserts against whichever mode it was launched in, and CI runs it in both:
 * the `database` job with billing on, the `billing-off` job with it off. Neither run alone proves
 * the flag works; the pair does.
 */

const billingEnabled = process.env.BILLING_ENABLED !== 'false';

describe(`billing context, BILLING_ENABLED=${String(billingEnabled)} (DR-1, NFR-1)`, () => {
  let app: INestApplicationContext;

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('registers the compliance core either way — it never depends on billing', () => {
    const core = app.get<DataSource>(getDataSourceToken(CORE_DATA_SOURCE));
    expect(core.isInitialized).toBe(true);
  });

  it(`${billingEnabled ? 'registers' : 'does not register'} the billing connection`, () => {
    const resolveBilling = () => app.get<DataSource>(getDataSourceToken(BILLING_DATA_SOURCE));

    if (billingEnabled) {
      expect(resolveBilling().isInitialized).toBe(true);
    } else {
      // Not "registered but unused" — absent. AD-14 constraint 3 makes disabling the context a
      // matter of not registering the second data source, which is also what makes a cross-context
      // entity relation impossible to declare rather than merely forbidden.
      expect(resolveBilling).toThrow();
    }
  });

  it('serves the compliance core’s own storage regardless', async () => {
    const core = app.get<DataSource>(getDataSourceToken(CORE_DATA_SOURCE));
    // A tenant-scoped read with no tenant bound returns nothing rather than failing (AD-2's
    // fail-closed default). The assertion is that the query runs at all: core's schema is reachable
    // on a connection that knows nothing about billing.
    const rows = await core.query<{ count: string }[]>(
      `SELECT count(*)::text AS count FROM core.organization`,
    );
    expect(rows[0].count).toBe('0');
  });
});
