import { Injectable, Logger } from '@nestjs/common';
import type { SeatAllowance } from '@api/contracts/seat-allowance.port';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import {
  SEAT_ALLOWANCE_CONFIG_KIND,
  SEAT_ALLOWANCE_CONFIG_SCOPE,
} from '../constants/seat-allowance.constants';
import { readSeatAllowance } from '../domain/seat-ceiling';

/**
 * `SeatAllowance` over the configuration store — **the one read task 54.2 replaces** (task 142).
 *
 * Validated, never cast, for `SocialProviderCatalogService`'s reason: configuration is data someone
 * edits. Unlike that service, a bad value here does not narrow one feature — it removes the ceiling
 * — so it fails **closed** (§12.5.6) and says so at `error`, naming the revision an operator has to
 * replace. The line is per read rather than once, because an operator fixing it needs to see it stop.
 *
 * **It takes no query.** The configured source is one `global` value, so the organization on
 * `SeatAllowanceQuery` has nothing to select; TypeScript admits an implementation with fewer
 * parameters than its interface, and declaring the argument only to ignore it would read as though
 * it mattered. 54.2's implementation is the one that needs it.
 */
@Injectable()
export class SeatAllowanceService implements SeatAllowance {
  private readonly logger = new Logger(SeatAllowanceService.name);

  constructor(private readonly configurationStore: ConfigurationStore) {}

  allowanceFor(): Promise<number | null> {
    const entry = this.configurationStore.get({
      kind: SEAT_ALLOWANCE_CONFIG_KIND,
      scope: SEAT_ALLOWANCE_CONFIG_SCOPE,
    });
    const artefact = `${SEAT_ALLOWANCE_CONFIG_KIND}/${SEAT_ALLOWANCE_CONFIG_SCOPE}`;

    if (!entry) {
      this.logger.error(
        `No ${artefact} is in force; invitations and acceptances are refused until one is published`,
      );
      return Promise.resolve(null);
    }

    const allowance = readSeatAllowance(entry.payload);
    if (allowance === null) {
      this.logger.error(
        `Configuration entry ${artefact} (revision ${entry.revision}) is malformed — it needs a whole number of seats of at least one; invitations and acceptances are refused until it is replaced`,
      );
    }
    return Promise.resolve(allowance);
  }
}
