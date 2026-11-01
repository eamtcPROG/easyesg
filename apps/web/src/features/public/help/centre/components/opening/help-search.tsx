import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { HELP_LANGUAGE_PARAM } from '../../../shared/help-language';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import styles from './opening.module.css';

/** Where the search stands: on the signed-in reader's white band, or on the visitor's pine one — each opening says. */
export const SEARCH_TONE = { PAGE: 'page', BAND: 'band' } as const;
type SearchTone = (typeof SEARCH_TONE)[keyof typeof SEARCH_TONE];

/**
 * S-32's search (tasks 77, 227; artboards 01 and 02) — one wide field across the main column. **A `GET` form**, so the
 * words are the address (UX-4): it submits `?q=…` to this page, the section reads it on the server, and it works before
 * the page hydrates and with no script at all. A search carries nothing personal, which is why this form, unlike a
 * credential form, may. **It keeps the help's language** where one is chosen (the task-227 row (2)), and searches every
 * topic: a topic is narrowed by its card, not here.
 *
 * Its glyph is drawn in CSS — this app draws no icon of its own, and the magnifier says nothing a screen reader needs.
 */
export async function HelpSearch({
  query,
  total,
  content,
  page,
  tone,
}: {
  /** What the address searched for, `''` for none. */
  readonly query: string;
  /** How many articles the library holds — the field's hint. */
  readonly total: number;
  readonly content: Locale;
  readonly page: Locale;
  readonly tone: SearchTone;
}) {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);

  return (
    <form method="get" role="search" className={`${styles.search} ${styles[tone]}`}>
      <span className={styles.glyph} aria-hidden="true" />
      <input
        className={styles.input}
        type="search"
        name="q"
        defaultValue={query}
        aria-label={t('search.label')}
        placeholder={t('search.placeholder', { count: total })}
      />
      {content === page ? null : <input type="hidden" name={HELP_LANGUAGE_PARAM} value={content} />}
      <button type="submit" className={styles.submit}>
        {t('search.submit')}
      </button>
    </form>
  );
}
