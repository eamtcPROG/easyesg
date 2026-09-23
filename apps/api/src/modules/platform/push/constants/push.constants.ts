/**
 * AD-15's hints between processes (task 148; §12.5.6's task-148 row).
 *
 * `push.hint` is the outbox event a request-tier producer writes; the worker's handler for it publishes on
 * `PUSH_CHANNEL`, which every api replica holding a socket subscribes to. **The channel carries the internal hint** —
 * which may name accounts — and never reaches a browser: a replica turns it into the three-field frame.
 */
export const PUSH_HINT_EVENT = 'push.hint';

export const PUSH_CHANNEL = 'push:hints';
