import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@easyesg/i18n';
import { CONTENT_FALLBACK_REPORTER, type ContentFallbackReporter } from '@api/contracts/content-fallback.port';
import { CONTENT_KIND, type ContentKind, contentKey } from '../constants/content.constants';
import type { HelpArticle, HelpArticleText } from '../domain/help-article';
import type { HelpTopic, HelpTopicText } from '../domain/help-topic';
import type { PlanCopy, PlanCopyText } from '../domain/plan-copy';
import { type ContentItem, type ServedItem, itemsNamed } from '../domain/served-items';
import { HelpArticleNotFoundError } from '../errors/content.errors';
import { PublishedContentReader } from './published-content-reader.service';

/** An article as S-33 shows it, and the articles it names to read next that are in force. */
export interface ServedHelpArticle {
  readonly article: ServedItem<HelpArticle, HelpArticleText>;
  readonly related: readonly ServedItem<HelpArticle, HelpArticleText>[];
}

/**
 * UC-180's and UC-181's reads, and the home's plan copy (task 76; FR-61, FR-64, FR-204; `architecture.md` §12.5.6's
 * task-76 row (1), (4)) — what a reader with no session is shown in the language they asked for.
 *
 * **It reports what a reader is shown and nothing else**: every item of a list, and of an article the article and the
 * ones it names. A locale an item has no text in is served in Romanian with no marker (UX-97) and reported under the
 * item's content key and the locale asked for, so the gap reaches FR-64's queue (UC-14). Reporting is `void` — the
 * queue gathers and writes on its own time — so a read writes nothing in its request.
 */
@Injectable()
export class ContentService {
  constructor(
    private readonly published: PublishedContentReader,
    @Inject(CONTENT_FALLBACK_REPORTER) private readonly fallbacks: ContentFallbackReporter,
  ) {}

  helpTopics(input: { readonly locale: Locale }): readonly ServedItem<HelpTopic, HelpTopicText>[] {
    const { items } = this.published.helpTopics(input);
    this.report({ kind: CONTENT_KIND.HELP_TOPIC, shown: items, locale: input.locale });
    return items;
  }

  helpArticles(input: { readonly locale: Locale }): readonly ServedItem<HelpArticle, HelpArticleText>[] {
    const { items } = this.published.helpArticles(input);
    this.report({ kind: CONTENT_KIND.HELP_ARTICLE, shown: items, locale: input.locale });
    return items;
  }

  helpArticle(input: { readonly key: string; readonly locale: Locale }): ServedHelpArticle {
    const { items } = this.published.helpArticles({ locale: input.locale });
    const article = items.find((item) => item.key === input.key);
    if (article === undefined) throw new HelpArticleNotFoundError();
    const related = itemsNamed({ keys: article.item.related, items });
    this.report({ kind: CONTENT_KIND.HELP_ARTICLE, shown: [article, ...related], locale: input.locale });
    return { article, related };
  }

  planCopy(input: { readonly locale: Locale }): readonly ServedItem<PlanCopy, PlanCopyText>[] {
    const { items } = this.published.planCopy(input);
    this.report({ kind: CONTENT_KIND.PLAN_COPY, shown: items, locale: input.locale });
    return items;
  }

  private report<Item extends ContentItem<Text>, Text>(input: {
    readonly kind: ContentKind;
    readonly shown: readonly ServedItem<Item, Text>[];
    readonly locale: Locale;
  }): void {
    for (const item of input.shown) {
      if (item.served.fellBack) {
        this.fallbacks.report({ key: contentKey({ kind: input.kind, key: item.key }), locale: input.locale });
      }
    }
  }
}
