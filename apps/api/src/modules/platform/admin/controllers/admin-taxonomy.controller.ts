import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AUDIT_TARGET, AuditAction } from '@api/app/decorators/audit-action.decorator';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import {
  AdoptTaxonomyVersionRequestDto,
  LabelDiffResponseDto,
  PublishVersionMappingRequestDto,
  PublishedTaxonomyResponseDto,
  RegisterTaxonomyVersionRequestDto,
  TaxonomyConsoleResponseDto,
  TaxonomyExposureResponseDto,
  VersionMappingResponseDto,
  mappingOf,
} from '@api/modules/platform/taxonomy/dto/taxonomy-console.dto';
import { TaxonomyConsoleService } from '@api/modules/platform/taxonomy/services/taxonomy-console.service';
import { RequiresAdminPermission } from '../decorators/requires-admin-permission.decorator';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { ADMIN_PERMISSION } from '../models/console-role.model';

const PROBLEM = { 'application/problem+json': {} };
const FROM = 'from';
const TO = 'to';
const BY_RESULT = { from: AUDIT_TARGET.RESULT } as const;
const VERSION_PARAM = (name: string) =>
  ({ name, example: '2026-05-01', description: 'A registered version, EFRAG’s own `YYYY-MM-DD`.' }) as const;

const SIGNED_OUT = { status: 401, description: 'No usable operator session (problem type authentication-required).', content: PROBLEM } as const;
const NOT_PERMITTED = {
  status: 403,
  description: 'The operator is not a Platform Administrator, or their roles do not hold the permission (problem type insufficient-role).',
  content: PROBLEM,
} as const;
const UNKNOWN_VERSION = { status: 404, description: 'A version the store does not register (problem type not-found).', content: PROBLEM } as const;
const CHANGED = {
  status: 409,
  description: 'A colleague changed it since it was read (problem type conflict).',
  content: PROBLEM,
} as const;

/**
 * `/api/v1/admin/taxonomy` — A-04's versions, mappings, adoption and exposure (tasks 67.21, 67.22, 67.6; UC-75 … UC-77;
 * FR-65 … FR-68; §12.5.6's task-67.21 row). **The route is the realm's; the behaviour is `platform/taxonomy`'s**, A-17's
 * arrangement. All of it under `taxonomy.manage` (task 67.13). **A version rollout is two audit actions** (182/52): a
 * version registered and the adoption schedule changed — each its own route, each its own row.
 */
