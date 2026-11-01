import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { EXPORT_FORMAT, type ExportFormat } from '../constants/export.constants';

/** UC-42 and UC-43's request (task 47.4): S-11's two decisions, and the acknowledgement its warning collects. */
export class RequestExportRequestDto {
  @ApiProperty({ enum: Object.values(EXPORT_FORMAT), description: 'The file: the PDF, or the EFRAG Digital Template.' })
  @IsIn(Object.values(EXPORT_FORMAT))
  format!: ExportFormat;

  @ApiProperty({
    enum: LOCALES,
    description:
      'The file’s language, chosen independently of the interface’s (FR-52). S-11 starts from the account’s export ' +
      'language; the request always names one.',
  })
  @IsIn(LOCALES)
  locale!: Locale;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'That the person asking has seen the report’s unresolved findings and exports with them (FR-44). Absent is not ' +
      'acknowledged: a report holding unresolved findings is then refused with them listed, and the same request ' +
      'carrying this is accepted.',
  })
  @IsOptional()
  @IsBoolean()
  acknowledgeUnresolvedFindings?: boolean;
}
