import type { Locale } from '@easyesg/i18n';
import type { Clock } from '@api/contracts/clock.port';
import { supportRequestThrottleKey } from '../domain/support-request-throttle';
import { SupportChannelUnavailableError, SupportRequestThrottledError, SupportSenderRequiredError } from '../errors/support.errors';
import type { SupportChannelReader } from '../interfaces/support-channel-reader.interface';
import type { SupportRequestStore } from '../interfaces/support-request-store.interface';
import type { SupportSender, SupportTopic } from '../models/support-request.model';

export interface SubmitSupportRequestCommand {
  /** The signed-in reader's account — `AuthGuard`'s, never the body's — or `null` for a visitor. */
  readonly accountId: string | null;
  /** The organization the session acts for, whose name travels with the request; `null` for a visitor or none. */
  readonly organizationId: string | null;
  /** What a visitor gave. Ignored for a signed-in reader, who is never asked (UX-109). */
  readonly visitor: { readonly name?: string; readonly email?: string };
  readonly topic: SupportTopic;
  readonly question: string;
  readonly replyLocale: Locale;
}

/**
 * UC-182 (task 77; FR-212; `architecture.md` §12.5.6's task-77 row (1) … (6)): a reader's question recorded with its
 * reference, and its mail to support queued on the same transaction.
 *
 * 1. **The channel first**: with no readable support address, nothing is recorded (row (5)).
 * 2. **The sender**: a signed-in reader is the account, its name and address, and the active organization's name —
 *    never what the body says; a visitor must give a name and an address. An account gone between the guard and here
 *    is a visitor that gave nothing.
 * 3. **The window**: five in fifteen minutes per sender (row (6)), spent in the store's transaction.
 */
export class SubmitSupportRequest {
  constructor(
    private readonly store: SupportRequestStore,
    private readonly channel: SupportChannelReader,
    private readonly now: Clock,
  ) {}

  async execute(command: SubmitSupportRequestCommand): Promise<{ readonly reference: string }> {
    if (this.channel.inForce() === null) throw new SupportChannelUnavailableError();

    const sender = await this.senderOf(command);
    if (sender === null) throw new SupportSenderRequiredError();

    const recorded = await this.store.submit({
      throttleKey: supportRequestThrottleKey(
        sender.accountId === null ? { email: sender.email } : { accountId: sender.accountId },
      ),
      now: this.now(),
      sender,
      topic: command.topic,
      question: command.question,
      replyLocale: command.replyLocale,
    });
    if (recorded === null) throw new SupportRequestThrottledError();
    return recorded;
  }

  private async senderOf(command: SubmitSupportRequestCommand): Promise<SupportSender | null> {
    if (command.accountId !== null) {
      return this.store.senderOf({ accountId: command.accountId, organizationId: command.organizationId });
    }
    const { name, email } = command.visitor;
    if (name === undefined || name === '' || email === undefined || email === '') return null;
    return { accountId: null, name, email, organizationName: null };
  }
}
