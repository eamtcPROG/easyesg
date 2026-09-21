/**
 * What S-28 is *about*, separate from how it is fetched (task 27.7).
 *
 * The split `server/data/organization-access.ts` makes, and here it is load-bearing rather than
 * tidy: `server/data/credentials.ts` carries `import 'server-only'`, and `SECTION_READ` is a
 * **value**, not a type — so a Client Component importing it from there drags the api client, the
 * session codec and `env` into the browser bundle. The build says so, in a stack four modules deep
 * that names none of them as the cause.
 *
 * A vocabulary is not a server concern. It lives here, both tiers import it, and the fetching seam
 * imports it too.
 */
export const SECTION_READ = {
  READY: 'ready',
  /** No answer, or one this tier could not read. Same fact and remedy as the API being down. */
  UNREACHABLE: 'unreachable',
} as const;

export type SectionReadStatus = (typeof SECTION_READ)[keyof typeof SECTION_READ];

/**
 * **Re-exported from the wire contract, not restated** (corrected 27 Aug 2026).
 *
 * Both of these were hand-written interfaces here, and the copy of `LinkedProvider` had `provider:
 * string` where the contract publishes a two-member enum. A widened copy is the drift
 * `packages/contracts` exists to prevent — iftamaster's duplicated DTOs are the cautionary tale the
 * root `CLAUDE.md` cites — and this one had a visible cost: it let an unrecognised provider
 * identifier through to `providerLabel`, and from there into a sentence somebody reads.
 *
 * Re-exported rather than imported at each site so the screen keeps one module to ask what a
 * credential *is*, which is what this file is for.
 */
import type { LinkedProvider, TotpState } from '@easyesg/contracts';

export type { LinkedProvider, TotpState };

/**
 * One section's read, resolved or not.
 *
 * Per section rather than per screen, because §8.1's **partial** state asks for exactly this: show
 * what resolved, name what did not, and offer retry for that part only. A settings screen that
 * blanked because the provider list was unreachable would hide a working password form behind an
 * unrelated failure.
 */
export type SectionRead<T> =
  | { readonly status: typeof SECTION_READ.READY; readonly value: T }
  | { readonly status: typeof SECTION_READ.UNREACHABLE };

export interface CredentialsRead {
  readonly factor: SectionRead<TotpState>;
  readonly providers: SectionRead<readonly LinkedProvider[]>;
}
