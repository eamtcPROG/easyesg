import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AUDIT_TARGET, AuditAction } from '@api/app/decorators/audit-action.decorator';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import {
  MigrationRunIdResponseDto,
  MigrationRunRequestDto,
  MigrationRunResponseDto,
  MigrationRunsResponseDto,
  MigrationSelectionPreviewResponseDto,
} from '@api/modules/platform/taxonomy/dto/migration-run.dto';
import { MigrationRunService } from '@api/modules/platform/taxonomy/services/migration-run.service';
import { RequiresAdminPermission } from '../decorators/requires-admin-permission.decorator';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { ADMIN_PERMISSION } from '../models/console-role.model';

const PROBLEM = { 'application/problem+json': {} };
const RUN_ID = 'runId';
const BY_RUN = { from: AUDIT_TARGET.PARAM, name: RUN_ID } as const;

const SIGNED_OUT = { status: 401, description: 'No usable operator session (problem type authentication-required).', content: PROBLEM } as const;
const NOT_PERMITTED = {
  status: 403,
  description: 'The operator is not a Platform Administrator, or their roles do not hold the permission (problem type insufficient-role).',
  content: PROBLEM,
} as const;
const UNKNOWN_RUN = { status: 404, description: 'No run by that id (problem type not-found).', content: PROBLEM } as const;
const UNKNOWN_PAIR = {
  status: 404,
  description: 'A version the store does not register, or a template not registered against `to` (problem type not-found).',
  content: PROBLEM,
} as const;
const RUN_REQUEST = (body: MigrationRunRequestDto) => ({
  from: body.from,
  to: body.to,
  toTemplateVersion: body.toTemplateVersion,
  organizationIds: body.organizationIds ?? null,
});

/**
 * `/api/v1/admin/taxonomy/migration-runs` — A-04's migration runs (tasks 67.23, 67.7; UC-78; FR-69; 182/42, 182/43;
 * §12.5.6's task-67.23 row). **The request returns at once**: a start, a retry and a revert each record the decision and
 * queue the job on one transaction, and the worker moves the reports (67.24, AD-10). The console polls a run's read
 * for its progress — counts and outcomes per organization, never a value. All of it under `taxonomy.migration_runs.manage`
 * (task 67.13).
 */
