import { ApiProperty } from '@nestjs/swagger';
import { TAXONOMY_FIELD_CHANGE, type TaxonomyFieldChange } from '@api/contracts/taxonomy-mapping.port';
import type { MigrationReview, ReviewedField } from '../models/report-migration-review.model';

/** S-49's read on the wire (task 67.20) — the move and the changed fields by label; an instant in epoch milliseconds. */
export class ReviewedFieldResponseDto {
  @ApiProperty({ description: 'The field’s label in the reader’s language.' }) readonly label: string;
  @ApiProperty({ enum: Object.values(TAXONOMY_FIELD_CHANGE) }) readonly change: TaxonomyFieldChange;

  constructor(field: ReviewedField) {
    this.label = field.label;
    this.change = field.change;
  }
}

export class MigrationReviewResponseDto {
  @ApiProperty({ example: '2026-02-01', description: 'The version of the standard the report used before the move.' })
  readonly from: string;
  @ApiProperty({ example: '2026-05-01', description: 'The version it uses now, until accepted or declined.' })
  readonly to: string;
  @ApiProperty({ description: 'When the report was moved — epoch milliseconds.' }) readonly migratedAt: number;
  @ApiProperty({ type: [ReviewedFieldResponseDto], description: 'The fields the version change touches, by label.' })
  readonly fields: ReviewedFieldResponseDto[];

  constructor(review: MigrationReview) {
    this.from = review.from;
    this.to = review.to;
    this.migratedAt = review.migratedAt.getTime();
    this.fields = review.fields.map((field) => new ReviewedFieldResponseDto(field));
  }
}
