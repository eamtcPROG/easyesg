import type { AuthAttemptRecorder } from '@api/modules/identity/account/domain/auth-throttle';
import type { PresentedAdminInvitation } from '../models/admin-invitation.model';
import type { AdminRole } from '../models/admin-session.model';

/**
 * What a link's bearer can reach (task 67.4; A-20) — the tenant `InvitationBearerStore`'s shape over
 * the admin realm, with no binding to set because the realm's tables carry no row security.
 *
 * **Its usage rule is sign-in's**: a refusal that must count against the bearer window is recorded
 * in one `run` and thrown after that commit, because a throw inside the unit of work would roll the
 * attempt back with everything else — the trap `AdminSessionStore`'s header describes.
 *
 * The staged secret is sealed and opened by the adapter, as the account's is (task 27.1).
 */
export interface AdminInvitationBearerTransaction extends AuthAttemptRecorder {
  findInvitationByTokenHash(tokenHash: Buffer): Promise<PresentedAdminInvitation | null>;

  /**
   * Stages the factor on a still-pending invitation **unless one is already staged**, and answers the
   * secret that is staged afterwards — so two A-20 tabs asking at once both show the one secret that
   * will be checked, rather than the second overwriting what the first scanned. Null when the
   * invitation stopped being pending.
   */
  stageTotpSecret(input: {
    readonly invitationId: string;
    readonly secret: string;
    readonly at: Date;
  }): Promise<string | null>;

  /**
   * **Claims the invitation and creates its account, together** — the conditional claim decides a
   * race between two acceptances exactly once, and the account is written only by the one that won.
   * Answers the new account's id, or null when the invitation was no longer pending. Throws
   * `AdminAccountExistsError` when an account that is not removed already holds the address, which
   * the provisioning CLI can produce between issue and acceptance.
   */
  accept(input: {
    readonly invitationId: string;
    readonly email: string;
    readonly role: AdminRole;
    readonly passwordHash: string;
    readonly totpSecret: string;
    readonly at: Date;
  }): Promise<string | null>;
}

export interface AdminInvitationBearerStore {
  run<T>(work: (tx: AdminInvitationBearerTransaction) => Promise<T>): Promise<T>;
}

export const ADMIN_INVITATION_BEARER_STORE = Symbol('ADMIN_INVITATION_BEARER_STORE');
