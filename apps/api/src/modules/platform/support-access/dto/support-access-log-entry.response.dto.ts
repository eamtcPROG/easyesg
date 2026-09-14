import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import {
  SUPPORT_ACCESS_ENTRY_KIND,
  SUPPORT_ACCESS_READ_PURPOSE,
  type SupportAccessReadPurpose,
} from '../models/support-access-log.model';
import {
  SUPPORT_ACCESS_ACTOR_REALM,
  type SupportAccessAccessRecord,
  type SupportAccessActorRealm,
  type SupportAccessDecisionKind,
  type SupportAccessDecisionRecord,
  type SupportAccessLogEntry,
} from '../models/support-access-request.model';
import { SupportAccessRequestResponseDto } from './support-access-request.response.dto';

/** A grant, decline or end, and who took it (task 67.9). */
export class SupportAccessDecisionResponseDto {
  @ApiProperty({
    enum: [SUPPORT_ACCESS_ENTRY_KIND.GRANT, SUPPORT_ACCESS_ENTRY_KIND.DECLINE, SUPPORT_ACCESS_ENTRY_KIND.END],
  })
  readonly kind: SupportAccessDecisionKind;

  @ApiProperty({
    enum: Object.values(SUPPORT_ACCESS_ACTOR_REALM),
    description: 'organization — a member of the organization; platform — a Platform Administrator.',
  })
  readonly actorRealm: SupportAccessActorRealm;

  @ApiProperty({ type: String, nullable: true, format: 'email', description: 'Null for an account since removed.' })
  readonly actorEmail: string | null;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds.' })
  readonly occurredAt: EpochMillis;

  constructor(decision: SupportAccessDecisionRecord) {
    this.kind = decision.kind;
    this.actorRealm = decision.actorRealm;
    this.actorEmail = decision.actorEmail;
    this.occurredAt = decision.occurredAt.getTime();
  }
}

/** One read made under the grant — FR-79's *what was accessed*. */
export class SupportAccessAccessResponseDto {
  @ApiProperty({
    enum: Object.values(SUPPORT_ACCESS_READ_PURPOSE),
    description: 'reports — the report list; report_modules — one report’s modules; report_module — one module.',
  })
  readonly purpose: SupportAccessReadPurpose;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The report read, or the report and module as `<report id>/<module>`. Null for the list.',
  })
  readonly subject: string | null;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds.' })
  readonly occurredAt: EpochMillis;

  constructor(access: SupportAccessAccessRecord) {
    this.purpose = access.purpose;
    this.subject = access.subject;
    this.occurredAt = access.occurredAt.getTime();
  }
}

/**
 * One entry of A-07's log (task 67.9; UC-86, FR-79): who asked, over which organization, for what reason, what
 * the organization decided and who decided it, how it ended, and what was read under it.
 */
export class SupportAccessLogEntryResponseDto extends SupportAccessRequestResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The Platform Administrator who asked.' })
  readonly requesterId: string;

  @ApiProperty({ type: String, nullable: true, example: 'Lactate Nord SA' })
  readonly organizationName: string | null;

  @ApiProperty({
    type: SupportAccessDecisionResponseDto,
    nullable: true,
    description: 'The organization’s answer, where one came before the request lapsed.',
  })
  readonly decision: SupportAccessDecisionResponseDto | null;

  @ApiProperty({
    type: SupportAccessDecisionResponseDto,
    nullable: true,
    description: 'The end that came while the grant was running, from either realm.',
  })
  readonly ended: SupportAccessDecisionResponseDto | null;

  @ApiProperty({ type: [SupportAccessAccessResponseDto], description: 'Every read made under the grant, oldest first.' })
  readonly accesses: SupportAccessAccessResponseDto[];

  constructor(entry: SupportAccessLogEntry) {
    super(entry);
    this.requesterId = entry.requesterId;
    this.organizationName = entry.organizationName;
    this.decision = entry.decision === null ? null : new SupportAccessDecisionResponseDto(entry.decision);
    this.ended = entry.ended === null ? null : new SupportAccessDecisionResponseDto(entry.ended);
    this.accesses = entry.accesses.map((access) => new SupportAccessAccessResponseDto(access));
  }
}
