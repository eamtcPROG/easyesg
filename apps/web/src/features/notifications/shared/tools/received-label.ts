import type { formats } from '@/i18n/formats';

type DateTimeFormatName = keyof typeof formats.dateTime;

/**
 * When a notice reached the reader, in words (tasks 50.2.1, 50.2.2) — the commerce artboard's *"Today 09:02"* for a
 * notice from today, and the date with its time otherwise.
 *
 * **Where it runs follows where its text is rendered.** S-26's list is server-rendered and hydrated, so it is worded
 * on the server and passed down as text — computed in the browser too, the two could disagree near midnight
 * (`apps/web/CLAUDE.md`'s clock rule). The panel's list is fetched after the bell is pressed and never
 * server-rendered, so it words the same rule in the browser (§12.5.6's task-50.2 row (5)). Either way the formatter
 * carries the configured timezone, so *today* is the configured day, not the device's or the host's.
 *
 * **In `shared/` on one test: is it read by more than one surface?** S-26's list and the panel's.
 *
 * The formatter and the phrase are injected, so the rule is a spec rather than a render. The format names are
 * `i18n/formats.ts`'s own keys, so a renamed format fails here rather than formatting with next-intl's fallback.
 */
export interface NoticeDateFormatter {
  dateTime(value: Date, format: DateTimeFormatName): string;
}

export const receivedLabel = (input: {
  readonly receivedAt: Date;
  readonly now: Date;
  readonly format: NoticeDateFormatter;
  /** The catalogue's "Today, {time}". */
  readonly today: (time: string) => string;
}): string =>
  input.format.dateTime(input.receivedAt, 'short') === input.format.dateTime(input.now, 'short')
    ? input.today(input.format.dateTime(input.receivedAt, 'clock'))
    : input.format.dateTime(input.receivedAt, 'stamp');
