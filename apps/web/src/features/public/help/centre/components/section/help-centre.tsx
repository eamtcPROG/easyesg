import { API_OUTCOME } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { FOCUS_MEASURE, FocusColumn, PageHeading } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { readHelpArticles, readHelpTopics } from '@/server/data/help-content';
import { libraryOf, topicOf } from '../../tools/help-library';
import { HelpFilter } from '../filter/help-filter';
import { HelpLibrary } from '../library/help-library';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import styles from '../shared/help-centre.module.css';
import { CentreUnavailable } from '../states/centre-unavailable';
import { LibraryEmpty } from '../states/library-empty';
import { LibraryNoMatch } from '../states/library-no-match';
import { HelpSupportPrompt } from '../support/help-support-prompt';

/**
 * S-32 — UC-180 (task 77.2; FR-61; `design_spec.md` S-32, Index archetype). **The section reads; the parts render**:
 * this file makes the two reads — the topics and the library, from task 76's public routes — narrows the library by
 * what the address holds (UX-4), and picks the arm: the groups, the first-use state, *nothing matches*, or the read
 * failed. **The same screen whatever the session** (S-32): it reads none, and the layout above it draws the chrome a
 * signed-in reader or a visitor is owed (§12.5.6's task-77 row (10)).
 */
export async function HelpCentre({
  locale,
  topic,
  query,
}: {
  readonly locale: Locale;
  /** The topic the address narrows to, as given. */
  readonly topic: string | undefined;
  /** What the reader searched for, as given. */
  readonly query: string;
}) {
  const [t, topics, articles] = await Promise.all([
    getTranslations(HELP_CENTRE_MESSAGES),
    readHelpTopics(locale),
    readHelpArticles(locale),
  ]);

  const heading = <PageHeading title={t('title')} summary={t('lede')} />;
  if (topics.status !== API_OUTCOME.Ok || articles.status !== API_OUTCOME.Ok) {
    return (
      <FocusColumn measure={FOCUS_MEASURE.WIDE}>
        {heading}
        <CentreUnavailable />
      </FocusColumn>
    );
  }

  const chosen = topicOf({ requested: topic, topics: topics.value.items });
  const library = libraryOf({ topics: topics.value.items, articles: articles.value.items, topic: chosen, query, locale });

  return (
    <FocusColumn measure={FOCUS_MEASURE.WIDE}>
      {heading}
      <div className={styles.regions}>
        {library.total === 0 ? null : <HelpFilter topics={topics.value.items} topic={chosen} query={query} />}
        {library.total === 0 ? (
          <LibraryEmpty />
        ) : library.matched === 0 ? (
          <LibraryNoMatch />
        ) : (
          <HelpLibrary groups={library.groups} locale={locale} />
        )}
        <HelpSupportPrompt />
      </div>
    </FocusColumn>
  );
}
