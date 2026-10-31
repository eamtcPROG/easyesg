import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import type { TopicCard as TopicCardData } from '../../tools/help-library';
import pageStyles from '../../../shared/help-page.module.css';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import styles from './library.module.css';
import { TopicCard } from './topic-card';

/** Which of the two artboards the cards are drawn for — the visitor's names no articles on a card (artboard 02). */
export const CARDS_FOR = { MEMBER: 'member', VISITOR: 'visitor' } as const;
type CardsFor = (typeof CARDS_FOR)[keyof typeof CARDS_FOR];

/**
 * S-32's library as topic cards (task 227; artboards 01 and 02) — *Browse by what you are doing* for a signed-in reader
 * and *The whole library* for a visitor, three to a row at the widest frame, with how many articles the library holds.
 */
export async function TopicCards({
  cards,
  total,
  page,
  query,
  drawnFor,
}: {
  readonly cards: readonly TopicCardData[];
  readonly total: number;
  readonly page: Locale;
  readonly query: Readonly<Record<string, string>>;
  readonly drawnFor: CardsFor;
}) {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);
  const member = drawnFor === CARDS_FOR.MEMBER;

  return (
    <section aria-labelledby="help-topics" className={pageStyles.region}>
      <div className={pageStyles.regionHead}>
        <h2 id="help-topics" className={pageStyles.regionTitle}>
          {member ? t('browse.title') : t('guest.library.title')}
        </h2>
        <p className={`t-caption ${pageStyles.muted}`}>
          {member ? t('browse.total', { count: total }) : t('guest.library.aside', { count: total })}
        </p>
      </div>
      <ul className={styles.cards}>
        {cards.map((card) => (
          <li key={card.group.topic?.key ?? 'other'}>
            <TopicCard card={card} featured={member ? card.featured : []} page={page} query={query} />
          </li>
        ))}
      </ul>
    </section>
  );
}
