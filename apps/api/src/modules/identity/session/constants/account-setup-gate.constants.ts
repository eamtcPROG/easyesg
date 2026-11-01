/**
 * The `@AdmitsAccountInSetup` marker (task 155).
 *
 * In its own file for `membership.constants.ts`'s reason: the decorator sets it and `AuthGuard`
 * reads it, and a constant both of them read belongs to neither. Namespaced, because Nest metadata
 * keys share one registry with every library in the process.
 */
export const ADMITS_ACCOUNT_IN_SETUP = 'easyesg:admits-account-in-setup';
