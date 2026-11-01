/**
 * The administrator invitation email as it travels (task 67.4): an outbox `event_type`, which the
 * dispatcher turns into a job name, which `AdminInvitationEmailHandler` claims (AD-10's single
 * queue). `identity.invitation.issued`'s shape over the admin realm — one event for an issue and a
 * resend, because the invitee sees one kind of message with a different link in it.
 */
export const ADMIN_INVITATION_ISSUED = 'platform.admin_invitation.issued';

/**
 * **This payload carries the raw token** (OQ-54), on the tenant invitation's terms:
 * `identity.admin_invitation` holds only its SHA-256, and `esg_app` may insert into
 * `audit.outbox_event` but not read from it, so the tier that mints a token cannot read one back.
 *
 * No locale travels: the console is Romanian-only (OQ-42) and an operator account holds no language,
 * so the handler sends the source locale. No realm travels either — naming it would put the role's
 * wire value into a sentence, and the invitee reads which realm on A-20 before typing anything.
 */
export interface AdminInvitationIssued {
  readonly invitationId: string;
  readonly email: string;
  readonly token: string;
}
