import type { Locale } from '@easyesg/i18n';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import { INVITATION_TOKEN_TTL_MS } from '../domain/invitation-token';
import { InvitationAlreadyPendingError } from '../errors/invitation.errors';
import type { InvitationStore } from '../interfaces/invitation-store.interface';
import {
  INVITATION_STATUS,
  INVITED_ROLE,
  type Invitation,
  type InvitedRole,
  type PendingInvitation,
} from '../models/invitation.model';

export interface EmittedEffect {
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly idempotencyKey: string;
}

/**
 * An in-memory `InvitationStore` for the use-case specs — no database, no container (CLAUDE.md's
 * check that the dependencies point inward).
 *
 * **It models one organization, because RLS does.** The real store takes no organization id
 * anywhere, so a fake holding rows for several tenants would be modelling a filter the production
 * code does not have — and a spec passing against it would prove something untrue. Cross-tenant
 * behaviour is asserted where it is actually enforced, in `tenant-isolation.e2e-spec.ts`.
 *
 * **It models the partial unique index, not just the happy path.** `issue` throws
 * `InvitationAlreadyPendingError` on a second pending invitation to the same address, exactly as
 * the repository translates `invitation_pending_address_key` — a fake that accepted it would let a
 * spec assert a refusal the production path raises from a place the spec never exercises. That is
 * the `apps/api/CLAUDE.md` rule about fakes modelling behaviour rather than return values, applied
 * to a constraint instead of to a rollback.
 *
 * It writes rather than merely recording calls, so a spec can assert the order-dependent things
 * that matter: that a resend rotates the stored hash, and that the emitted idempotency key differs
 * from the issuing one.
 */
export class FakeInvitationStore implements InvitationStore {
  readonly emitted: EmittedEffect[] = [];

  /** What the table would hold. Exposed so a spec can prove a resend actually rotated it. */
  readonly hashes = new Map<string, Buffer>();

  private sequence = 0;

  constructor(
    private rows: Invitation[] = [],
    private readonly accounts: Record<string, Locale> = {},
    private readonly members: string[] = [],
  ) {}

  get all(): readonly Invitation[] {
    return this.rows;
  }

  listPending(): Promise<PendingInvitation[]> {
    return Promise.resolve(
      this.rows
        .filter((row) => row.status === INVITATION_STATUS.PENDING)
        .map((row) => ({
          id: row.id,
          invitedEmail: row.invitedEmail,
          role: row.role,
          issuedAt: row.issuedAt,
          expiresAt: row.expiresAt,
        })),
    );
  }

  findInvitation(invitationId: string): Promise<Invitation | null> {
    return Promise.resolve(this.rows.find((row) => row.id === invitationId) ?? null);
  }

  hasActiveMemberWithEmail(email: string): Promise<boolean> {
    return Promise.resolve(this.members.includes(email.toLowerCase()));
  }

  findAccountLocale(email: string): Promise<Locale | null> {
    return Promise.resolve(this.accounts[email.toLowerCase()] ?? null);
  }

  issue(input: {
    readonly invitedEmail: string;
    readonly role: InvitedRole;
    readonly locale: Locale;
    readonly tokenHash: Buffer;
    readonly expiresAt: Date;
  }): Promise<Invitation> {
    const outstanding = this.rows.some(
      (row) =>
        row.status === INVITATION_STATUS.PENDING &&
        row.invitedEmail.toLowerCase() === input.invitedEmail.toLowerCase(),
    );
    if (outstanding) return Promise.reject(new InvitationAlreadyPendingError());

    this.sequence += 1;
    const row: Invitation = {
      id: `invitation-${this.sequence}`,
      organizationId: 'organization-under-test',
      invitedEmail: input.invitedEmail,
      role: input.role,
      status: INVITATION_STATUS.PENDING,
      locale: input.locale,
      // The real column defaults to `now()`, which the port does not carry — derived back from
      // the expiry so the two stay consistent for a spec that reads either.
      issuedAt: new Date(input.expiresAt.getTime() - INVITATION_TOKEN_TTL_MS),
      expiresAt: input.expiresAt,
      acceptedAt: null,
      revokedAt: null,
    };
    this.rows = [...this.rows, row];
    this.hashes.set(row.id, input.tokenHash);
    return Promise.resolve(row);
  }

  reissueToken(input: {
    readonly invitationId: string;
    readonly tokenHash: Buffer;
    readonly issuedAt: Date;
    readonly expiresAt: Date;
  }): Promise<boolean> {
    const wrote = this.write(input.invitationId, (row) => ({
      ...row,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
    }));
    if (wrote) this.hashes.set(input.invitationId, input.tokenHash);
    return Promise.resolve(wrote);
  }

  revoke(input: { readonly invitationId: string; readonly at: Date }): Promise<boolean> {
    return Promise.resolve(
      this.write(input.invitationId, (row) => ({
        ...row,
        status: INVITATION_STATUS.REVOKED,
        revokedAt: input.at,
      })),
    );
  }

  activeOrganizationName(): Promise<string> {
    return Promise.resolve('Alpha SRL');
  }

  emit(effect: EmittedEffect): Promise<void> {
    this.emitted.push(effect);
    return Promise.resolve();
  }

  private write(invitationId: string, change: (row: Invitation) => Invitation): boolean {
    const index = this.rows.findIndex(
      (row) => row.id === invitationId && row.status === INVITATION_STATUS.PENDING,
    );
    if (index === -1) return false;
    this.rows = this.rows.map((row, at) => (at === index ? change(row) : row));
    return true;
  }
}

/** A row with the fields a spec cares about named and the rest defaulted. */
export const invitation = (row: {
  id: string;
  invitedEmail?: string;
  role?: InvitedRole;
  status?: Invitation['status'];
  expiresAt?: Date;
}): Invitation => ({
  id: row.id,
  organizationId: 'organization-under-test',
  invitedEmail: row.invitedEmail ?? `${row.id}@example.md`,
  role: row.role ?? INVITED_ROLE.EDITOR,
  status: row.status ?? INVITATION_STATUS.PENDING,
  locale: SOURCE_LOCALE,
  issuedAt: new Date('2026-08-01T00:00:00Z'),
  expiresAt: row.expiresAt ?? new Date('2026-08-08T00:00:00Z'),
  acceptedAt: row.status === INVITATION_STATUS.ACCEPTED ? new Date('2026-08-02T00:00:00Z') : null,
  revokedAt: row.status === INVITATION_STATUS.REVOKED ? new Date('2026-08-02T00:00:00Z') : null,
});
