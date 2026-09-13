import type { AccessStore } from '../interfaces/access-store.interface';
import { FakeSeatAllowance } from '../testing/seat-allowance.fake';
import { ReadSeatConsumption } from './read-seat-consumption.use-case';

const ORGANIZATION = '01920000-0000-7000-8000-0000000000b1';

/** A store holding a fixed count. The list is not this use case's to read, and reading it fails. */
const storeHolding = (held: number): AccessStore => ({
  listAccess: () => Promise.reject(new Error('ReadSeatConsumption must not read the list')),
  countSeatsHeld: () => Promise.resolve(held),
});

describe('ReadSeatConsumption (task 142)', () => {
  it('answers the ceiling and the seats held against it', async () => {
    const seats = new FakeSeatAllowance(10);

    await expect(
      new ReadSeatConsumption(storeHolding(4), seats).execute({ organizationId: ORGANIZATION }),
    ).resolves.toEqual({ allowance: 10, used: 4 });

    // The configured source ignores it; task 54.2's is keyed by it. A missing id would pass today.
    expect(seats.asked).toEqual([{ organizationId: ORGANIZATION }]);
  });

  /**
   * **A read does not fail closed; the gates do.** The list beside the region is still true, and
   * S-16 has a state for a count it cannot show — so an unreadable ceiling is answered, not refused.
   */
  it('answers an unreadable ceiling as null and still counts', async () => {
    await expect(
      new ReadSeatConsumption(storeHolding(4), new FakeSeatAllowance(null)).execute({
        organizationId: ORGANIZATION,
      }),
    ).resolves.toEqual({ allowance: null, used: 4 });
  });
});
