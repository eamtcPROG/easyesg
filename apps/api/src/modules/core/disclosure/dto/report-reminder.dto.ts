import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Trim } from '@api/app/decorators/trim.decorator';
import { REMINDER_NOTE_MAX_LENGTH } from '../models/report-reminder.model';

/**
 * UC-175's reminder, as S-16 sends it (task 50.3; `architecture.md` §12.5.6's task-50.3 row). **The report is the
 * route's, the person the body's**, and the sender is nobody's field: it is the request's actor.
 */
export class SendReportReminderRequestDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The membership of the person to remind — any active member of the organization but the sender.',
  })
  @IsUUID()
  membershipId!: string;

  @ApiPropertyOptional({
    maxLength: REMINDER_NOTE_MAX_LENGTH,
    example: 'Mai lipsesc datele despre consumul de energie.',
    description: 'A note from the sender, shown to the person as written. Omitted, or only whitespace, is none.',
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(REMINDER_NOTE_MAX_LENGTH)
  note?: string;
}
