import type { ApiOutcome } from '@/lib/api-outcome';

/**
 * What an answer to a support-access request, or its end, returns to the banner (task 67.9).
 *
 * `null` on success, for `AccessActionResult`'s reason: nothing on the wire is read back — the action revalidates
 * the `(app)` layout, and the banner is re-rendered from the server as whatever is now true. A failure travels as
 * received, so the problem document's own three-part text is what the banner shows (NFR-79).
 */
export type SupportAccessActionResult = ApiOutcome<null>;
