/**
 * FR-9's name parts — when a given or family name counts as given (task 185; §12.5.6's task-182 identity and
 * organization row, 182/6).
 *
 * **Here rather than in `apps/api` for the package's stated reason**: the rule runs in two places and must not drift.
 * Registration, setup and S-27 refuse a part with no visible character in the api, and S-01, S-36 and S-27 say so
 * inline before the request leaves. Until task 185 the api held this function and the browser held its own
 * `value.trim().length > 0` — two copies of one rule, which is how registration came to accept a name of spaces that
 * setup refused.
 *
 * **A name-shaped hole is not a name.** The display name, the monogram and the member list's sort fall back on an
 * absent part (UX-137), and a part of spaces defeats that fallback: it is present to the schema's
 * `char_length(…) >= 1` and blank on every surface that shows it.
 *
 * "No visible character" is `String.prototype.trim`'s reading — ECMAScript's white space and line terminators, the
 * no-break space among them. Characters that are invisible without being white space (a zero-width space) are not
 * judged here; 182/6 decided the rule as setup and S-27 already applied it, and this keeps their reading.
 */

/** A part as it counts: trimmed, and `null` when nothing visible remains — which is what is stored. */
export const presentNamePart = (part: string | null | undefined): string | null => {
  const trimmed = part?.trim();
  return trimmed ? trimmed : null;
};

/** Whether a part counts as given — the inline form of the same verdict, for a field's rule. */
export const namePartIsPresent = (part: string | null | undefined): boolean => presentNamePart(part) !== null;
