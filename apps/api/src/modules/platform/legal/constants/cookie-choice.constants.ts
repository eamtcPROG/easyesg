/**
 * The cookie banner's answers kept no longer than they prove anything (task 223; §12.5.6's task-223 row (4)): the job
 * that deletes them and when it runs.
 */

/** The daily purge's job name — its outbox row's `event_type`, and the `@HandlesJob` that claims it. */
export const COOKIE_CHOICE_PURGE = 'legal.cookie_choice_purge';

/**
 * 03:00 in Chișinău: the night's quietest hour, and clear of the notices' 07:00 sweep (task 51.2), so the two jobs never
 * open in the same minute. Nobody waits on it — a row a day past its twelve months harms nothing.
 */
export const COOKIE_CHOICE_PURGE_SLOT = { at: '03:00', timezone: 'Europe/Chisinau' } as const;
