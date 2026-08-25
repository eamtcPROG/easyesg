import type { Locale } from '@easyesg/i18n';

/**
 * The invitation email as it travels: an outbox `event_type`, which the dispatcher turns into a
 * BullMQ job name, which the consumer selects on (AD-10's single queue, §6.7).
 *
 * Namespaced `<context>.<subject>.<past-tense-fact>`, like the verification and reset events beside
 * it. **One event serves both UC-60 and UC-61**, and that is not laziness: an issue and a resend
 * produce the same email to the same person with a different link, so a second event type would be
 * a second template, a second handler and a second thing to keep in step for no difference the
 * recipient can see.
 */
export const INVITATION_ISSUED = 'identity.invitation.issued';

/**
 * Catalogue key for the message itself. Template wording is a committed catalogue, not
 * configuration (OQ-43): a genuinely new notice cannot exist until code calls for it, so the
 * wording may as well ship with the release that introduces the call.
 */
export const INVITATION_TEMPLATE = 'identity.invitation';

/**
 * **This payload carries the raw token** (OQ-54, closed 20 Aug 2026), on the same terms as the
 * verification and reset events: `identity.invitation` holds only its SHA-256, so this is the one
 * durable place the usable value exists, and the exposure is bounded by grant — `esg_app` may
 * INSERT into `audit.outbox_event` and not SELECT from it, so the tier that mints a token cannot
 * read one back.
 *
 * OQ-54 named this event while deciding: an invitation is "a revocable record that must exist when
 * the request commits, so it cannot be minted by a consumer". This is that record's payload, and it
 * is the reason the other two kinds carry theirs the same way.
 *
 * `organizationName` travels rather than an id, because the message says who is inviting you and a
 * worker resolving it would need a cross-tenant read of `core.organization` that no grant gives it
 * (§7.6). The value is captured in the transaction that issues the invitation, so it is the name as
 * it stood when the administrator sent it.
 */
export interface InvitationIssued {
  readonly invitationId: string;
  readonly organizationName: string;
  readonly email: string;
  /**
   * FR-169: per recipient. Resolved at issue from the invited address's account where one exists
   * and from the inviting administrator's negotiated locale otherwise (§12.5.6, task 26.1) — a
   * worker has no `Accept-Language` to negotiate and no fallback of its own.
   */
  readonly locale: Locale;
  readonly token: string;
}
