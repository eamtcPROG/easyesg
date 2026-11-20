import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID, Matches } from 'class-validator';
import { REPORT_MIGRATION_STATUS, type ReportMigrationStatus } from '@api/contracts/report-migration';
import type { MigrationTally } from '../domain/migration-run';
import { COMPATIBILITY, type Compatibility } from '../domain/version-mapping';
import type {
  MigrationRunDetail,
  MigrationRunOrganization,
  MigrationRunSummary,
  MigrationSelectionPreview,
} from '../models/migration-run.model';

/**
 * A-04's migration runs on the wire (tasks 67.23, 67.7; UC-78; 182/43) — counts and outcomes, never a report's value.
 * An instant is epoch milliseconds; a tally is every status in the vocabulary's order, so the contract states the set.
 */
const VERSION = /^\d{4}-\d{2}-\d{2}$/u;

/** The console narrows a run to the organizations an operator picks from the exposure view — a page of them at most. */
const ORGANIZATIONS_AT_MOST = 200;

export class MigrationRunRequestDto {
  @ApiProperty({ example: '2026-02-01' }) @Matches(VERSION) from!: string;
  @ApiProperty({ example: '2026-05-01' }) @Matches(VERSION) to!: string;
  @ApiProperty({ example: '1.3.0', description: 'A template release registered against `to`.' })
  @Matches(/^\d+\.\d+\.\d+$/u)
  toTemplateVersion!: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: ORGANIZATIONS_AT_MOST,
    description: 'Narrows the run to these organizations; absent selects every organization’s reports on `from`.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ORGANIZATIONS_AT_MOST)
  @IsUUID('all', { each: true })
  organizationIds?: string[];
}

export class MigrationSelectionPreviewResponseDto {
  @ApiProperty({ enum: Object.values(COMPATIBILITY), description: 'How the run would land each report.' })
  readonly determination: Compatibility;
  @ApiProperty({ description: 'Reports the run would move.' }) readonly reports: number;
  @ApiProperty() readonly organizations: number;
  @ApiProperty({ description: 'Reports on the version that a run leaves out as read-only — a locked period or an archived entity.' })
  readonly leftOut: number;

  constructor(preview: MigrationSelectionPreview) {
    this.determination = preview.determination;
    this.reports = preview.reports;
    this.organizations = preview.organizations;
    this.leftOut = preview.leftOut;
  }
}

export class MigrationTallyEntryResponseDto {
  @ApiProperty({ enum: Object.values(REPORT_MIGRATION_STATUS) }) readonly status!: ReportMigrationStatus;
  @ApiProperty() readonly reports!: number;
}

const entriesOf = (tally: MigrationTally): MigrationTallyEntryResponseDto[] =>
  Object.values(REPORT_MIGRATION_STATUS).map((status) => ({ status, reports: tally[status] }));

export class MigrationRunSummaryResponseDto {
  @ApiProperty({ format: 'uuid' }) readonly id: string;
  @ApiProperty({ example: '2026-02-01' }) readonly from: string;
  @ApiProperty({ example: '2026-05-01' }) readonly to: string;
  @ApiProperty({ example: '1.3.0' }) readonly toTemplateVersion: string;
  @ApiProperty({ enum: Object.values(COMPATIBILITY), description: 'The pair’s determination when the run started.' })
  readonly determination: Compatibility;
  @ApiProperty({ description: 'When the run started — epoch milliseconds.' }) readonly requestedAt: number;
  @ApiProperty({ type: String, nullable: true, description: 'The operator’s address; null where the account no longer reads.' })
  readonly requestedBy: string | null;
  @ApiProperty({ type: Number, nullable: true, description: 'When the run was reverted — epoch milliseconds; null while it stands.' })
  readonly revertedAt: number | null;
  @ApiProperty({ description: 'Reports the run selected.' }) readonly selected: number;
  @ApiProperty({ description: 'Selected reports the worker has not reached yet.' }) readonly pending: number;
  @ApiProperty({ type: [MigrationTallyEntryResponseDto], description: 'Every status, in the vocabulary’s order.' })
  readonly tally: MigrationTallyEntryResponseDto[];

  constructor(run: MigrationRunSummary) {
    this.id = run.id;
    this.from = run.from;
    this.to = run.to;
    this.toTemplateVersion = run.toTemplateVersion;
    this.determination = run.determination;
    this.requestedAt = run.requestedAt.getTime();
    this.requestedBy = run.requestedBy;
    this.revertedAt = run.revertedAt === null ? null : run.revertedAt.getTime();
    this.selected = run.selected;
    this.pending = run.pending;
    this.tally = entriesOf(run.tally);
  }
}

export class MigrationRunsResponseDto {
  @ApiProperty({ type: [MigrationRunSummaryResponseDto], description: 'The latest runs, newest first.' })
  readonly runs: MigrationRunSummaryResponseDto[];

  constructor(runs: readonly MigrationRunSummary[]) {
    this.runs = runs.map((run) => new MigrationRunSummaryResponseDto(run));
  }
}

export class MigrationRunOrganizationResponseDto {
  @ApiProperty({ format: 'uuid' }) readonly organizationId: string;
  @ApiProperty() readonly name: string;
  @ApiProperty() readonly selected: number;
  @ApiProperty() readonly pending: number;
  @ApiProperty({ type: [MigrationTallyEntryResponseDto] }) readonly tally: MigrationTallyEntryResponseDto[];

  constructor(organization: MigrationRunOrganization) {
    this.organizationId = organization.organizationId;
    this.name = organization.name;
    this.selected = organization.selected;
    this.pending = organization.pending;
    this.tally = entriesOf(organization.tally);
  }
}

export class MigrationRunResponseDto extends MigrationRunSummaryResponseDto {
  @ApiProperty({ type: [MigrationRunOrganizationResponseDto], description: 'Per organization, by name — counts only.' })
  readonly organizations: MigrationRunOrganizationResponseDto[];

  constructor(run: MigrationRunDetail) {
    super(run);
    this.organizations = run.organizations.map((organization) => new MigrationRunOrganizationResponseDto(organization));
  }
}

export class MigrationRunIdResponseDto {
  @ApiProperty({ format: 'uuid' }) readonly id: string;

  constructor(run: { readonly id: string }) {
    this.id = run.id;
  }
}
