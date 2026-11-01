import { ApiProperty } from '@nestjs/swagger';
import { LOCALES, type Locale } from '@easyesg/i18n';
import type { HelpArticle, HelpArticleText } from '../domain/help-article';
import type { ServedItem } from '../domain/served-items';

/** `GET /api/v1/content/help/articles` (task 76; UC-180): one article of S-32's library, without its sections. */
export class HelpArticleSummaryResponseDto {
  @ApiProperty({ example: 'what-vsme-asks', description: 'The article’s key — its address under `/content/help/articles`.' })
  readonly key: string;

  @ApiProperty({
    example: 'first-report',
    description: 'The key of the topic it is grouped under, which may name no topic in force.',
  })
  readonly topic: string;

  @ApiProperty({
    enum: LOCALES,
    description:
      'The language this article’s text is in: the one asked for, or Romanian where the article has no text in it.',
  })
  readonly locale: Locale;

  @ApiProperty()
  readonly title: string;

  @ApiProperty()
  readonly summary: string;

  @ApiProperty({ description: 'The module the article belongs to, as the reader is told it.' })
  readonly module: string;

  constructor(article: ServedItem<HelpArticle, HelpArticleText>) {
    this.key = article.key;
    this.topic = article.item.topic;
    this.locale = article.served.locale;
    this.title = article.served.text.title;
    this.summary = article.served.text.summary;
    this.module = article.served.text.module;
  }
}
