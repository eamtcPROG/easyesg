import { Injectable, Logger } from '@nestjs/common';
import type { FallbackReport, Locale } from '@easyesg/i18n';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { CONTENT_KIND, type ContentKind, contentKey } from '../constants/content.constants';
import { type HelpArticle, type HelpArticleText, readHelpArticle } from '../domain/help-article';
import { type HelpTopic, type HelpTopicText, readHelpTopic } from '../domain/help-topic';
import { translatedLocales } from '../domain/localized';
import { type PlanCopy, type PlanCopyText, readPlanCopy } from '../domain/plan-copy';
import { RevisionReadings } from '../domain/revision-readings';
import { type ContentItem, type Serving, type StoredItem, serveItems } from '../domain/served-items';

/**
 * What FR-61's store holds in force, read (task 76; `architecture.md` §12.5.6's task-76 row (1), (2)). **Published-only
 * by construction**: it reads the configuration store's cache, which holds only what `config.entry_schedule` puts in
 * force — a draft has no schedule entry and so nothing here can reach it. Each revision is read once (`RevisionReadings`).
 *
 * **An item the reader refuses is left out and logged at `error` on every read**, `LegalControllerService`'s shape, so
 * whoever replaces it sees the line stop; the store refuses such a payload at publication, so only a write around the
 * publisher can put one in force.
 */
@Injectable()
export class PublishedContentReader {
  private readonly logger = new Logger(PublishedContentReader.name);
  private readonly topics = new RevisionReadings(readHelpTopic);
  private readonly articles = new RevisionReadings(readHelpArticle);
  private readonly plans = new RevisionReadings(readPlanCopy);

  constructor(private readonly configurationStore: ConfigurationStore) {}

  helpTopics(input: { readonly locale: Locale }): Serving<HelpTopic, HelpTopicText> {
    return this.serve<HelpTopic, HelpTopicText>({ kind: CONTENT_KIND.HELP_TOPIC, readings: this.topics, ...input });
  }

  helpArticles(input: { readonly locale: Locale }): Serving<HelpArticle, HelpArticleText> {
    return this.serve<HelpArticle, HelpArticleText>({
      kind: CONTENT_KIND.HELP_ARTICLE,
      readings: this.articles,
      ...input,
    });
  }

  planCopy(input: { readonly locale: Locale }): Serving<PlanCopy, PlanCopyText> {
    return this.serve<PlanCopy, PlanCopyText>({ kind: CONTENT_KIND.PLAN_COPY, readings: this.plans, ...input });
  }

  /** Every item's content key with each locale it carries text in — what the translation queue may clear (row (5)). */
  translated(): FallbackReport[] {
    return [
      ...this.translatedOf({ kind: CONTENT_KIND.HELP_TOPIC, readings: this.topics }),
      ...this.translatedOf({ kind: CONTENT_KIND.HELP_ARTICLE, readings: this.articles }),
      ...this.translatedOf({ kind: CONTENT_KIND.PLAN_COPY, readings: this.plans }),
    ];
  }

  private serve<Item extends ContentItem<Text>, Text>(input: {
    readonly kind: ContentKind;
    readonly readings: RevisionReadings<Item>;
    readonly locale: Locale;
  }): Serving<Item, Text> {
    const serving = serveItems<Item, Text>({
      stored: this.stored(input.kind),
      read: (stored) => input.readings.item(stored),
      locale: input.locale,
    });
    for (const item of serving.unreadable) {
      this.logger.error(
        `Configuration entry ${input.kind}/${item.key} (revision ${item.revision}) is not readable; it is not served until it is replaced`,
      );
    }
    return serving;
  }

  private translatedOf(input: {
    readonly kind: ContentKind;
    readonly readings: RevisionReadings<ContentItem<unknown>>;
  }): FallbackReport[] {
    return this.stored(input.kind).flatMap((stored) => {
      const item = input.readings.item(stored);
      if (item === null) return [];
      const key = contentKey({ kind: input.kind, key: stored.key });
      return translatedLocales(item.text).map((locale) => ({ key, locale }));
    });
  }

  private stored(kind: ContentKind): StoredItem[] {
    return this.configurationStore
      .list({ kind })
      .map((entry) => ({ key: entry.scope, revision: entry.revision, payload: entry.payload }));
  }
}
