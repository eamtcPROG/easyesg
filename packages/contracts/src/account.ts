/**
 * Account vocabularies (FR-1, FR-3) — the consumer-side declaration of the value `apps/api`
 * derives from its own `ACCOUNT_STATUS` object.
 *
 * A mirror, for `PROBLEM_TYPE`'s stated reason and on `social.ts`'s terms: the api **produces**
 * this package and must never import it, so the two copies are changed together by hand, and the
 * OpenAPI enum generated from the api's copy is what the diff gate holds both against.
 *
 * The generated types already give the union; this adds the **runtime** values, which is what a
 * screen branching on a status needs. Comparing against a bare literal is the failure CLAUDE.md's
 * closed-vocabulary rule names.
 */

/**
 * Whether the address has been proven. `active` is reachable three ways since 25 Aug 2026 (FR-3):
 * the emailed challenge, a provider asserting the account's own address as verified, and —
 * task 26.2 — registering while holding a live invitation issued to that same address.
 *
 * The third is why `apps/web` reads this at all: S-03's registration hand-off has to know whether
 * the invitee still needs the challenge screen or can go straight on to sign in.
 */
export const ACCOUNT_STATUS = {
  UNVERIFIED: 'unverified',
  ACTIVE: 'active',
} as const;

export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];
