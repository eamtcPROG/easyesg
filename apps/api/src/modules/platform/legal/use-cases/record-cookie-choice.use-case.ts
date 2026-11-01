import { COOKIE_POLICY_VERSION_IN_FORCE } from '@easyesg/i18n';
import { CookiePolicyVersionChangedError } from '../errors/legal.errors';
import type { CookieChoiceStore } from '../interfaces/cookie-choice-store.interface';
import type { RecordedCookieChoice } from '../models/cookie-choice.model';

export interface RecordCookieChoiceCommand {
  /** The cookie policy version the banner was shown under. */
  readonly policyVersion: string;
  /** The signed-in reader's account, or null for a visitor — the request's, never the body's. */
  readonly accountId: string | null;
}

/**
 * UC-179's answer (task 223; FR-206 behaviour 4; §12.5.6's task-223 row (2), (3)): the reader was told what the site
 * sets, under this version of the cookie policy, at this moment — and by this account, when they were signed in.
 *
 * **A version that is not in force is refused and nothing is recorded**, task 195's rule for the terms: a banner read
 * before a release replaced the policy must not be recorded as an answer to the new one. The web shows the banner again.
 *
 * **There is one answer, so the command carries no choice.** Every cookie is strictly necessary (OQ-23's finding), so
 * *I understand* and the settings' *Save* say the same thing, and a column holding it would hold one value forever.
 */
export class RecordCookieChoice {
  constructor(private readonly store: CookieChoiceStore) {}

  async execute(command: RecordCookieChoiceCommand): Promise<RecordedCookieChoice> {
    if (command.policyVersion !== COOKIE_POLICY_VERSION_IN_FORCE) throw new CookiePolicyVersionChangedError();
    return this.store.record({ policyVersion: command.policyVersion, accountId: command.accountId });
  }
}
