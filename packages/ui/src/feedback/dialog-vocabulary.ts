/**
 * `Dialog`'s closed vocabulary — its measure. In a module with no directive, for the reason
 * `primitives/button-vocabulary.ts` records: a value exported from a `'use client'` module is a client
 * reference on the server, and a Server Component reading `DIALOG_SIZE.WIDE` would get `undefined`.
 *
 * **Two measures, named for what they hold rather than for a width.** `default` holds a record's
 * facts and one form; `wide` holds a record whose content is itself tabular — A-17's wording in
 * three languages beside its behaviour — which the default measure would wrap into a column of
 * fragments. **`sheet`** (task 42.2) holds a panel raised from the foot of a screen it does not leave —
 * S-08 below `wide`, as *S-07/S-08 narrow* draws it: the frame's full width, anchored to its foot, the
 * screen still in view above it.
 */
export const DIALOG_SIZE = {
  DEFAULT: 'default',
  WIDE: 'wide',
  SHEET: 'sheet',
} as const;

export type DialogSize = (typeof DIALOG_SIZE)[keyof typeof DIALOG_SIZE];
