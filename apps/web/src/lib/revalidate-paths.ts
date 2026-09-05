/**
 * The route patterns Server Actions hand to `revalidatePath`, declared once.
 *
 * **Separate from `routes.ts`, and they are not the same vocabulary.** That file holds the addresses
 * this app *navigates* to — locale-free, handed to `@/i18n/navigation`'s `Link`. These are Next's
 * own internal route patterns: they carry the `[locale]` segment and the route **groups**
 * (`(app)`, `(workspace)`) that never appear in a URL at all. Putting them in `routes.ts` would
 * invite one to be passed to a `Link`, which would 404.
 *
 * **They live here rather than in the actions that use them because a `'use server'` module may
 * export only async functions.** Task 32.3 moved `PERIODS_PATH` from `features/periods/actions.ts`
 * so `features/reports/actions.ts` could revalidate the same family — and exporting a `const` from
 * a file carrying that directive fails the **build** with *"Only async functions are allowed to be
 * exported in a 'use server' file"*, while `typecheck`, `lint` and 286 unit tests all pass. That is
 * the constraint this module exists to keep out of the actions, and it is why a shared constant
 * cannot simply be exported from wherever it was first written.
 *
 * A copy per action was the alternative and is what the sharing replaced: two literals sit below
 * `sonarjs/no-duplicate-string`'s threshold of three, so nothing mechanical would see a route move
 * leave one of them behind.
 */

/** S-06's index. Creating a report changes what it shows. */
export const REPORTS_PATH = '/[locale]/(app)/(workspace)/reports';

/** S-14's list and record — one family, so one call covers both. Creating a report changes whether
 *  a period is still free, which the periods screens show. */
export const PERIODS_PATH = '/[locale]/(app)/(workspace)/entities/[entityId]/periods';
