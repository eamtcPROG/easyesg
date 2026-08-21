/**
 * The password policy (OQ-51, closed 20 Aug 2026) — implemented in `@easyesg/validation` since
 * task 20, re-exported here so the domain keeps one import path and no call site moved.
 *
 * The move is recorded in architecture.md §9.8: S-02 requires the policy enforced at the point of
 * entry in `apps/web`, which may not import `apps/api/src` (DR-11), and a client-side re-statement
 * would be the second source of truth §9.8 exists to prevent. One implementation, two execution
 * sites; this tier remains the authoritative one. The behaviour tests moved with the code.
 *
 * `domain-free-of-frameworks` is untouched by this import: the package is framework-free by
 * charter — it is consumed by the browser bundle too, so it can never grow a Nest or TypeORM
 * dependency without breaking its other consumer first.
 */
export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  evaluatePasswordPolicy,
  passwordMeetsPolicy,
  type PasswordPolicyVerdict,
} from '@easyesg/validation';
