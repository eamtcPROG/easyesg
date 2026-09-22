import type { AccountName } from '@api/modules/identity/account/domain/display-name';
import type { MembershipStatus } from '@api/modules/identity/membership/models/membership.model';

/**
 * The two people a reminder is between (task 50.3) — the member it goes to and the administrator sending it — read
 * on the request's own transaction. **A port of this module's, narrow to what a reminder asks**, since neither
 * identity module exports its store and a reminder needs one row from each.
 */
export interface ReminderParties {
  /** The membership as the bound organization holds it, or null — another tenant's reads as none (RLS). */
  recipient(input: { readonly membershipId: string }): Promise<{
    readonly accountId: string;
    readonly status: MembershipStatus;
  } | null>;

  /** The sending account's name parts and address, from which its display name derives (UX-137). */
  sender(input: { readonly accountId: string }): Promise<(AccountName & { readonly email: string }) | null>;
}

export const REMINDER_PARTIES = Symbol('REMINDER_PARTIES');
