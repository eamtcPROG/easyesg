import type { InvitationStore } from '../interfaces/invitation-store.interface';
import type { PendingInvitation } from '../models/invitation.model';

/**
 * The outstanding invitations of the active organization — S-16's other half (FR-56, FR-57).
 *
 * FR-56 asks for every user with access "and their status — active or pending invitation", and
 * task 25.1's migration recorded what that means physically: a union across two tables, made in the
 * read model where the screen actually renders it. `GET /members` answers the membership half;
 * this answers the invitation half, and S-16 puts them in one list.
 *
 * **It lists every `pending` row, expired ones included**, because the collection must publish
 * exactly what the partial unique index constrains. An expired invitation is what refuses a
 * re-invite with `409`, so hiding it would leave an administrator holding a conflict they cannot
 * see, cannot resend and cannot revoke — a dead end assembled from two individually reasonable
 * decisions. `expiresAt` travels on every row so the screen can say which are stale.
 *
 * No `execute` argument at all: the organization comes from RLS and there is nothing else to scope
 * by. Unpaginated, for `ListMembers`' reason — the collection is bounded by the plan's seat
 * entitlement.
 */
export class ListInvitations {
  constructor(private readonly store: InvitationStore) {}

  execute(): Promise<PendingInvitation[]> {
    return this.store.listPending();
  }
}
