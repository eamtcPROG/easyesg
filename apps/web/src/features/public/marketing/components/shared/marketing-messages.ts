/**
 * S-29's message namespace, declared once for every band that reads it (`shared-namespace-declared-once`).
 *
 * In `shared/` because every band of the home reads it and none owns it; each band narrows it to its own key
 * (`${MARKETING_MESSAGES}.hero`) so a part cannot reach a sibling band's copy by accident.
 */
export const MARKETING_MESSAGES = 'marketing' as const;
