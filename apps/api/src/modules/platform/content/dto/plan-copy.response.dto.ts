import { ApiProperty } from '@nestjs/swagger';
import { LOCALES, type Locale } from '@easyesg/i18n';
import type { PlanCopy, PlanCopyText } from '../domain/plan-copy';
import type { ServedItem } from '../domain/served-items';

/**
 * `GET /api/v1/content/plans` (task 76; FR-204): what S-29's pricing section says of one plan. **No price** — that is the
 * billing catalogue's, versioned on purpose (182/118), and read from it.
 */
export class PlanCopyResponseDto {
  @ApiProperty({ example: 'standard', description: 'The plan’s code, as the billing catalogue names the plan.' })
  readonly plan: string;

  @ApiProperty({
    enum: LOCALES,
    description: 'The language this copy is in: the one asked for, or Romanian where the copy has no text in it.',
  })
  readonly locale: Locale;

  @ApiProperty()
  readonly name: string;

  @ApiProperty()
  readonly summary: string;

  @ApiProperty({ type: [String], description: 'What the plan offers, in order; may be empty.' })
  readonly highlights: string[];

  @ApiProperty({ type: String, nullable: true, description: 'A word set beside the name, or null.' })
  readonly badge: string | null;

  constructor(copy: ServedItem<PlanCopy, PlanCopyText>) {
    this.plan = copy.key;
    this.locale = copy.served.locale;
    this.name = copy.served.text.name;
    this.summary = copy.served.text.summary;
    this.highlights = [...copy.served.text.highlights];
    this.badge = copy.served.text.badge;
  }
}
