/**
 * Which wording S-02's set-password step takes (task 155; §12.5.6's task-155 row (8)).
 *
 * **The link says, and the link only chooses words.** The worker adds `intent=setup` to the link it
 * sends an account holding no password; anything else — no parameter, an unknown value, a link sent
 * before task 155 — reads as a reset, which is what every earlier link was. Consuming the token does the
 * same whichever wording the page wore, so a link edited to carry or drop the parameter changes the
 * sentences and nothing else.
 */
export const SET_PASSWORD_INTENT = { SETUP: 'setup' } as const;

export const SET_PASSWORD_KIND = {
  RESET: 'reset',
  FIRST: 'first',
} as const;

export type SetPasswordKind = (typeof SET_PASSWORD_KIND)[keyof typeof SET_PASSWORD_KIND];

export const setPasswordKindOf = (intent: string | undefined): SetPasswordKind =>
  intent === SET_PASSWORD_INTENT.SETUP ? SET_PASSWORD_KIND.FIRST : SET_PASSWORD_KIND.RESET;
