/**
 * The three lifecycle changes A-08 offers an account (task 67.4; FR-80) — suspend, reactivate, remove.
 *
 * **A model, not the lifecycle module's own export**, because more than the domain names it: the
 * controller picks one per route and an error names the one it refused, and a controller may not reach
 * into `domain/` (`controllers-not-to-use-cases`). What each change applies from and lands on stays in
 * `domain/admin-account-lifecycle.ts`, beside the rules.
 */
export const ADMIN_ACCOUNT_CHANGE = {
  SUSPEND: 'suspend',
  REACTIVATE: 'reactivate',
  REMOVE: 'remove',
} as const;

export type AdminAccountChange = (typeof ADMIN_ACCOUNT_CHANGE)[keyof typeof ADMIN_ACCOUNT_CHANGE];
