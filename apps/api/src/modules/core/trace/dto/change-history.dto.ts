import { ApiProperty } from '@nestjs/swagger';
import {
  CHANGE_SOURCE,
  type ChangeActor,
  type ChangeEntry,
  type ChangeSource,
  type WordedChange,
} from '../models/change-history.model';

/** Who made a change (§12.5.6's task-84 row (c)). */
export class ChangeActorDto {
  @ApiProperty({ format: 'uuid' })
  readonly accountId: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The person’s name as the platform shows it (UX-137); null once their account is erased (FR-55).',
  })
  readonly name: string | null;

  @ApiProperty({ description: 'Whether they no longer hold access to the organization (UX-69): marked, never hidden.' })
  readonly removed: boolean;

  constructor(actor: ChangeActor) {
    this.accountId = actor.accountId;
    this.name = actor.name;
    this.removed = actor.removed;
  }
}

/** One field a change moved, in the reader's language. */
export class FieldChangeDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The field’s name; null where the change is the subject itself — a disclosure field’s answer, which the panel ' +
      'is titled with.',
  })
  readonly field: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'The value before, worded; null where it held none.' })
  readonly from: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'The value after, worded; null where it holds none.' })
  readonly to: string | null;

  constructor(change: WordedChange) {
    this.field = change.field;
    this.from = change.from;
    this.to = change.to;
  }
}

/** One statement in a record's history (UC-47; FR-54). */
export class ChangeEntryDto {
  @ApiProperty({ description: 'When the change was made — epoch milliseconds.', example: 1785843060000 })
  readonly at: number;

  @ApiProperty({
    type: ChangeActorDto,
    nullable: true,
    description: 'Who made it; null where no person did — the platform’s change.',
  })
  readonly actor: ChangeActorDto | null;

  @ApiProperty({
    enum: Object.values(CHANGE_SOURCE),
    nullable: true,
    description:
      'Where a disclosure value came from as this change left it — typed, carried forward from the prior period, ' +
      'calculated by the carbon calculator, or overridden; null for a record’s history.',
  })
  readonly source: ChangeSource | null;

  @ApiProperty({ type: [FieldChangeDto] })
  readonly changes: FieldChangeDto[];

  constructor(entry: ChangeEntry) {
    this.at = entry.at.getTime();
    this.actor = entry.actor === null ? null : new ChangeActorDto(entry.actor);
    this.source = entry.source;
    this.changes = entry.changes.map((change) => new FieldChangeDto(change));
  }
}
