import type { Locale } from '@easyesg/i18n';

/**
 * A notice's link made absolute (tasks 49.3, 50.1.4) — one rule for every delivery path, so a raised notice's link
 * and one a handler named cannot come to differ in how they are spelled.
 *
 * **The origin is configuration, never a request's `Host`**: there is no request on the worker, and a link built
 * from `Host` is a redirect-poisoning path. **The language is prefixed always where the application routes by it**,
 * the source locale included — `apps/web` redirects the superfluous prefix, and teaching this module which locale
 * takes none would put a front-end routing rule here; the console routes by none, so its caller passes `null`.
 */
export const noticeLink = (input: {
  readonly origin: string;
  readonly path: string;
  readonly locale: Locale | null;
}): string => new URL(input.locale === null ? input.path : `/${input.locale}${input.path}`, input.origin).toString();