@ApiTags('platform')
@Controller('admin/taxonomy/migration-runs')
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class AdminMigrationRunsController {
  constructor(private readonly runs: MigrationRunService) {}

  @Post('preview')
  @HttpCode(200)
  @RequiresAdminPermission(ADMIN_PERMISSION.MIGRATION_RUNS_MANAGE)
  @ApiOperation({
    summary: 'What a run would select, before it starts',
    description: 'Task 67.23 (UX-123). The determination it would land reports by, the reports and organizations it reaches, and what it leaves out as read-only. Starts nothing.',
  })
  @ApiObjectResponse(MigrationSelectionPreviewResponseDto, { status: 200, description: 'The blast radius.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse(UNKNOWN_PAIR)
  @ApiResponse({ status: 409, description: 'No mapping is published for the pair (problem type conflict).', content: PROBLEM })
  async preview(@Body() body: MigrationRunRequestDto): Promise<MigrationSelectionPreviewResponseDto> {
    return new MigrationSelectionPreviewResponseDto(await this.runs.preview(RUN_REQUEST(body)));
  }

  @Post()
  @RequiresAdminPermission(ADMIN_PERMISSION.MIGRATION_RUNS_MANAGE)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_TAXONOMY_MIGRATION_RUN_STARTED, target: { from: AUDIT_TARGET.RESULT } })
  @ApiOperation({
    summary: 'Start a migration run',
    description:
      'Task 67.23 (UC-78; FR-69; 182/42). Selects every movable report on `from` — narrowed to the organizations named — and ' +
      'queues the run. A compatible pair puts each report in force on `to`; a breaking one holds each for its Organization ' +
      'Administrator to accept or decline (182/43). Each report’s pre-migration state is kept (182/41).',
  })
  @ApiObjectResponse(MigrationRunIdResponseDto, { status: 201, description: 'The run is recorded and queued.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse(UNKNOWN_PAIR)
  @ApiResponse({
    status: 409,
    description: 'No mapping is published for the pair, or the run would select no report (problem type conflict).',
    content: PROBLEM,
  })
  async start(@Body() body: MigrationRunRequestDto): Promise<MigrationRunIdResponseDto> {
    return new MigrationRunIdResponseDto(await this.runs.start(RUN_REQUEST(body)));
  }

  @Get()
  @RequiresAdminPermission(ADMIN_PERMISSION.MIGRATION_RUNS_MANAGE)
  @ApiOperation({ summary: 'The latest migration runs, each with its counts', description: 'Task 67.23.' })
  @ApiObjectResponse(MigrationRunsResponseDto, { status: 200, description: 'Newest first.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  async list(): Promise<MigrationRunsResponseDto> {
    return new MigrationRunsResponseDto(await this.runs.list());
  }

  @Get(`:${RUN_ID}`)
  @RequiresAdminPermission(ADMIN_PERMISSION.MIGRATION_RUNS_MANAGE)
  @ApiOperation({
    summary: 'One run’s progress and partial result',
    description: 'Task 67.23 (182/43). Per organization, how many reports stand where — counts only.',
  })
  @ApiParam({ name: RUN_ID, format: 'uuid' })
  @ApiObjectResponse(MigrationRunResponseDto, { status: 200, description: 'The run.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse(UNKNOWN_RUN)
  async one(@Param(RUN_ID, ParseUUIDPipe) id: string): Promise<MigrationRunResponseDto> {
    return new MigrationRunResponseDto(await this.runs.one({ id }));
  }

  @Post(`:${RUN_ID}/retry`)
  @HttpCode(200)
  @RequiresAdminPermission(ADMIN_PERMISSION.MIGRATION_RUNS_MANAGE)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_TAXONOMY_MIGRATION_RUN_RETRIED, target: BY_RUN })
  @ApiOperation({
    summary: 'Retry a run’s failed reports',
    description: 'Task 67.23 (182/42). Queues the run again; the worker moves what it has not moved, which is what failed.',
  })
  @ApiParam({ name: RUN_ID, format: 'uuid' })
  @ApiObjectResponse(MigrationRunIdResponseDto, { status: 200, description: 'The retry is queued.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse(UNKNOWN_RUN)
  @ApiResponse({ status: 409, description: 'Nothing failed, or the run was reverted (problem type conflict).', content: PROBLEM })
  async retry(@Param(RUN_ID, ParseUUIDPipe) id: string): Promise<MigrationRunIdResponseDto> {
    return new MigrationRunIdResponseDto(await this.runs.retry({ id }));
  }

  @Post(`:${RUN_ID}/reversion`)
  @HttpCode(200)
  @RequiresAdminPermission(ADMIN_PERMISSION.MIGRATION_RUNS_MANAGE)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_TAXONOMY_MIGRATION_RUN_REVERTED, target: BY_RUN })
  @ApiOperation({
    summary: 'Revert a run',
    description:
      'Task 67.23 (FR-69; 182/41). Queues the reversion: each report the run moved is put back to its retained state, except ' +
      'one its organization accepted, and the run’s notices are withdrawn. A run is reverted once.',
  })
  @ApiParam({ name: RUN_ID, format: 'uuid' })
  @ApiObjectResponse(MigrationRunIdResponseDto, { status: 200, description: 'The reversion is queued.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse(UNKNOWN_RUN)
  @ApiResponse({ status: 409, description: 'The run was already reverted (problem type conflict).', content: PROBLEM })
  async revert(@Param(RUN_ID, ParseUUIDPipe) id: string): Promise<MigrationRunIdResponseDto> {
    return new MigrationRunIdResponseDto(await this.runs.revert({ id }));
  }
}
