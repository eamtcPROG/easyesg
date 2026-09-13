import type { Locale } from '@easyesg/i18n';
import type { Clock } from '@api/contracts/clock.port';
import type { SeatAllowance } from '@api/contracts/seat-allowance.port';
import { withinSeatAllowance } from '@api/modules/identity/access/domain/seat-ceiling';
import {
  SeatAllowanceReachedError,
  SeatAllowanceUnavailableError,
} from '@api/modules/identity/access/errors/seat.errors';
import {
  admitAuthAttempt,
  invitationMailThrottleKey,
} from '@api/modules/identity/account/domain/auth-throttle';
import { normaliseEmail } from '@api/modules/identity/account/domain/email-address';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import { INVITATION_ISSUED, type InvitationIssued } from '../constants/invitation.constants';
import { issueInvitationToken } from '../domain/invitation-token';
import { AlreadyMemberError } from '../errors/invitation.errors';
import type { InvitationStore } from '../interfaces/invitation-store.interface';
import type { Invitation, InvitedRole } from '../models/invitation.model';

export interface IssueInvitationCommand {
  readonly email: string;
  readonly role: InvitedRole;
  /**
   * Negotiated from the inviting administrator's `Accept-Language` (OQ-46), used only when the
   * invited address has no account of its own. Resolved by `InvitationService` from ambient request
   * context, which is why the controller never supplies it — the same seam `AccountService` uses
   * for registration.
   */
  readonly inviterLocale: Locale;
  /**
   * The organization this invitation belongs to, for task 141's amplification key and task 142's
   * seat-allowance query **only**.
   *
   * **It is not a tenancy input and must never become one.** RLS scopes every statement this use
   * case runs, and `InvitationStore`'s own header states the rule it is answering: *"nothing below
   * takes an organization id, and that absence is the tenancy model working."* No store method
   * gains one here — the value is read by `invitationMailThrottleKey` and by `SeatAllowance`, whose
   * configured source ignores it and whose task-54.2 source is keyed by it, and it arrives from
   * `AuthGuard`'s membership lookup through `InvitationService`, which is AD-2's own source rather
   * than a second one.
   *
   * Why the key needs it: an address-only key would let one tenant's invitations exhaust another
   * tenant's budget for the same person, which turns a privacy control into a cross-tenant denial
   * of service. `auth-throttle.ts` carries the rest of the argument, including why one key serves
   * both mail routes rather than one each.
   */
  readonly organizationId: string;
}

/**
 * UC-60 — invite a user to the organization (FR-57), and the issuing half of FR-11.
 *
 * Framework-free, as `domain-free-of-frameworks` requires: no `@Injectable`, no TypeORM, no HTTP.
 * `invitation.module.ts` constructs it with `useFactory`.
 *
 * It reads as UC-60's main success scenario — an address, a role, an invitation issued through the
 * common notification mechanism — with the two refusals §12.5.6's collision row decided placed
 * where each can actually be enforced.
 *
 * **The email is an outbox row, not a send** (P-8, AD-6). Sending inside the transaction is the
 * dual write AD-10 rejects, and here its failure is concrete: roll back after the send and a
 * colleague holds a working link into an organization that never invited them.
 *
 * **No `run()` and no transaction of its own.** Every statement below is on the request's
 * `QueryRunner`, so the invitation row and the outbox row commit with the request or not at all.
 *
 * **UC-60's seat precondition is task 142's interim ceiling**, not an entitlement: `EntitlementPort`
 * has no implementation until task 54, so the allowance comes through `SeatAllowance` and task 54.2
 * swaps its source without touching this file (`architecture.md` §12.5.6's task-142 row). Two
 * orderings in `execute` are the decision rather than taste — the ceiling is read before anything is
 * written, so an unreadable one refuses cleanly, and it is **checked after the insert**, so an address
 * already outstanding is still refused as the collision it is, with its own way out, rather than as
 * a full organization.
 */
export class IssueInvitation {
  constructor(
    private readonly store: InvitationStore,
    private readonly seats: SeatAllowance,
    private readonly now: Clock,
  ) {}

