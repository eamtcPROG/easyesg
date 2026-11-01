import type { SeatAllowance } from '@api/contracts/seat-allowance.port';
import type { AccessStore } from '../interfaces/access-store.interface';
import type { SeatConsumption } from '../models/seat-consumption.model';

export interface ReadSeatConsumptionCommand {
  /**
   * The bound organization, for `SeatAllowance`'s query only — never a store argument. The count is
   * scoped by RLS like every other statement here; this reaches the allowance because task 54.2's
   * source is keyed by organization, and the configured one ignores it.
   */
  readonly organizationId: string;
}

/**
 * S-16's seat region: the ceiling and what holds it (task 142; UC-59's *"seat consumption against
 * the plan's entitlement"*, UX-50).
 *
 * **It does not refuse on an unreadable ceiling, and that is the difference between a read and a
 * gate.** `IssueInvitation` and `AcceptInvitation` fail closed; this one answers `allowance: null`, because the list the
 * region sits beside is still true and the screen has a state for a count it cannot show. Refusing
 * here would take "who can see our ESG data" off the screen over a configuration fault in a number
 * beside it.
 *
 * The count comes from the same query the gates use (`seat.queries.ts`), so what S-16 shows and what
 * refuses an invitation are one statement rather than two that agree today.
 */
export class ReadSeatConsumption {
  constructor(
    private readonly store: AccessStore,
    private readonly seats: SeatAllowance,
  ) {}

  async execute(command: ReadSeatConsumptionCommand): Promise<SeatConsumption> {
    const allowance = await this.seats.allowanceFor({ organizationId: command.organizationId });
    const used = await this.store.countSeatsHeld();
    return { allowance, used };
  }
}
