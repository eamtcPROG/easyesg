import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis } from '@api/contracts/types/time';
import {
  AUDIT_ACTION,
  type AuditAction,
} from '@api/modules/platform/audit/models/audit-action.model';
import type { SystemAuditLogEntry } from '../models/system-audit-log.model';

/**
 * One entry of A-08's log (task 67.4; UC-88, FR-81). **The parties are flattened into id and address**
 * rather than nested objects, so a missing party is two nulls a client reads the same way everywhere.
 */
export class SystemAuditLogEntryResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ type: Number, description: 'Unix epoch milliseconds when it happened.' })
  readonly occurredAt: EpochMillis;

  @ApiProperty({ enum: Object.values(AUDIT_ACTION), description: 'What happened.' })
  readonly action: AuditAction;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uuid',
    description:
      'The operator who acted. Null for the provisioning command, and for a sign-in attempt against ' +
      'an address that matches no account.',
  })
  readonly actorId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'email',
    description: 'The acting operator’s address. Null with `actorId`, or where no account holds that id.',
  })
  readonly actorEmail: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'The account or invitation the event acted on. Null for an event that acted on none.',
  })
  readonly targetId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'email',
    description: 'The target’s address, where the target is an account or an invitation.',
  })
  readonly targetEmail: string | null;

  constructor(entry: SystemAuditLogEntry) {
    this.id = entry.id;
    this.occurredAt = entry.occurredAt.getTime();
    this.action = entry.action;
    this.actorId = entry.actor?.id ?? null;
    this.actorEmail = entry.actor?.email ?? null;
    this.targetId = entry.target?.id ?? null;
    this.targetEmail = entry.target?.email ?? null;
  }
}