@ApiTags('platform')
@Controller('admin/taxonomy')
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class AdminTaxonomyController {
  constructor(private readonly taxonomy: TaxonomyConsoleService) {}

  @Get()
  @RequiresAdminPermission(ADMIN_PERMISSION.TAXONOMY_MANAGE)
  @ApiOperation({ summary: 'Registered versions, committed candidates, the adoption schedule and each pair’s mapping', description: 'Task 67.21.' })
  @ApiObjectResponse(TaxonomyConsoleResponseDto, { status: 200, description: 'A-04’s read.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  async console(): Promise<TaxonomyConsoleResponseDto> {
    return new TaxonomyConsoleResponseDto(await this.taxonomy.console());
  }

  @Post('versions')
  @RequiresAdminPermission(ADMIN_PERMISSION.TAXONOMY_MANAGE)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_TAXONOMY_VERSION_REGISTERED, target: BY_RESULT })
  @ApiOperation({
    summary: 'Register a committed taxonomy version',
    description:
      'Task 67.21 (UC-75; 182/48). Publishes the candidate’s artefacts — its taxonomy, classifications, templates and ' +
      'their maps — as one set. Registering is not adopting: no report pins it until the schedule says so.',
  })
  @ApiObjectResponse(PublishedTaxonomyResponseDto, { status: 201, description: 'The version is registered; the id is its publication.' })
  @ApiResponse({ status: 400, description: 'An artefact the store refuses (problem type validation-failed).', content: PROBLEM })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse({ status: 404, description: 'No committed candidate holds the version (problem type not-found).', content: PROBLEM })
  async register(@Body() body: RegisterTaxonomyVersionRequestDto): Promise<PublishedTaxonomyResponseDto> {
    return new PublishedTaxonomyResponseDto(await this.taxonomy.register({ version: body.version }));
  }

  @Get(`mappings/:${FROM}/:${TO}/proposal`)
  @RequiresAdminPermission(ADMIN_PERMISSION.TAXONOMY_MANAGE)
  @ApiOperation({
    summary: 'Propose a pair’s mapping from the two versions’ shapes',
    description: 'Task 67.21 (UC-76). Every field whose shape differs, and the determination they imply — for the operator to complete.',
  })
  @ApiParam(VERSION_PARAM(FROM))
  @ApiParam(VERSION_PARAM(TO))
  @ApiObjectResponse(VersionMappingResponseDto, { status: 200, description: 'The proposal; nothing is written.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse(UNKNOWN_VERSION)
  propose(@Param(FROM) from: string, @Param(TO) to: string): VersionMappingResponseDto {
    return this.taxonomy.propose({ from, to });
  }

  @Put(`mappings/:${FROM}/:${TO}`)
  @RequiresAdminPermission(ADMIN_PERMISSION.TAXONOMY_MANAGE)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_TAXONOMY_MAPPING_PUBLISHED, target: BY_RESULT })
  @ApiOperation({
    summary: 'Publish a pair’s mapping and determination',
    description: 'Task 67.21 (UC-76; FR-67; 182/39, 182/40). A field’s kind of change alone; a pair that removes or alters a field is breaking.',
  })
  @ApiParam(VERSION_PARAM(FROM))
  @ApiParam(VERSION_PARAM(TO))
  @ApiObjectResponse(PublishedTaxonomyResponseDto, { status: 200, description: 'The mapping put in force.' })
  @ApiResponse({
    status: 400,
    description: 'A field its versions do not hold as stated, or a determination its fields refuse (problem type validation-failed).',
    content: PROBLEM,
  })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse(UNKNOWN_VERSION)
  @ApiResponse(CHANGED)
  async publishMapping(
    @Param(FROM) from: string,
    @Param(TO) to: string,
    @Body() body: PublishVersionMappingRequestDto,
  ): Promise<PublishedTaxonomyResponseDto> {
    return new PublishedTaxonomyResponseDto(
      await this.taxonomy.publishMapping({ mapping: mappingOf({ from, to, body }), expectedRevision: body.expectedRevision }),
    );
  }

  @Post('adoption')
  @HttpCode(200)
  @RequiresAdminPermission(ADMIN_PERMISSION.TAXONOMY_MANAGE)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_TAXONOMY_ADOPTION_CHANGED, target: BY_RESULT })
  @ApiOperation({
    summary: 'Adopt a registered version from a day',
    description:
      'Task 67.21 (FR-66; 182/52). Periods starting on or after the day pin the version and its template release. ' +
      'Only forward; its compensation is another adoption.',
  })
  @ApiObjectResponse(PublishedTaxonomyResponseDto, { status: 200, description: 'The adoption put in force.' })
  @ApiResponse({ status: 400, description: 'A day not after today and the open window’s start (problem type validation-failed).', content: PROBLEM })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse(UNKNOWN_VERSION)
  @ApiResponse(CHANGED)
  async adopt(@Body() body: AdoptTaxonomyVersionRequestDto): Promise<PublishedTaxonomyResponseDto> {
    return new PublishedTaxonomyResponseDto(await this.taxonomy.adopt(body));
  }

  @Get('exposure')
  @RequiresAdminPermission(ADMIN_PERMISSION.TAXONOMY_MANAGE)
  @ApiOperation({
    summary: 'Reports pinned to a superseded version',
    description: 'Task 67.22 (UC-77; FR-68; 182/49). Grouped by organization and by version, counts only, never a value.',
  })
  @ApiObjectResponse(TaxonomyExposureResponseDto, { status: 200, description: 'The exposure.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  async exposure(): Promise<TaxonomyExposureResponseDto> {
    return new TaxonomyExposureResponseDto(await this.taxonomy.exposure());
  }

  @Get(`label-diff/:${FROM}/:${TO}`)
  @RequiresAdminPermission(ADMIN_PERMISSION.TAXONOMY_MANAGE)
  @ApiOperation({
    summary: 'EFRAG’s labels that changed between a pair, in a locale',
    description: 'Task 67.6. Official only where EFRAG publishes the locale for both versions.',
  })
  @ApiParam(VERSION_PARAM(FROM))
  @ApiParam(VERSION_PARAM(TO))
  @ApiQuery({ name: 'locale', enum: LOCALES })
  @ApiObjectResponse(LabelDiffResponseDto, { status: 200, description: 'The changed labels.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse(UNKNOWN_VERSION)
  labelDiff(
    @Param(FROM) from: string,
    @Param(TO) to: string,
    @Query('locale', new ParseEnumPipe(Object.fromEntries(LOCALES.map((locale) => [locale, locale])))) locale: Locale,
  ): LabelDiffResponseDto {
    return new LabelDiffResponseDto(this.taxonomy.labelDiff({ from, to, locale }));
  }
}
