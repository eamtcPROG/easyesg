import { SUPPORT_REQUEST_KEPT_MONTHS } from '../constants/support.constants';
import type { SupportRequestStore } from '../interfaces/support-request-store.interface';

/**
 * The night's purge of support requests (task 77; FR-212 behaviour 6; §12.5.7): every request sent more than 24
 * calendar months before the moment the night's slot opened, deleted. **Counted from that moment**, which the handler
 * reads from the job's row, so a purge retried hours later deletes what that night's would have and no more —
 * `PurgeCookieChoices`' shape.
 */
export class PurgeSupportRequests {
  constructor(private readonly store: Pick<SupportRequestStore, 'purgeOlderThan'>) {}

  execute(command: { readonly asOf: Date }): Promise<number> {
    return this.store.purgeOlderThan({ asOf: command.asOf, months: SUPPORT_REQUEST_KEPT_MONTHS });
  }
}
