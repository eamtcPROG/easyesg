import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, Matches, Min } from 'class-validator';
import { RULE_FAMILY, type RuleFamily, type RulesSlot } from '../models/rules-console.model';

/** A-05 on the wire (task 67.8) — each slot's payload is the artefact as the store holds it, for the editor to change. */
const DAY = /^\d{4}-\d{2}-\d{2}$/u;

export class RulesSlotResponseDto {
  @ApiProperty({ enum: Object.values(RULE_FAMILY) }) readonly family!: RuleFamily;
  @ApiProperty({ example: 'md', description: 'A factor set’s country; the standard for the other two families.' })
  readonly scope!: string;
  @ApiProperty({ description: 'The revision a change is made against.' }) readonly revision!: number;
  @ApiProperty({ type: String, nullable: true, description: 'Inclusive; null for an undated slot or a window open to the past.' })
  readonly validFrom!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Exclusive; null for an open window.' })
  readonly validTo!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true, description: 'The artefact in force.' })
  readonly payload!: Record<string, unknown>;
}

export class RulesConsoleResponseDto {
  @ApiProperty({ type: [RulesSlotResponseDto] }) readonly slots: RulesSlotResponseDto[];

  constructor(slots: readonly RulesSlot[]) {
    this.slots = slots.map((slot) => ({ ...slot }));
  }
}

export class PublishRulesRequestDto {
  @ApiProperty({ type: 'object', additionalProperties: true, description: 'The artefact to put in force, whole.' })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiProperty({ type: String, nullable: true, required: false, description: 'The window it is published for, as read.' })
  @IsOptional()
  @Matches(DAY)
  validFrom?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, description: 'The window’s exclusive end, as read.' })
  @IsOptional()
  @Matches(DAY)
  validTo?: string | null;

  @ApiProperty({ minimum: 0, description: 'The slot’s revision as read.' }) @IsInt() @Min(0) expectedRevision!: number;
}

export class PublishedRulesResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The version put in force.' }) readonly id: string;
  @ApiProperty() readonly revision: number;

  constructor(published: { readonly id: string; readonly revision: number }) {
    this.id = published.id;
    this.revision = published.revision;
  }
}
