import { isLocale, type Locale } from '@easyesg/i18n';

/**
 * The help's own language (task 227; `architecture.md` §12.5.6's task-227 row (2)) — S-32 and S-33 read their content
 * in the language the address names under `content`, apart from the interface's, which the path's locale keeps. **In
 * the address** (UX-4), so a link to an article carries it and a reload keeps it. **Read by S-32 and S-33**, so in the
 * help's `shared/` on the admission test.
 */
export const HELP_LANGUAGE_PARAM = 'content';

/** The help's language an address names, or the page's where it names none, or one the platform does not publish in. */
export const helpLanguageOf = (input: { readonly requested: string | undefined; readonly page: Locale }): Locale =>
  input.requested !== undefined && isLocale(input.requested) ? input.requested : input.page;

/**
 * What a help link carries so the next page reads in the same language — nothing where it is the page's own, so an
 * address with no choice in it stays the address it was.
 */
export const helpLanguageQuery = (input: {
  readonly content: Locale;
  readonly page: Locale;
}): Partial<Record<typeof HELP_LANGUAGE_PARAM, Locale>> =>
  input.content === input.page ? {} : { [HELP_LANGUAGE_PARAM]: input.content };

/**
 * The `lang` a part of the help carries: its own language where it differs from the page's, and nothing where it is the
 * page's (UX-97; WCAG 2.2 3.1.2). Chosen in another language, or fallen back to Romanian, it is read as written.
 */
export const languageOf = (input: { readonly written: string; readonly page: Locale }): string | undefined =>
  input.written === input.page ? undefined : input.written;
