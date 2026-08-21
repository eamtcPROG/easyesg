/**
 * `features/identity`
 *
 * Sign-in, registration, verification, credentials and linked identities.
 * Mirrors `apps/api/src/modules/identity`. S-01, S-02, S-03, S-27, S-28.
 *
 * Built (task 20): S-01 register and S-02 verify/resend — `actions.ts` (Server Actions, the
 * decided transport for unauthenticated identity calls), `components/` for the two screens'
 * client surfaces, `pending-verification-store.ts` (the S-01 → S-02 address hand-off over
 * sessionStorage, shaped for `useSyncExternalStore`), `constants.ts` (the recorded resend
 * cooldown assumption). Sign-in, reset and set-password wait on their APIs (tasks 21–22).
 *
 * UX-108 (Accessible Authentication) is a design input here, not an audit afterwards: no
 * cognitive function test, and password managers and paste work everywhere — the register
 * form's `PasswordField` and checklist are built to it, and `e2e/web/accessibility.spec.ts`
 * holds the automated half.
 */
export {};
