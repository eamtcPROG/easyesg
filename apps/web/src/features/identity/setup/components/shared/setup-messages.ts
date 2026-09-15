/**
 * S-36's namespace, declared once (task 155). Its readers, named rather than counted:
 * `section/complete-account-section.tsx`, `section/grant-password-section.tsx`,
 * `steps/password-form.tsx`, `steps/session-password-step.tsx`, `steps/grant-password-step.tsx`,
 * `steps/profile-step.tsx`, `states/setup-complete.tsx`, `states/setup-unavailable.tsx`, and the route's
 * `complete-account/loading.tsx`.
 *
 * In `components/shared/` on that folder's admission test — read by more than one sibling here; not in
 * `tools/`, because a catalogue key is a presentation concern the components own
 * (`invitation-messages.ts`'s placement, for its reason).
 */

export const SETUP_MESSAGES = 'identity.setup';
