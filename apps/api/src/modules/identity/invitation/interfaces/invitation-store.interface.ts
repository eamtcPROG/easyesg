import type { Locale } from '@easyesg/i18n';
import type { Invitation, InvitedRole, PendingInvitation } from '../models/invitation.model';

/**
 * The `identity/invitation` store — `MembershipStore`'s shape, and **no `run()`** for the same
 * reason.
 *
 * An invitation is tenant data, so AD-14 constraint 2 puts every query on the **request's**
 * `QueryRunner` — the one carrying `app.current_org`, without which RLS returns zero rows rather
 * than an error. The unit of work is therefore the request itself, committed by
 * `TransactionInterceptor` and rolled back by `ProblemDetailsFilter`. A `run()` here would open a
 * *second* transaction able to commit while the request's rolls back, which on this port would
 * split the invitation row from the outbox row that emails it — the dual write P-8 exists to
 * remove.
 *
 * **Nothing below takes an organization id, and that absence is the tenancy model working.** RLS
 * scopes every statement to `app.current_org`; a method taking one would be a second, contradictory
 * source of tenancy of exactly the kind AD-2 and UX-2 forbid.
 */
export interface InvitationStore {
  /**
   * S-16's outstanding-invitation list (FR-56, FR-57).
   *
   * **Every `pending` row, expired ones included** — the list must publish exactly what the partial
   * unique index constrains. Filtering by the clock here would give an administrator a `409` on
   * re-invite for a row they cannot see and therefore cannot resend or revoke, which is a dead end
   * assembled from two individually reasonable decisions.
   */
  listPending(): Promise<PendingInvitation[]>;

  /** By the invitation's own id. Null when it is another tenant's, which RLS makes the same thing. */
  findInvitation(invitationId: string): Promise<Invitation | null>;

  /**
   * Does an **active member** of this organization already hold this address? UC-60's other refusal.
   *
   * Case-insensitive, matching `account_email_key`'s `lower(email)`. It reads across the join to
   * `identity.account`, which carries no RLS of its own — safe precisely because the driving side
   * is `identity.membership`, whose policy decides which memberships are visible at all.
   */
  hasActiveMemberWithEmail(email: string): Promise<boolean>;

  /**
   * FR-169's per-recipient language, where the recipient already exists.
   *
   * Null when no account holds the address, which is the ordinary case for an invitation and is
   * why the caller carries a fallback. It discloses nothing: the result never reaches the
   * administrator, only the language their colleague's email is written in.
   */
  findAccountLocale(email: string): Promise<Locale | null>;

  /**
   * UC-60. Throws `InvitationAlreadyPendingError` on `invitation_pending_address_key`, for the
   * reason `insertUnverifiedAccount` gives: a read-then-write check admits both of two simultaneous
   * attempts and one of them is wrong.
   */
  issue(input: {
    readonly invitedEmail: string;
    readonly role: InvitedRole;
    readonly locale: Locale;
    readonly tokenHash: Buffer;
    readonly expiresAt: Date;
  }): Promise<Invitation>;

  /**
   * UC-61's resend, as the rotation §12.5.6 decided: a fresh token and a fresh window on the same
   * row, which invalidates the outstanding link and leaves exactly one live.
   *
   * Conditional on the row still being `pending`, so the claim is the database's rather than the
   * application's — false when it was accepted or revoked between the read and here.
   */
  reissueToken(input: {
    readonly invitationId: string;
    readonly tokenHash: Buffer;
    readonly issuedAt: Date;
    readonly expiresAt: Date;
  }): Promise<boolean>;

  /**
   * UC-61's revoke (FR-57) — the link dead immediately, the row retained. False when nothing
   * matched.
   *
   * There is no delete, at any layer: no runtime role holds `DELETE` on the table (task 26.1), so
   * this is not a convention a later caller can route around.
   */
  revoke(input: { readonly invitationId: string; readonly at: Date }): Promise<boolean>;

  /**
   * The organization's name as the invitation email must state it, read inside the request
   * transaction so it is the name that stood when the administrator sent it.
   *
   * It is on this port rather than resolved by the worker because no grant lets `esg_worker` read
   * `core.organization` across tenants, and none should — §7.6's read surface is deliberately
   * narrow. It is on the *store* rather than passed in by the service because the service holds a
   * request context, not a tenant read.
   */
  activeOrganizationName(): Promise<string>;

  /**
   * Commits the intent to send, on **this** transaction (P-8, AD-6). The invitation row and the
   * outbox row commit together or neither does — roll back after a send and someone holds a working
   * invitation link to an organization that never issued one.
   */
  emit(effect: {
    readonly eventType: string;
    readonly payload: Record<string, unknown>;
    readonly idempotencyKey: string;
  }): Promise<void>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const INVITATION_STORE = Symbol('INVITATION_STORE');
