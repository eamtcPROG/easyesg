import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';
import {
  ADMIN_INVITATION_STANDING,
  type UnacceptableAdminInvitationStanding,
} from '../domain/admin-invitation-standing';

/**
 * Refusals about administrator invitations (task 67.4) — A-08's side and A-20's.
 */

/** No pending invitation by that id — never issued, accepted, or revoked. */
export class AdminInvitationNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.admin.invitation_not_found');
  }
}

/**
 * The address already carries a pending invitation — the tenant type, since the resolution is the
 * same sentence: resend it or revoke it. Raised from the partial unique index, not a prior read.
 */
export class AdminInvitationOutstandingError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.InvitationOutstanding;
  readonly status = 409;

  constructor() {
    super('platform.admin.invitation_outstanding');
  }
}

/**
 * A-20's *not acceptable* state: `410`, the tenant acceptance's status, because the link existed and
 * is gone. **One key per standing**, since each is a different true sentence to the invitee, declared
 * as a literal map so every key is greppable.
 */
const NOT_ACCEPTABLE_KEY = {
  [ADMIN_INVITATION_STANDING.EXPIRED]: 'platform.admin.invitation_standing.expired',
  [ADMIN_INVITATION_STANDING.REVOKED]: 'platform.admin.invitation_standing.revoked',
  [ADMIN_INVITATION_STANDING.ACCEPTED]: 'platform.admin.invitation_standing.accepted',
  [ADMIN_INVITATION_STANDING.UNKNOWN]: 'platform.admin.invitation_standing.unknown',
} as const satisfies Record<UnacceptableAdminInvitationStanding, string>;

export class AdminInvitationNotAcceptableError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.InvitationNotAcceptable;
  readonly status = 410;

  constructor(standing: UnacceptableAdminInvitationStanding) {
    super(NOT_ACCEPTABLE_KEY[standing], undefined, { standing });
  }
}

/**
 * An acceptance with no factor staged — a client that skipped A-20's enrolment step. The account may
 * not exist without a confirmed second factor (FR-75), so there is nothing to confirm a code against.
 */
export class AdminEnrolmentMissingError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.admin.enrolment_missing');
  }
}
