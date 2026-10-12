/**
 * S-12's namespace (task 84.2), declared once.
 *
 * **In `components/shared/` on one test: is it read by more than one sibling?** `panel/` (the title, the close and the
 * note), `entries/` (each entry and state) and `trigger/` (the way in) all read it, so it sits where all three can.
 */
export const HISTORY_MESSAGES = 'history';
