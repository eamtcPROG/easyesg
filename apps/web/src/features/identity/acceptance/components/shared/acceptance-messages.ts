/**
 * S-43's namespace, declared once (task 195). Its readers, named rather than counted:
 * `section/accept-terms-section.tsx`, `documents/owed-documents.tsx`, `form/accept-terms-form.tsx`,
 * `states/acceptance-settled.tsx`, `states/acceptance-unavailable.tsx`, and the route's `accept-terms/loading.tsx`.
 *
 * In `components/shared/` on that folder's admission test — read by more than one sibling here; not in `tools/`,
 * because a catalogue key is a presentation concern the components own (`setup-messages.ts`'s placement, for its
 * reason). The checkbox's words are not here: `identity.legalAcceptance` is S-01's and S-43's both, and its one reader
 * is `identity/shared/components/legal-acceptance-checkbox.tsx`.
 */

export const ACCEPTANCE_MESSAGES = 'identity.acceptance';
