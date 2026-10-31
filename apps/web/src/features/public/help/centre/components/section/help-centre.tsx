import { API_OUTCOME } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { MAIN_CONTENT_ID } from '@easyesg/ui';
import type { ReactNode } from 'react';
import { readHelpArticles, readHelpTopics } from '@/server/data/help-content';
import { readSupportChannel } from '@/server/data/support-channel';
import { HelpAccountCard } from '../../../shared/help-account-card';
import { helpLanguageOf, helpLanguageQuery } from '../../../shared/help-language';
import pageStyles from '../../../shared/help-page.module.css';
import {
  askedBeforeSigningUpOf,
  fallbackCountOf,
  libraryOf,
  topicCardsOf,
  topicOf,
} from '../../tools/help-library';
import { AskedBeforeSigningUp } from '../asked/asked-before-signing-up';
import { CARDS_FOR, TopicCards } from '../library/topic-cards';
import { LibraryResults } from '../library/library-results';
import { MemberOpening } from '../opening/member-opening';
import { VisitorOpening } from '../opening/visitor-opening';
import { AskAPerson } from '../rail/ask-a-person';
import { AskDirectly } from '../rail/ask-directly';
import { CentreUnavailable } from '../states/centre-unavailable';
import { LibraryEmpty } from '../states/library-empty';
import { LibraryNoMatch } from '../states/library-no-match';

/**
 * S-32 — UC-180 (tasks 77, 227; FR-61; `design_spec.md` S-32, as `EasyESG Help Centre.dc.html`'s artboards 01 and 02
 * draw it — `architecture.md` §12.5.6's task-227 row (1)). **The section reads; the parts render**: the topics and the
 * library in the help's language (row (2)), and for a visitor the support channel (row (4)); then it narrows by what the
 * address holds (UX-4) and picks the arm — the topic cards, what a topic or a search kept, the first-use state, *nothing
 * matches*, or the read failed.
 *
 * **Two artboards, one screen** (S-32's one screen with a session-dependent shell): a signed-in reader, named by the
 * route, is greeted on a white band and offered *Ask a person*; a visitor meets the band's pine opening, *Asked before
 * signing up* (row (3)) and the account card. **It reads no session**: the route hands it the reader's name, or `null`.
 */
export async function HelpCentre({
  page,
  requestedContent,
  topic,
  query,
  reader,
}: {
  /** The page's language — the interface's. */
  readonly page: Locale;
  /** The help's language the address names, as given. */
  readonly requestedContent: string | undefined;
  /** The topic the address narrows to, as given. */
  readonly topic: string | undefined;
  /** What the reader searched for, as given. */
  readonly query: string;
  /** A signed-in reader's name, or `null` for a visitor. */
  readonly reader: { readonly name: string } | null;
}) {
  const content = helpLanguageOf({ requested: requestedContent, page });
  const [topics, articles, channel] = await Promise.all([
    readHelpTopics(content),
    readHelpArticles(content),
    reader === null ? readSupportChannel() : null,
  ]);
  const words = query.trim();
  const linkQuery = helpLanguageQuery({ content, page });
  const library =
    topics.status === API_OUTCOME.Ok && articles.status === API_OUTCOME.Ok
      ? { topics: topics.value.items, articles: articles.value.items }
      : null;
  const whole =
    library === null ? null : libraryOf({ ...library, topic: null, query: '', locale: content });
  const total = whole?.total ?? 0;

  const opening =
    reader === null ? (
      <VisitorOpening query={words} total={total} content={content} page={page} />
    ) : (
      <MemberOpening
        name={reader.name}
        query={words}
        total={total}
        content={content}
        page={page}
        fallbackCount={library === null ? 0 : fallbackCountOf({ articles: library.articles, content })}
      />
    );

  const rail =
    reader === null ? (
      <>
        <HelpAccountCard />
        <AskDirectly address={channel?.status === API_OUTCOME.Ok ? channel.value.address : null} />
      </>
    ) : (
      <AskAPerson />
    );

  // The arm the main column draws: the read failed, nothing published yet, a narrowing and what it kept, or the whole
  // library — the visitor's questions over the topic cards.
  let arm: ReactNode;
  const chosen = library === null ? null : topicOf({ requested: topic, topics: library.topics });
  if (library === null || whole === null) {
    arm = <CentreUnavailable />;
  } else if (whole.total === 0) {
    arm = <LibraryEmpty />;
  } else if (chosen !== null || words !== '') {
    const kept = libraryOf({ ...library, topic: chosen?.key ?? null, query: words, locale: content });
    arm =
      kept.matched === 0 ? (
        <LibraryNoMatch query={linkQuery} />
      ) : (
        <LibraryResults
          articles={kept.groups.flatMap((group) => group.articles)}
          topic={chosen}
          words={words}
          page={page}
          query={linkQuery}
        />
      );
  } else {
    const asked = reader === null ? askedBeforeSigningUpOf(library) : [];
    arm = (
      <>
        {asked.length === 0 ? null : <AskedBeforeSigningUp articles={asked} page={page} query={linkQuery} />}
        <TopicCards
          cards={topicCardsOf(whole)}
          total={whole.total}
          page={page}
          query={linkQuery}
          drawnFor={reader === null ? CARDS_FOR.VISITOR : CARDS_FOR.MEMBER}
        />
      </>
    );
  }

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} className={pageStyles.page}>
      {opening}
      <div className={`${pageStyles.columns} ${pageStyles.inner}`}>
        <div className={pageStyles.mainColumn}>{arm}</div>
        <div className={pageStyles.rail}>{rail}</div>
      </div>
    </main>
  );
}
