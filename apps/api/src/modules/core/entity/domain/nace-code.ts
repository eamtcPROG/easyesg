/**
 * What a NACE code's own characters say (FR-17, task 30.4.1): its digits, which a code is matched on, and whether it is
 * a **class**, the code B1 exports.
 *
 * **Apart from the match** (task 208), because the empty query reads `isClass` and none of the ranking: the picker's
 * first focus offers classes in code order, and nothing is typed to rank against.
 */

/** Codes are matched on their digits alone, so `10.71`, `1071` and `10 71` are one query. */
export const bareCode = (value: string): string => value.replace(/[^0-9a-z]/giu, '').toLowerCase();

/**
 * A **class**, the four-character code B1 exports (`10.71`) — as against a section (`C`), a division
 * (`10`) or a group (`10.7`), which the classifier carries for its hierarchy and which the picker's
 * suggestions leave out.
 */
export const isClass = (code: string): boolean => /^\d{4}$/u.test(bareCode(code));
