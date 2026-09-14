import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import { SUPPORT_ACCESS_ENTRY_KIND } from '../models/support-access-log.model';
import {
  SUPPORT_ACCESS_STATE,
  type SupportAccessRequest,
  type SupportAccessState,
} from '../models/support-access-request.model';

/**
 * A support-access request as it stands (task 67.9; UC-85) — what the organization's banner shows, and the part
 * of A-07's log entry every reader shares. Instants are epoch milliseconds, converted here and nowhere else.
 */
export class SupportAccessRequestResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ format: 'uuid' })
  readonly organizationId: string;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'email',
    description:
      'The Platform Administrator who asked — the address the organization is shown. Null for an operator ' +
      'account since removed.',
  })
  readonly requesterEmail: string | null;

  @ApiProperty({ example: 'SUP-4417' })
  readonly ticketReference: string;

  @ApiProperty({ description: 'Why access is asked for, as the operator wrote it for the organization.' })
  readonly reason: string;

  @ApiProperty({
    enum: Object.values(SUPPORT_ACCESS_STATE),
    description:
      'awaiting — nobody has answered, for up to 24 hours; active — granted and within its 60 minutes; ' +
      'declined; lapsed — nobody answered in time; ended — granted, then ended early; expired — its 60 ' +
      'minutes ran out.',
  })
  readonly state: SupportAccessState;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds when the request was raised.' })
  readonly requestedAt: EpochMillis;

  @ApiProperty({
    type: Number,
    description: 'Unix epoch milliseconds when an unanswered request stops waiting — 24 hours after it was raised.',
  })
  readonly lapsesAt: EpochMillis;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Unix epoch milliseconds when the organization granted it; null for a request never granted.',
  })
  readonly grantedAt: EpochMillis | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Unix epoch milliseconds when the grant’s 60 minutes run out; null for a request never granted.',
  })
  readonly expiresAt: EpochMillis | null;

  constructor(request: SupportAccessRequest) {
    this.id = request.id;
    this.organizationId = request.organizationId;
    this.requesterEmail = request.requesterEmail;
    this.ticketReference = request.ticketReference;
    this.reason = request.reason;
    this.state = request.state;
    this.requestedAt = request.requestedAt.getTime();
    this.lapsesAt = request.lapsesAt.getTime();
    this.grantedAt =
      request.decision?.kind === SUPPORT_ACCESS_ENTRY_KIND.GRANT ? request.decision.occurredAt.getTime() : null;
    this.expiresAt = request.expiresAt?.getTime() ?? null;
  }
}
