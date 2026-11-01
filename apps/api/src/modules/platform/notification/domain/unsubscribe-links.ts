import type { Locale } from '@easyesg/i18n';
import type { EmailUnsubscribe } from '@api/contracts/email.port';
import { noticeLink } from './notice-link';

/**
 * The two addresses an optional category's email carries for FR-169's one-click unsubscribe (task 52.2.2; §12.5.6's
 * task-52.2 row (2)), both on the tenant origin — the api has none of its own until task 71.
 *
 * - **`link`** opens S-38 in the recipient's language: a page naming the category, with one button. A page, never a
 *   switch on `GET`, because the scanners that prefetch a message's links would otherwise unsubscribe a person who
 *   never clicked. Spelled by `noticeLink`, the rule every notice's link follows.
 * - **`oneClickUrl`** is RFC 8058's `List-Unsubscribe` target, which a mail client `POST`s to without opening
 *   anything. Under `/mail`, outside the locale routing: the source locale is served unprefixed, so S-38's own path
 *   and a handler at the same address would be one route.
 */
export const unsubscribeLinks = (input: {
  readonly origin: string;
  readonly token: string;
  readonly locale: Locale;
}): EmailUnsubscribe => ({
  link: noticeLink({ origin: input.origin, path: `/unsubscribe/${input.token}`, locale: input.locale }),
  oneClickUrl: new URL(`/mail/unsubscribe/${input.token}`, input.origin).toString(),
});
