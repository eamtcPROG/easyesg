/**
 * The addresses this platform will not write to again (task 51.4; FR-171, NFR-107).
 *
 * **Narrow on purpose** (`di-interface-segregation`): the channel asks one question before a send and
 * states one fact after a refusal. There is no listing and no removal — an address coming back to life
 * is a support action against a table the worker holds no `DELETE` on, which is the same shape the
 * ledger and the audit log take.
 *
 * **It is not tenant-scoped, and that is the decision rather than an omission.** A bounce is a property
 * of the mailbox; suppressing per organization would leave every other organization writing to a mailbox
 * already known to be gone (§12.5.6's task-51.4 row).
 */
export interface SuppressionStore {
  /** Whether this address is suppressed. The argument is already `suppressionKey`'d. */
  isSuppressed(addressKey: string): Promise<boolean>;
  /** Records a refusal. Writing one twice is not an error — the second is the same fact. */
  suppress(command: SuppressAddressCommand): Promise<void>;
}

export interface SuppressAddressCommand {
  readonly addressKey: string;
  readonly reason: SuppressionReason;
  /** The provider's own words, for support. Never shown to anyone (CLAUDE.md, user-facing text). */
  readonly detail: string;
}

/**
 * Why an address is suppressed. One member, mirroring the table's `CHECK` — a complaint would be the
 * second, and nothing produces one: a feedback loop is an ESP relationship and SMTP has none.
 */
export const SUPPRESSION_REASON = { HARD_BOUNCE: 'hard_bounce' } as const;

export type SuppressionReason = (typeof SUPPRESSION_REASON)[keyof typeof SUPPRESSION_REASON];

export const SUPPRESSION_STORE = Symbol('SUPPRESSION_STORE');
