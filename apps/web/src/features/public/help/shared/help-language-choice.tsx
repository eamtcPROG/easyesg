import { LOCALES, type Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { HELP_LANGUAGE_PARAM } from './help-language';
import styles from './help-language-choice.module.css';

const HELP_LANGUAGE_MESSAGES = 'help.language';

/**
 * The help's language, chosen apart from the interface's (task 227; `architecture.md` §12.5.6's task-227 row (2)) —
 * artboard 01's *Help content language* and artboard 03's bar: Romanian, English and Russian as three links that keep
 * the reader where they are and change only `content` in the address (UX-4), so the choice works with no script. Each
 * is named in its own language and marked as written in it (WCAG 2.2 3.1.2), and the one in force says so.
 *
 * **Read by S-32 and S-33**, so in the help's `shared/`. It takes the address it links to — the page's own path and
 * the rest of its query — because only the screen knows which they are.
 */
export async function HelpLanguageChoice({
  content,
  pathname,
  query,
}: {
  /** The help's language in force. */
  readonly content: Locale;
  /** The page's own path, without its locale. */
  readonly pathname: string;
  /** What else the address holds, kept as it is. */
  readonly query: Readonly<Record<string, string>>;
}) {
  const t = await getTranslations(HELP_LANGUAGE_MESSAGES);

  return (
    <nav aria-label={t('label')}>
      <ul className={styles.choice}>
        {LOCALES.map((code) => (
          <li key={code}>
            <Link
              className={styles.option}
              href={{ pathname, query: { ...query, [HELP_LANGUAGE_PARAM]: code } }}
              aria-current={code === content ? 'true' : undefined}
              aria-label={t(`names.${code}`)}
              lang={code}
              hrefLang={code}
            >
              {code.toUpperCase()}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
