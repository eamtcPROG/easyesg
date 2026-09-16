import type { InvitationPreview } from '@easyesg/contracts';
import type { API_OUTCOME, ApiFailure, ApiOutcome } from '@/lib/api-outcome';
import type { InvitationRemedy } from '../tools/invitation';

/**
 * S-03's two calls (UC-15, task 26.3).
 *
 * The preview's failures are transport ones only — an unusable link is a **successful** answer
 * carrying a `standing`, not a problem document, because S-03 renders four different sentences from
 * it and a screen cannot branch on wording. Acceptance is the opposite: its refusals are problems,
 * since by then the caller has asked for a state change and been told no.
 */
export type InvitationPreviewResult = ApiOutcome<InvitationPreview>;

type RefusedAcceptance = Extract<ApiFailure, { status: typeof API_OUTCOME.Problem }>;

/**
 * Success redirects to the joined organization's home, so only failures cross the RSC wire.
 *
 * **A refusal carries its remedy** (task 114): the callout's way out depends on whether the reader
 * still holds a session, which only the server can tell, and on where that session now belongs —
 * resolved after the attempt rather than before it. An unreachable api carries none: its callout
 * offers no link.
 */
export type AcceptInvitationFailure =
  | (RefusedAcceptance & { readonly remedy: InvitationRemedy })
  | Exclude<ApiFailure, RefusedAcceptance>
  | undefined;
