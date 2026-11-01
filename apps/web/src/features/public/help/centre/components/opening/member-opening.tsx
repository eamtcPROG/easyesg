import { SOURCE_LOCALE, type Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { ROUTES } from '@/lib/routes';
import { HelpLanguageChoice } from '../../../shared/help-language-choice';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import { HelpSearch, SEARCH_TONE } from './help-search';
import styles from './opening.module.css';

/**
 * S-32's opening for a signed-in reader (task 227; artboard 01) — a white band beneath the workspace tier: the question
 * asked by name, the lede, the help's language at the right (the task-227 row (2)) with what it changes, and the search
 * across the main column. **The reader's name is handed down by the route**, which reads it beside the session, since
 * nothing under `features/public` reads one (§5.1b as amended).
 */
export async function MemberOpening({
  name,
  query,
  total,
  content,
  page,
  fallbackCount,
}: {
  /** The reader's name, as the account holds it. */
  readonly name: string;
  readonly query: string;
  readonly total: number;
  /** The help's language in force, and the page's. */
  readonly content: Locale;
  readonly page: Locale;
  /** How many articles the chosen language lacks. */
  readonly fallbackCount: number;
}) {
  const [t, tLanguage] = await Promise.all([getTranslations(HELP_CENTRE_MESSAGES), getTranslations('help.language')]);

  return (
    <div className={styles.memberBand}>
      <div className={styles.inner}>
        <div className={styles.memberTop}>
          <div className={styles.memberWords}>
            <h1 className={`t-heading-1 ${styles.title}`}>{t('greeting', { name })}</h1>
            <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
          </div>
          <div className={styles.language}>
            <p className={styles.languageLabel}>{tLanguage('label')}</p>
            <HelpLanguageChoice content={content} pathname={ROUTES.HELP_CENTRE} query={query === '' ? {} : { q: query }} />
            {content === page ? null : <p className={`t-caption ${styles.note}`}>{tLanguage('interfaceNote')}</p>}
            {fallbackCount === 0 || content === SOURCE_LOCALE ? null : (
              <p className={`t-caption ${styles.note}`}>{tLanguage('fallbackNote', { count: fallbackCount })}</p>
            )}
          </div>
        </div>
        <HelpSearch query={query} total={total} content={content} page={page} tone={SEARCH_TONE.PAGE} />
      </div>
    </div>
  );
}
