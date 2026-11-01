import type { ApiOutcome } from '@/lib/api-outcome';

/**
 * What every S-16 write returns to the screen.
 *
 * One shape for all five, and `null` rather than the wire DTO, because none of them has anything
 * the screen reads on success: the table is re-rendered from the server by the action's own
 * `revalidatePath`, so a returned `Member` or `Invitation` would be a second, staler copy of what
 * the next render is already fetching — and reconciling the two is exactly the optimistic-update
 * bookkeeping this avoids.
 *
 * Failures travel untouched, as `ApiOutcome` failures always do: the problem document's own
 * three-part text is what the screen renders (NFR-79), whether it says an address already has
 * access, that an invitation is outstanding, or that this is the last administrator.
 */
export type AccessActionResult = ApiOutcome<null>;
