import type { Clock } from '@api/contracts/clock.port';
import type { AccountStore } from '../interfaces/account-store.interface';

export interface DismissEnrolmentPromptCommand {
  readonly accountId: string;
}

/**
 * *Not now* on S-05's prompt to enrol a second factor (task 190; `architecture.md` §12.5.6's task-190 rows (4) … (6);
 * UC-193's trigger, NFR-95).
 *
 * **The account's answer, for good**: it hides the prompt on every device and in every organization the person
 * administers, until turning the factor off clears it (`ManageTotp.disable`).
 *
 * **No role is asked for, and no factor state is checked.** The prompt appears to an Organization Administrator
 * without a factor, but the answer is a preference the person holds about themselves: refusing it from an editor, or
 * from someone who enrolled in another tab a moment ago, would refuse a harmless write for a reason the person cannot
 * act on. It is idempotent — the first answer's time stands.
 */
export class DismissEnrolmentPrompt {
  constructor(
    private readonly store: AccountStore,
    private readonly now: Clock,
  ) {}

  execute(command: DismissEnrolmentPromptCommand): Promise<void> {
    return this.store.run((tx) => tx.dismissEnrolmentPrompt(command.accountId, this.now()));
  }
}
