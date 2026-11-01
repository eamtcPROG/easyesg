/**
 * Same-app paths only — a crafted link must not turn a console address into an open redirect: a leading `/`, but not
 * `//` and not `/\`, the two forms a browser reads as an origin, and **no tab, newline or carriage return anywhere**,
 * since the URL parser deletes those before it reads, so `/<tab>/evil.test` arrives as `//evil.test` (found at Stage 2's
 * close). Validated where it is consumed, not where it is set.
 *
 * **Inline in `_focus/sign-in.tsx` until task 203.5**, whose docblock kept it there because both its consumers were
 * in that file. A-19's `?from=` — the page the account menu was opened from, which its back control returns to — is a
 * third, in another file, so the rule moved here with a spec rather than being restated.
 */
const STRIPPED_BY_THE_URL_PARSER = /[\t\n\r]/u;

export const safeRealmPath = (candidate: string | undefined): string | null =>
  candidate?.startsWith('/') &&
  !candidate.startsWith('//') &&
  !candidate.startsWith('/\\') &&
  !STRIPPED_BY_THE_URL_PARSER.test(candidate)
    ? candidate
    : null;
