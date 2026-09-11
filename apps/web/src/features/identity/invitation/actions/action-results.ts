import type { InvitationPreview } from '@easyesg/contracts';
import type { ApiFailure, ApiOutcome } from '@/lib/api-outcome';

/**
 * S-03's two calls (UC-15, task 26.3).
 *
 * The preview's failures are transport ones only — an unusable link is a **successful** answer
 * carrying a `standing`, not a problem document, because S-03 renders four different sentences from
 * it and a screen cannot branch on wording. Acceptance is the opposite: its refusals are problems,
 * since by then the caller has asked for a state change and been told no.
 */
export type InvitationPreviewResult = ApiOutcome<InvitationPreview>;

/** Success redirects to the joined organization's home, so only failures cross the RSC wire. */
export type AcceptInvitationFailure = ApiFailure | undefined;
