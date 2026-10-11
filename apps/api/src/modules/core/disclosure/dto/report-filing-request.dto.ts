import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { Trim } from '@api/app/decorators/trim.decorator';

/** The shape a calendar date takes on the wire; whether it is a real day is the use case's to say. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/** FR-41's *Mark as filed* (task 47.5): the day the reporter says the report was filed. */
export class MarkReportFiledRequestDto {
  @ApiProperty({
    example: '2026-10-09',
    description:
      'The day the report was filed, as a calendar date with no time and no offset; read in the reporting period’s ' +
      'time zone (NFR-34). S-11 offers today; the wire has no default.',
  })
  @Trim()
  @IsString()
  @Matches(CALENDAR_DATE)
  filedOn!: string;
}
