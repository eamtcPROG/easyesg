import type { ApiOutcome } from '@/lib/api-outcome';

/**
 * What a mark or a dismissal on S-26 returns to its control (task 50.2.1).
 *
 * `null` on success, support access's reason: nothing on the wire is read back — the action revalidates S-26, so the
 * centre is re-rendered from the server as whatever is now true. A failure travels as received, so the problem
 * document's own three-part text is what the control shows (NFR-79).
 */
export type CentreActionResult = ApiOutcome<null>;
