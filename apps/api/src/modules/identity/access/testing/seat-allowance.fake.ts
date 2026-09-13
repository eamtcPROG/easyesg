import type { SeatAllowance, SeatAllowanceQuery } from '@api/contracts/seat-allowance.port';

/**
 * A `SeatAllowance` answering a fixed ceiling — or `null`, which is the fail-closed case the real
 * source produces for an absent or malformed artefact (task 142).
 *
 * **It records what it was asked**, because the organization on the query reaches nothing in the
 * configured source: a spec that did not look would pass with the id missing, and task 54.2's source
 * is the one that needs it.
 */
export class FakeSeatAllowance implements SeatAllowance {
  readonly asked: SeatAllowanceQuery[] = [];

  constructor(private readonly allowance: number | null) {}

  allowanceFor(query: SeatAllowanceQuery): Promise<number | null> {
    this.asked.push(query);
    return Promise.resolve(this.allowance);
  }
}
