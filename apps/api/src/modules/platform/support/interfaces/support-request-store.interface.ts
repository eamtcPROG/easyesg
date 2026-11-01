import type { Locale } from '@easyesg/i18n';
import type { SupportRequest, SupportSender, SupportTopic } from '../models/support-request.model';

export const SUPPORT_REQUEST_STORE = Symbol('SUPPORT_REQUEST_STORE');

/** A request to record, its sender already resolved, and the window it spends. */
export interface SupportRequestSubmission {
  readonly throttleKey: string;
  readonly now: Date;
  readonly sender: SupportSender;
  readonly topic: SupportTopic;
  readonly question: string;
  readonly replyLocale: Locale;
}

/**
 * `identity.support_request` (task 77; `1793577600000-support-request.ts`). The request tier resolves a signed-in
 * sender, records a request and answers whether a reference is on record; the worker reads one to mail it and purges
 * the old. Nothing updates a row.
 */
export interface SupportRequestStore {
  /**
   * A signed-in reader as the request names them — the account's name (UX-137's display name) and address, and the
   * active organization's name where the session acts for one — or `null` where the account is gone.
   */
  senderOf(query: { readonly accountId: string; readonly organizationId: string | null }): Promise<SupportSender | null>;

  /**
   * Spends one attempt of the sender's window and, if it is admitted, records the request and the outbox event that
   * mails it — one transaction, so a request is never recorded without its mail. Answers the reference, or `null`
   * where the window refused it, in which case nothing was recorded and no attempt was spent.
   */
  submit(submission: SupportRequestSubmission): Promise<{ readonly reference: string } | null>;

  /** One request by its id, as the worker mails it; `null` once purged. */
  read(query: { readonly id: string }): Promise<SupportRequest | null>;

  isOnRecord(query: { readonly reference: string }): Promise<boolean>;

  /** Deletes every request sent more than `months` calendar months before `asOf`, and answers how many. */
  purgeOlderThan(input: { readonly asOf: Date; readonly months: number }): Promise<number>;
}
