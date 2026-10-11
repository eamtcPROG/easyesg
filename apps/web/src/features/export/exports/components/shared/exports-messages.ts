/**
 * S-11's own words (task 47.3) — the screen's, in the reader's language; the file's language is the dialogue's choice.
 *
 * **In `components/shared/` on one test: is it read by more than one sibling?** Every region of the screen reads it —
 * `section/`, `bar/`, `notices/`, `dialogue/`, `filing/`, `history/` and `states/` — so it sits where all of them can.
 */
export const EXPORTS_MESSAGES = 'organization.exports' as const;
