import { SET_PASSWORD_KIND, type SetPasswordKind } from '../tools/set-password-kind';

/**
 * S-02's two set-password namespaces and the one choice between them (task 155; §12.5.6's task-155 row
 * (8)), declared once beside the components that read them: `set-password-section.tsx` for the heading
 * and `set-password-form.tsx` for the form's sentences. Here rather than in `tools/`, because a
 * catalogue key is a presentation concern the components own — `invitation-messages.ts`'s placement —
 * while the kind itself, which the link decides, stays pure in `tools/set-password-kind.ts`.
 *
 * `SET_PASSWORD_MESSAGES` also carries what is true for either account — the refusals, the
 * consequence's title, the missing-link state — so a reader takes it directly for those, and this
 * choice only for the sentences that say *new* or *changed*.
 */
export const SET_PASSWORD_MESSAGES = 'identity.setPassword';

export const FIRST_PASSWORD_MESSAGES = 'identity.firstPassword';

export const setPasswordWordingFor = (kind: SetPasswordKind) =>
  kind === SET_PASSWORD_KIND.FIRST ? FIRST_PASSWORD_MESSAGES : SET_PASSWORD_MESSAGES;
