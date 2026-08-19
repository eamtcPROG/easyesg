/**
 * Barrel for the administrative realm — session, API client and route guards.
 *
 * `admin-realm-is-a-leaf` forbids anything here importing `features/**`. The realm is what every
 * feature depends on, so a reference in the other direction makes it a transitive dependency of
 * both bounded contexts at once — the same reasoning that makes `contracts-is-a-leaf` a rule in
 * apps/api.
 *
 * A-01 (admin sign-in, Phase 2) is the one screen owned from here rather than from `features/`,
 * because it serves both PA and BO and belongs to neither context.
 */
export {};
