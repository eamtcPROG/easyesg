import { ApiProperty } from '@nestjs/swagger';
import { LOCALES, type Locale } from '@easyesg/i18n';
import type { HelpArticleSection } from '../domain/help-article';
import type { ServedHelpArticle } from '../services/content.service';

/** One section of an article: S-33's *On this page* lists the headings. */
export class HelpArticleSectionDto {
  @ApiProperty()
  readonly heading: string;

  @ApiProperty({
    description:
      'A small Markdown subset — paragraphs, lists, emphasis and links. Never HTML: render it with raw HTML off.',
  })
  readonly body: string;

  @ApiProperty({ description: 'Whether the section is disclosed for the reader to open rather than shown (UX-17).' })
  readonly disclosed: boolean;

  constructor(section: HelpArticleSection) {
    this.heading = section.heading;
    this.body = section.body;
    this.disclosed = section.disclosed;
  }
}

/** An article the reader is pointed to next — S-33's *Read next*. */
export class HelpArticleLinkDto {
  @ApiProperty()
  readonly key: string;

  @ApiProperty({ enum: LOCALES, description: 'The language its title is in.' })
  readonly locale: Locale;

  @ApiProperty()
  readonly title: string;

  constructor(link: { readonly key: string; readonly locale: Locale; readonly title: string }) {
    this.key = link.key;
    this.locale = link.locale;
    this.title = link.title;
  }
}

/** `GET /api/v1/content/help/articles/{key}` (task 76; UC-181; S-33): one article, whole. */
export class HelpArticleResponseDto {
  @ApiProperty({ example: 'what-vsme-asks' })
  readonly key: string;

  @ApiProperty({ description: 'The key of the topic it is grouped under, which may name no topic in force.' })
  readonly topic: string;

  @ApiProperty({
    enum: LOCALES,
    description:
      'The language this article’s text is in: the one asked for, or Romanian where the article has no text in it. A ' +
      'page marks the language of the part it shows, and shows no other sign of the fallback.',
  })
  readonly locale: Locale;

  @ApiProperty()
  readonly title: string;

  @ApiProperty()
  readonly summary: string;

  @ApiProperty({ description: 'The module the article belongs to, as the reader is told it.' })
  readonly module: string;

  @ApiProperty({ type: [HelpArticleSectionDto], description: 'In order; at least one.' })
  readonly sections: HelpArticleSectionDto[];

  @ApiProperty({
    type: [HelpArticleLinkDto],
    description: 'The articles it names to read next, in order — each in force; one that is not is left out.',
  })
  readonly related: HelpArticleLinkDto[];

  constructor({ article, related }: ServedHelpArticle) {
    this.key = article.key;
    this.topic = article.item.topic;
    this.locale = article.served.locale;
    this.title = article.served.text.title;
    this.summary = article.served.text.summary;
    this.module = article.served.text.module;
    this.sections = article.served.text.sections.map((section) => new HelpArticleSectionDto(section));
    this.related = related.map(
      (link) => new HelpArticleLinkDto({ key: link.key, locale: link.served.locale, title: link.served.text.title }),
    );
  }
}
