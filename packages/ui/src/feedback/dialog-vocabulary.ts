/**
 * `Dialog`'s closed vocabulary — its measure. In a module with no directive, for the reason
 * `primitives/button-vocabulary.ts` records: a value exported from a `'use client'` module is a client
 * reference on the server, and a Server Component reading `DIALOG_SIZE.WIDE` would get `undefined`.
 *
 * **Two measures, named for what they hold rather than for a width.** `default` holds a record's
 * facts and one form; `wide` holds a record whose content is itself tabular — A-17's wording in
 * three languages beside its behaviour — which the default measure would wrap into a column of
 * fragments.
 */
export const DIALOG_SIZE = {
  DEFAULT: 'default',
  WIDE: 'wide',
} as const;

export type DialogSize = (typeof DIALOG_SIZE)[keyof typeof DIALOG_SIZE];