  async execute(command: IssueInvitationCommand): Promise<Invitation> {
    const invitedEmail = normaliseEmail(command.email);

    // **Task 141's amplification window, spent by a success and by nothing else.**
    //
    // Normalised first, so the key agrees with `account_email_key`'s idea of identity and two
    // spellings of one address cannot buy two budgets.
    //
    // A refusal throws straight out of the request transaction, which is safe for the reason
    // `ResendInvitation` states: `admitAuthAttempt` records nothing when it refuses. What is worth
    // knowing *here* is the other direction — this row IS written before the two collision checks
    // below, and either of those rolls it back with the rest of the request. That is correct rather
    // than incidental: a refused issue sends no mail, so it should cost no budget, and the trap the
    // repository records from task 21 happens to produce exactly the behaviour this control wants.
    if (
      !(await admitAuthAttempt(this.store, {
        key: invitationMailThrottleKey({
          organizationId: command.organizationId,
          email: invitedEmail,
        }),
        now: this.now(),
      }))
    ) {
      throw new AuthRateLimitedError();
    }

    // The membership collision, checked rather than constrained — the two tables cannot share an
    // index, and no constraint can express "not an active member of this organization" across them.
    // It is a read-then-write check and therefore racy in principle: an invitation issued in the
    // same instant a membership is created would pass. That race is benign and the alternative is
    // not — the losing outcome is one redundant invitation, which acceptance (task 26.2) resolves
    // by finding the person already a member, while a trigger enforcing it would put a cross-table
    // rule in the one place `esg_app` cannot be made to see it fail.
    if (await this.store.hasActiveMemberWithEmail(invitedEmail)) throw new AlreadyMemberError();

    // Task 142: the ceiling, read before anything is written. Null is fail-closed (§12.5.6) — an
    // unreadable ceiling refuses rather than admitting a write past a number nobody can see.
    const allowance = await this.seats.allowanceFor({ organizationId: command.organizationId });
    if (allowance === null) throw new SeatAllowanceUnavailableError();

    // FR-169, resolved here and stored, so every resend of this invitation speaks the same language
    // and the worker needs no fallback of its own (§12.5.6, task 26.1).
    const locale = (await this.store.findAccountLocale(invitedEmail)) ?? command.inviterLocale;

    const token = issueInvitationToken(this.now());

    // The pending-address collision is the index's to refuse, and the store translates it. Nothing
    // reads first: two simultaneous invitations of one address both pass a read-then-write check
    // and one of them is wrong (`RegisterAccount` records the same reasoning for registration).
    const invitation = await this.store.issue({
      invitedEmail,
      role: command.role,
      locale,
      tokenHash: token.hash,
      expiresAt: token.expiresAt,
    });

    // Task 142's gate, after the insert and under the organization's seat lock, so the count includes
    // this invitation and no simultaneous one can slip past it. A refusal throws out of the request
    // transaction and takes the row, the throttle attempt and — because the email is emitted below —
    // no outbox row with it: a refused invitation sends nothing and costs nothing.
    const held = await this.store.countSeatsHeldUnderLock();
    if (!withinSeatAllowance({ allowance, held })) {
      throw new SeatAllowanceReachedError({ limit: allowance, used: held - 1 });
    }

    await emitInvitationEmail(this.store, invitation, token.value);

    return invitation;
  }
}

/**
 * Commits the intent to email an invitation, on the caller's transaction.
 *
 * A free function rather than a method on either use case, for `issueVerificationChallenge`'s
 * reason: `IssueInvitation` and `ResendInvitation` do exactly this and the two must not diverge —
 * a resend carrying a different template, event name or idempotency scheme would be a second
 * invitation flow wearing the first one's name.
 *
 * A `Pick`, not the whole store (ISP): it needs exactly these two operations, and the narrowing is
 * what says the shared step reads nothing else and writes nothing else.
 */
export async function emitInvitationEmail(
  store: Pick<InvitationStore, 'emit' | 'activeOrganizationName'>,
  invitation: Invitation,
  token: string,
): Promise<void> {
  const payload: InvitationIssued = {
    invitationId: invitation.id,
    organizationName: await store.activeOrganizationName(),
    email: invitation.invitedEmail,
    locale: invitation.locale,
    // The raw value, which exists nowhere else once this returns — the table holds its SHA-256.
    // OQ-54 records the decision and what bounds the exposure.
    token,
  };

  await store.emit({
    eventType: INVITATION_ISSUED,
    payload: { ...payload },
    // A natural key, as AD-6 asks: one invitation, one issuance window. A re-emitted row after a
    // dispatcher crash carries the same key and is discarded by the queue rather than sending a
    // second email — while a genuine resend has rotated `expiresAt` and is therefore a different
    // key, which is the behaviour that matters in both directions. It is the same construction
    // `issueVerificationChallenge` uses, and it works here for the same reason: the expiry moves
    // with every issuance and with nothing else.
    idempotencyKey: `${INVITATION_ISSUED}:${invitation.id}:${invitation.expiresAt.getTime()}`,
  });
}
