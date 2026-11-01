/**
 * The support request's fixed values (task 77; FR-212; `architecture.md` §12.5.6's task-77 row (1) … (6)).
 */

/**
 * Where the support address lives in the configuration store — seeded from `config/seed/support-channel.global.json`,
 * the loader folding the dash into an underscore. **One scope, `global`**: the platform has one support mailbox.
 */
export const SUPPORT_CHANNEL_CONFIG_KIND = 'support_channel';

export const SUPPORT_CHANNEL_CONFIG_SCOPE = 'global';

/**
 * The outbox event a recorded request writes, on its own transaction (P-8), which the worker's handler turns into the
 * mail to support — its job name, keyed by the request's id so a redelivery mails nothing twice.
 */
export const SUPPORT_REQUEST_RECEIVED = 'support.request_received';

/** The nightly purge's job name — its outbox row's `event_type`, and the `@HandlesJob` that claims it. */
export const SUPPORT_REQUEST_PURGE = 'support.request_purge';

/**
 * 03:30 in Chișinău: half an hour after the cookie purge (task 223), so the two night jobs never open in the same
 * minute. Nobody waits on it — a request a night past its 24 months harms nothing.
 */
export const SUPPORT_REQUEST_PURGE_SLOT = { at: '03:30', timezone: 'Europe/Chisinau' } as const;

/** How long a request is kept, in calendar months (§12.5.7; row (4)). */
export const SUPPORT_REQUEST_KEPT_MONTHS = 24;

/** The cost bounds the DTO and the table's `CHECK`s share — a name, and the question a person writes (row (3)). */
export const SUPPORT_NAME_MAX_LENGTH = 200;

export const SUPPORT_QUESTION_MAX_LENGTH = 5000;
