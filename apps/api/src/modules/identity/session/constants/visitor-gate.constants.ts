/**
 * The `@AdmitsVisitor` marker (task 223).
 *
 * In its own file for `account-setup-gate.constants.ts`'s reason: the decorator sets it and `AuthGuard` reads it, and a
 * constant both of them read belongs to neither. Namespaced, because Nest metadata keys share one registry with every
 * library in the process.
 */
export const ADMITS_VISITOR = 'easyesg:admits-visitor';
