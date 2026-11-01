import { ApiProperty } from '@nestjs/swagger';
import { LOCALES, type Locale } from '@easyesg/i18n';
import type { EpochMillis } from '@api/contracts/types/time';
import { EXPORT_FORMAT, EXPORT_STATUS, type ExportFormat, type ExportStatus } from '../constants/export.constants';
import type { ExportRecord } from '../models/export-record.model';

const EPOCH_MILLIS = 'Unix epoch milliseconds, UTC.';

/** Who asked for an export, as its history names them (UX-49, UX-137). */
export class ExportRequesterDto {
  @ApiProperty({ format: 'uuid', description: 'The account that asked for the export.' })
  readonly accountId: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Their display name as it reads now, or null where the account no longer exists.',
  })
  readonly name: string | null;

  constructor(person: ExportRecord['requestedBy']) {
    this.accountId = person.accountId;
    this.name = person.name;
  }
}

/** One export as S-11's history and its watch read it (tasks 47.1, 47.3; FR-53; UX-49). */
export class ExportResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The export — also its job’s id, which S-11 watches.' })
  readonly id: string;

  @ApiProperty({ format: 'uuid' })
  readonly reportId: string;

  @ApiProperty({ enum: Object.values(EXPORT_FORMAT) })
  readonly format: ExportFormat;

  @ApiProperty({ enum: LOCALES, description: 'The file’s language (FR-52).' })
  readonly locale: Locale;

  @ApiProperty({ example: '1.3.0', description: 'The EFRAG Digital Template release it was produced at (DR-4).' })
  readonly templateVersion: string;

  @ApiProperty({ example: '2026-05-01', description: 'The VSME taxonomy release it was produced at (DR-4).' })
  readonly taxonomyVersion: string;

  @ApiProperty({
    enum: Object.values(EXPORT_STATUS),
    description: 'Requested while its job runs, completed once its file is stored, failed after its last attempt.',
  })
  readonly status: ExportStatus;

  @ApiProperty({ type: Number, description: `When it was asked for — ${EPOCH_MILLIS}` })
  readonly requestedAt: EpochMillis;

  @ApiProperty({ type: ExportRequesterDto })
  readonly requestedBy: ExportRequesterDto;

  @ApiProperty({ type: Number, nullable: true, description: `When its file was stored — ${EPOCH_MILLIS} Null until it is.` })
  readonly completedAt: EpochMillis | null;

  @ApiProperty({ type: Number, nullable: true, description: `When its last attempt failed — ${EPOCH_MILLIS} Null unless it did.` })
  readonly failedAt: EpochMillis | null;

  @ApiProperty({ type: Number, nullable: true, description: 'The stored file’s size in bytes, null until it is stored.' })
  readonly byteSize: number | null;

  constructor(record: ExportRecord) {
    this.id = record.id;
    this.reportId = record.reportId;
    this.format = record.format;
    this.locale = record.locale;
    this.templateVersion = record.templateVersion;
    this.taxonomyVersion = record.taxonomyVersion;
    this.status = record.status;
    this.requestedAt = record.requestedAt.getTime();
    this.requestedBy = new ExportRequesterDto(record.requestedBy);
    this.completedAt = record.completedAt?.getTime() ?? null;
    this.failedAt = record.failedAt?.getTime() ?? null;
    this.byteSize = record.byteSize;
  }
}
