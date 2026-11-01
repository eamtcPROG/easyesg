import { Inject, Injectable } from '@nestjs/common';
import type { SupportTickets } from '@api/contracts/support-tickets.port';
import { SUPPORT_REQUEST_STORE, type SupportRequestStore } from '../interfaces/support-request-store.interface';

/**
 * `SUPPORT_TICKETS` (task 77; §12.5.6's task-77 row (9)) — whether a reference names a support request on record, for
 * `platform/support-access`, which refuses a request to read an organization's reports that cites no ticket support
 * holds. The store's read, behind the port the two modules share.
 */
@Injectable()
export class SupportTicketsService implements SupportTickets {
  constructor(@Inject(SUPPORT_REQUEST_STORE) private readonly store: SupportRequestStore) {}

  isOnRecord(query: { readonly reference: string }): Promise<boolean> {
    return this.store.isOnRecord(query);
  }
}
