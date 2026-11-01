import { Logger } from '@nestjs/common';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import {
  SEAT_ALLOWANCE_CONFIG_KIND,
  SEAT_ALLOWANCE_CONFIG_SCOPE,
} from '../constants/seat-allowance.constants';
import { SeatAllowanceService } from './seat-allowance.service';

/**
 * The interim seat ceiling, read from configuration and failing closed (task 142; §12.5.6).
 *
 * Two halves, on `AxisShapeService`'s spec's reasoning: what the reader does with a payload an
 * operator can publish by mistake, and whether the **shipped** artefact reads at all. The second is
 * the one that matters most here, because this reader's failure is not a narrower feature but every
 * invitation and every acceptance refused — so a seed file renamed, mistyped or given a string would
 * take collaboration down with every other gate green, and only a log line would say why.
 */
describe('SeatAllowanceService (task 142)', () => {
  const build = (payload: unknown, revision = 1) => {
    const store = {
      get: (query: { kind: string; scope: string }) =>
        payload === undefined ||
        query.kind !== SEAT_ALLOWANCE_CONFIG_KIND ||
        query.scope !== SEAT_ALLOWANCE_CONFIG_SCOPE
          ? undefined
          : { kind: query.kind, scope: query.scope, revision, payload },
    } as unknown as ConfigurationStore;
    return new SeatAllowanceService(store);
  };

  let logged: string[] = [];

  beforeEach(() => {
    // Captured rather than silenced: fail-closed is only safe when the line saying so is written,
    // and what it names is how an operator finds the revision to replace.
    logged = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('reads the ceiling in force, quietly', async () => {
    await expect(build({ seats: 7 }).allowanceFor()).resolves.toBe(7);
    expect(logged).toEqual([]);
  });

  it('fails closed when no ceiling is in force, and says what is missing', async () => {
    await expect(build(undefined).allowanceFor()).resolves.toBeNull();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain(`${SEAT_ALLOWANCE_CONFIG_KIND}/${SEAT_ALLOWANCE_CONFIG_SCOPE}`);
  });

  it('fails closed on a malformed ceiling, naming the revision to replace', async () => {
    await expect(build({ seats: 0 }, 4).allowanceFor()).resolves.toBeNull();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('revision 4');
  });

  /**
   * **The value is the owner's decision of 13 Sep 2026**, not a default this spec happens to know —
   * so changing the seed without changing §12.5.6 and `use_cases.md` OQ-8's note fails here, which
   * is what makes the number a decision rather than a file edit.
   */
  it('reads the shipped artefact as ten seats, with nothing logged', async () => {
    const service = new SeatAllowanceService(seedConfigurationStore(readSeedEntries()));

    await expect(service.allowanceFor()).resolves.toBe(10);
    expect(logged).toEqual([]);
  });
});
