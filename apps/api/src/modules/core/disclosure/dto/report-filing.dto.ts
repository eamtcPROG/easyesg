import { ApiProperty } from '@nestjs/swagger';
import type { EpochMillis, LegalDate } from '@api/contracts/types/time';
import { LegalDateDto } from '@api/modules/core/period/dto/reporting-period.dto';
import type { ReportFiling } from '../models/report.model';

/** Who marked a report filed, as the mark names them. */
export class FilingPersonDto {
  @ApiProperty({ format: 'uuid', description: 'The account that marked the report filed.' })
  readonly accountId: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Their display name as it reads now, or null where the account no longer exists.',
  })
  readonly name: string | null;

  constructor(person: ReportFiling['filedBy']) {
    this.accountId = person.accountId;
    this.name = person.name;
  }
}

/** The reporter's filed mark (task 47.5; FR-41; §12.5.6's task-47 row (1)–(4)). */
export class ReportFilingDto {
  @ApiProperty({ type: LegalDateDto, description: 'The day the reporter says the report was filed.' })
  readonly filedOn: LegalDate;

  @ApiProperty({ type: Number, description: 'When it was marked — Unix epoch milliseconds, UTC.' })
  readonly filedAt: EpochMillis;

  @ApiProperty({ type: FilingPersonDto })
  readonly filedBy: FilingPersonDto;

  constructor(filing: ReportFiling) {
    this.filedOn = filing.filedOn;
    this.filedAt = filing.filedAt.getTime();
    this.filedBy = new FilingPersonDto(filing.filedBy);
  }
}
