import type { ApiOutcome } from '@/lib/api-outcome';

/**
 * What a mark or a dismissal returns to its control (task 50.2.1), on S-26 or in the panel.
 *
 * `null` on success, support access's reason: nothing on the wire is read back — the action revalidates S-26, so the
 * centre is re-rendered from the server as whatever is now true. A failure travels as received, so the problem
 * document's own three-part text is what the control shows (NFR-79).
 *
 * **In `shared/` on one test: is it read by more than one surface?** The actions beside it return it, and the one
 * action hook S-26's controls and the panel's *mark all* both run reads it.
 */
export type NoticeActionResult = ApiOutcome<null>;
