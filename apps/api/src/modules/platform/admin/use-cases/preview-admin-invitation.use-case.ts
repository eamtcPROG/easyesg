import type { Clock } from '@api/contracts/clock.port';
import {
  AUTH_ATTEMPT_LIMIT,
  AUTH_ATTEMPT_WINDOW_MS,
  adminInvitationBearerThrottleKey,
} from '@api/modules/identity/account/domain/auth-throttle';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import { hashAdminInvitationToken } from '../domain/admin-invitation-token';
import {
  ADMIN_INVITATION_STANDING,
  adminInvitationStandingOf,
  type UnacceptableAdminInvitationStanding,
} from '../domain/admin-invitation-standing';
import { AdminInvitationNotAcceptableError } from '../errors/admin-invitation.errors';
import type { AdminInvitationBearerStore } from '../interfaces/admin-invitation-bearer-store.interface';
import type { AdminInvitation, PresentedAdminInvitation } from '../models/admin-invitation.model';

export interface PresentAdminInvitationCommand {
  readonly token: string;
  readonly clientIp?: string;
}

const PRESENTED = {
  LIVE: 'live',
  REFUSED: 'refused',
  RATE_LIMITED: 'rate_limited',
} as const;

type Presented =
  | { readonly kind: typeof PRESENTED.LIVE; readonly invitation: PresentedAdminInvitation }
  | { readonly kind: typeof PRESENTED.REFUSED; readonly standing: UnacceptableAdminInvitationStanding }
  | { readonly kind: typeof PRESENTED.RATE_LIMITED };

/**
 * The gate every one of A-20's three routes passes first (task 67.4): the link's token resolved to a
 * live invitation, under the bearer window. **Exported for the other two**, `emitInvitationEmail`'s
 * precedent in the tenant module, because the three routes are one gate followed by three different
 * things — and a gate copied three times is three places to get the window's rule wrong.
 *
 * **Only a refusal spends the window** (§12.5.6's task-67.4 row, the tenant acceptance's rule): a
 * token that resolves is proof its bearer holds a live link, so opening A-20, reloading it and
 * mistyping a code cost nothing, while trying tokens does. **The refusal is recorded in its own unit of
 * work and thrown after that commit** — thrown inside, it would roll its own attempt row back, and the
 * window would never fill for anyone.
 */
export async function presentAdminInvitation(input: {
  readonly store: AdminInvitationBearerStore;
  readonly command: PresentAdminInvitationCommand;
  readonly now: Date;
}): Promise<PresentedAdminInvitation> {
  const { now } = input;
  const key = adminInvitationBearerThrottleKey(input.command.clientIp);

  const presented = await input.store.run(async (tx): Promise<Presented> => {
    const since = new Date(now.getTime() - AUTH_ATTEMPT_WINDOW_MS);
    // The throttle's own refusal records nothing, so a block drains rather than rolling forward.
    if ((await tx.countRecentAuthAttempts(key, since)) >= AUTH_ATTEMPT_LIMIT) {
      return { kind: PRESENTED.RATE_LIMITED };
    }

    const invitation = await tx.findInvitationByTokenHash(hashAdminInvitationToken(input.command.token));
    if (invitation === null) {
      await tx.recordAuthAttempt(key, now);
      return { kind: PRESENTED.REFUSED, standing: ADMIN_INVITATION_STANDING.UNKNOWN };
    }

    const standing = adminInvitationStandingOf(invitation, now);
    if (standing !== ADMIN_INVITATION_STANDING.ACCEPTABLE) {
      await tx.recordAuthAttempt(key, now);
      return { kind: PRESENTED.REFUSED, standing };
    }

    return { kind: PRESENTED.LIVE, invitation };
  });

  switch (presented.kind) {
    case PRESENTED.RATE_LIMITED:
      throw new AuthRateLimitedError();
    case PRESENTED.REFUSED:
      throw new AdminInvitationNotAcceptableError(presented.standing);
    case PRESENTED.LIVE:
      return presented.invitation;
  }
}

export type AdminInvitationPreview = Pick<AdminInvitation, 'email' | 'role' | 'expiresAt'>;

/**
 * A-20's first read (task 67.4): what the link invites — the address and the realm — so the invitee
 * knows which realm they are joining before typing anything. Nothing else of the invitation leaves:
 * not who sent it, not when, and never the staged factor, which is enrolment's to hand out.
 */
export class PreviewAdminInvitation {
  constructor(
    private readonly store: AdminInvitationBearerStore,
    private readonly now: Clock,
  ) {}

  async execute(command: PresentAdminInvitationCommand): Promise<AdminInvitationPreview> {
    const invitation = await presentAdminInvitation({ store: this.store, command, now: this.now() });
    return { email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt };
  }
}
