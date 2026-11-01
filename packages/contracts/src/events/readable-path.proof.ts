import type { ReadablePath } from './catalogue';

/**
 * The compile-time half of the authority rule (task 146; §12.5.6's task-146 row (2)): `ReadablePath` admits a path that
 * answers a GET and refuses one that only writes. **Both lines are the proof** — if the type widened to every path, the
 * `@ts-expect-error` below would have nothing to expect and `typecheck` would fail on it; if it narrowed to nothing,
 * the first line would. Imported by nothing: it exists to be type-checked.
 */
export const READABLE: ReadablePath = '/api/v1/notifications/unread-count';

// @ts-expect-error — a publication preview is a POST alone, so nothing could refetch it.
export const WRITE_ONLY: ReadablePath = '/api/v1/admin/notification-categories/{category}/preview';
