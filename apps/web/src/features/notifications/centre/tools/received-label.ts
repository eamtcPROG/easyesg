/**
 * When a notice reached the reader, in words (task 50.2.1) — the commerce artboard's *"Today 09:02"* for a notice
 * from today, and the date with its time otherwise.
 *
 * **Decided on the server, and passed down as text.** "Today" depends on the clock, and nothing user-visible here
 * is derived from the clock in a Client Component (`apps/web/CLAUDE.md`): evaluated in the browser it would be
 * computed twice, and a reader in another timezone near midnight would hydrate a different word than the server
 * rendered. The formatter carries the request's timezone, so *today* is the reader's configured day, not the host's.
 *
 * The formatter and the phrase are injected, so the rule is a spec rather than a render.
 */
export interface NoticeDateFormatter {
  dateTime(value: Date, format: 'short' | 'clock' | 'stamp'): string;
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
