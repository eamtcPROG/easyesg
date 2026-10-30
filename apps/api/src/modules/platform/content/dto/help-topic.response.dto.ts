import { ApiProperty } from '@nestjs/swagger';
import { LOCALES, type Locale } from '@easyesg/i18n';
import type { HelpTopic, HelpTopicText } from '../domain/help-topic';
import type { ServedItem } from '../domain/served-items';

/** `GET /api/v1/content/help/topics` (task 76; UC-180): one of S-32's *what you are doing* groups. */
export class HelpTopicResponseDto {
  @ApiProperty({ example: 'first-report', description: 'The topic’s key, which an article names to be grouped under it.' })
  readonly key: string;

  @ApiProperty({
    enum: LOCALES,
    description:
      'The language this topic’s text is in: the one asked for, or Romanian where the topic has no text in it. A page ' +
      'marks the language of the part it shows, and shows no other sign of the fallback.',
  })
  readonly locale: Locale;

  @ApiProperty()
  readonly title: string;

  @ApiProperty()
  readonly summary: string;

  constructor(topic: ServedItem<HelpTopic, HelpTopicText>) {
    this.key = topic.key;
    this.locale = topic.served.locale;
    this.title = topic.served.text.title;
    this.summary = topic.served.text.summary;
  }
}
