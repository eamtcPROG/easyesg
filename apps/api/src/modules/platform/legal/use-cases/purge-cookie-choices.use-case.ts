import { COOKIE_CHOICE_KEPT_MONTHS } from '@easyesg/i18n';
import type { CookieChoiceStore } from '../interfaces/cookie-choice-store.interface';

/**
 * The day's purge of the cookie banner's answers (task 223; FR-206 AC-10; §12.5.6's task-223 row (4)): every answer
 * older than the twelve months its cookie lasts, deleted. Past that the cookie it proves has expired, so the row proves
 * nothing a browser still holds, and it names an account.
 *
 * **Counted from the moment the day's slot opened**, which the handler reads from the job's row, so a purge retried
 * hours later deletes what that morning's would have and no more.
 */
export class PurgeCookieChoices {
  constructor(private readonly store: CookieChoiceStore) {}

  execute(command: { readonly asOf: Date }): Promise<number> {
    return this.store.purgeOlderThan({ asOf: command.asOf, months: COOKIE_CHOICE_KEPT_MONTHS });
  }
}
