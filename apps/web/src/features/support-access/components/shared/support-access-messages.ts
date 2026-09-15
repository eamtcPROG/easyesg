/**
 * Support access's message namespace, declared once (task 158).
 *
 * **In `components/shared/` because more than one sibling reads it**: both banners' sections
 * (`awaiting/section/awaiting-banner.tsx`, `active/section/active-banner.tsx`), both control sets
 * (`awaiting/controls/answer-controls.tsx`, `active/controls/end-control.tsx`) and
 * `use-support-access-action.ts` beside this file. It became a constant when the controls began
 * reading their own words rather than taking them from the banners, which is the split that would
 * otherwise have multiplied the literal.
 */
export const SUPPORT_ACCESS_MESSAGES = 'supportAccess' as const;
