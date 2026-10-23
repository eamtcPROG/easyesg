/**
 * The home's addressable bands — UX-4's shareable address, one level down: `/#questions` lands on the eleven sections.
 *
 * In `shared/` because two readers must spell each one alike: the band that carries the id, and the hero's link to it.
 * A typo between them would not fail anything; the link would simply go nowhere.
 */
export const MARKETING_ANCHOR = {
  HOW_IT_WORKS: 'how-it-works',
  QUESTIONS: 'questions',
  ANSWERING: 'answering',
  BEFORE_SIGNING_UP: 'before-signing-up',
  YOUR_DATA: 'your-data',
} as const;

export type MarketingAnchor = (typeof MARKETING_ANCHOR)[keyof typeof MARKETING_ANCHOR];
