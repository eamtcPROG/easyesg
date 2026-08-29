import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { NO_CONTENT_RESPONSE } from '@api/app/interceptors/global-response.interceptor';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import {
  CreateReportingEntityRequestDto,
  NaceCodeResponseDto,
  ReportingEntityResponseDto,
  UpdateReportingEntityRequestDto,
} from '../dto/reporting-entity.dto';
import { NACE_SEARCH_DEFAULT_LIMIT } from '../constants/nace-search.constants';
import { EntityService } from '../services/entity.service';

/**
 * `/api/v1/entities` — S-13's Index and Record (UC-52, UC-53, UC-55; FR-17, FR-18, FR-20).
 *
 * **Reads are open to every member; writes are Organization Administrator only** (28 Aug 2026,
 * project owner). D-2 says entity master data is OA-*owned*, which is a statement about who
 * maintains it rather than about who may see the entity they are reporting on — and UC-19 has the
 * Contributor completing B1 from values that pre-populate from this record. Refusing an RC the read
 * would make the wizard's own source unreachable to the person filling it in.
 *
 * The gate is therefore declared per method rather than at the class, and every role is named
 * explicitly on the reads: `@RequiresRole` with the three roles is the whole membership, but
 * spelling it out is what makes the decision visible where somebody would otherwise add a fourth
 * role and not think about it.
 *
 * **No `DELETE`.** FR-20 archives, and UC-55 exists because prior filings must stay retrievable
 * after an entity is sold, merged or dissolved. There is no route that removes one.
 *
 * **Recorded deferral: no entitlement gate until task 54.** `apps/api/CLAUDE.md` requires the key
 * or the reason; this is the reason, and the open question it leaves is how many entities a plan
 * admits — UC-151's entitlement-reduced read-only state on S-13 is where that surfaces.
 */
@ApiTags('entity')
@Controller('entities')
export class EntitiesController {
  constructor(private readonly entityService: EntityService) {}

  @Get()
  @RequiresRole(
    MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    MEMBERSHIP_ROLE.EDITOR,
    MEMBERSHIP_ROLE.VIEWER,
  )
  @ApiOperation({
    summary: 'The organization’s reporting entities',
    description:
      'Archived entities are included and carry their status — S-13 filters them out of active ' +
      'selection, and the collection publishes what exists so a reader can find one deliberately.',
  })
  @ApiListResponse(ReportingEntityResponseDto, { status: 200, description: 'Every entity, with its sites.' })
  async list(): Promise<ReportingEntityResponseDto[]> {
    return (await this.entityService.list()).map((entity) => new ReportingEntityResponseDto(entity));
  }

  /**
   * **Before `:entityId`, and the order is load-bearing.** Express matches in declaration order, so
   * a literal segment declared after a parameter never runs — `nace-codes` would bind as an entity
   * id, fail `ParseUUIDPipe` and answer 400 for a route that exists.
   */
  @Get('nace-codes')
  @RequiresRole(
    MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    MEMBERSHIP_ROLE.EDITOR,
    MEMBERSHIP_ROLE.VIEWER,
  )
  @ApiOperation({
    summary: 'Search the activity classifier registered for the organization’s country',
    description:
      'FR-17’s NACE code(s), offered rather than only validated. The classifier is CAEM Rev.2 for ' +
      'Moldova, 1:1 with NACE Rev.2, and it is configuration (AD-4) — so the set moves without a ' +
      'redeploy. **This searches server-side and answers a bounded page**: the classifier is 996 ' +
      'entries across three languages, and shipping it to a browser to filter there is a payload ' +
      'no screen budget admits. The query matches a code by its digits — 10.71, 1071 and 10 71 ' +
      'are one query — and a label without regard to case or diacritics, because a reader types ' +
      'brutarie for brutărie. An empty query answers an empty list rather than an arbitrary slice ' +
      'of the classifier. Labels arrive in the request’s negotiated language.',
  })
  @ApiQuery({ name: 'q', required: false, description: 'What the reader typed. Empty answers nothing.' })
  @ApiQuery({
    name: 'codes',
    required: false,
    description:
      'Comma-separated codes a record already holds, resolved to their words in the negotiated ' +
      'language. Takes precedence over q, matches exactly rather than by prefix, answers in the ' +
      'order given, and drops a code the classifier no longer carries rather than inventing a ' +
      'label for it.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'At most 50; values outside the range are clamped rather than refused.',
  })
  @ApiListResponse(NaceCodeResponseDto, {
    status: 200,
    description: 'Matching codes, code matches before label matches, each in classifier order.',
  })
  async searchNaceCodes(
    @Query('q') query = '',
    @Query('codes') codes = '',
    @Query('limit', new DefaultValuePipe(NACE_SEARCH_DEFAULT_LIMIT), ParseIntPipe) limit: number,
  ): Promise<NaceCodeResponseDto[]> {
    // **`codes` wins where both are sent**, rather than combining them. They are two questions —
    // *what matches this text* and *what do these mean* — and a route that answered both at once
    // would return a list whose order means nothing, since one flow answers in classifier order
    // and the other in the caller's.
    const requested = codes
      .split(',')
      .map((code) => code.trim())
      .filter((code) => code !== '');

    const matches =
      requested.length > 0
        ? await this.entityService.resolveActivityCodes({ codes: requested })
        : await this.entityService.searchActivityCodes({ query, limit });

    return matches.map((match) => new NaceCodeResponseDto(match));
  }

  @Get(':entityId')
  @RequiresRole(
    MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
    MEMBERSHIP_ROLE.EDITOR,
    MEMBERSHIP_ROLE.VIEWER,
  )
  @ApiOperation({ summary: 'One reporting entity, with its sites' })
  @ApiParam({ name: 'entityId', format: 'uuid' })
  @ApiObjectResponse(ReportingEntityResponseDto, { status: 200, description: 'The entity.' })
  @ApiResponse({
    status: 404,
    description: 'No entity of the active organization has that id — including when it is another tenant’s.',
    content: { 'application/problem+json': {} },
  })
  async view(
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ): Promise<ReportingEntityResponseDto> {
    return new ReportingEntityResponseDto(await this.entityService.view(entityId));
  }

  @Post()
  @HttpCode(201)
  @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Create a reporting entity',
    description:
      'An organization may hold several: most SMEs hold exactly one and the model does not assume ' +
      'it (FR-17). Sites may be supplied now or added later.',
  })
  @ApiObjectResponse(ReportingEntityResponseDto, { status: 201, description: 'The entity as created.' })
  @ApiResponse({
    status: 400,
    description:
      'An activity code the organization’s country does not register (problem type ' +
      'nace-code-unknown). The classifier is CAEM Rev.2 for Moldova, 1:1 with NACE Rev.2.',
    content: { 'application/problem+json': {} },
  })
  async create(
    @Body() body: CreateReportingEntityRequestDto,
  ): Promise<ReportingEntityResponseDto> {
    const entity = await this.entityService.create({
      entity: {
        name: body.name,
        legalForm: body.legalForm ?? null,
        naceCodes: body.naceCodes ?? [],
        sites: (body.sites ?? []).map((site) => ({
          id: site.id,
          name: site.name,
          addressLine1: site.addressLine1 ?? null,
          locality: site.locality ?? null,
          postalCode: site.postalCode ?? null,
          countryCode: site.countryCode?.toUpperCase() ?? null,
          latitude: site.latitude ?? null,
          longitude: site.longitude ?? null,
        })),
      },
    });
    return new ReportingEntityResponseDto(entity);
  }

  @Patch(':entityId')
  @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Edit a reporting entity’s master data',
    description:
      'A patch: a field absent is unchanged. Sending `sites` saves the whole collection. A report ' +
      'for a closed period keeps the values in force when it was prepared (FR-18), so an edit here ' +
      'is not retroactive — S-13 states that consequence before the save.',
  })
  @ApiParam({ name: 'entityId', format: 'uuid' })
  @ApiObjectResponse(ReportingEntityResponseDto, { status: 200, description: 'The entity after the change.' })
  @ApiResponse({
    status: 400,
    description:
      'A consolidated basis with nothing inside the boundary (problem type ' +
      'consolidation-boundary-empty), or an unregistered activity code (nace-code-unknown).',
    content: { 'application/problem+json': {} },
  })
  @ApiResponse({
    status: 409,
    description:
      'The entity is archived, so its master data is read-only (problem type entity-archived). It ' +
      'stays readable — its historical reports and exports must remain retrievable.',
    content: { 'application/problem+json': {} },
  })
  async update(
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Body() body: UpdateReportingEntityRequestDto,
  ): Promise<ReportingEntityResponseDto> {
    const entity = await this.entityService.update({
      entityId,
      patch: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.legalForm !== undefined ? { legalForm: body.legalForm } : {}),
        ...(body.naceCodes !== undefined ? { naceCodes: body.naceCodes } : {}),
        ...(body.consolidationBasis !== undefined
          ? { consolidationBasis: body.consolidationBasis }
          : {}),
        ...(body.consolidationMembers !== undefined
          ? {
              consolidationMembers: body.consolidationMembers.map((member) => ({
                id: member.id,
                name: member.name,
                idno: member.idno ?? null,
                lei: member.lei ?? null,
                countryCode: member.countryCode?.toUpperCase() ?? null,
              })),
            }
          : {}),
        ...(body.sites !== undefined
          ? {
              sites: body.sites.map((site) => ({
                id: site.id,
                name: site.name,
                addressLine1: site.addressLine1 ?? null,
                locality: site.locality ?? null,
                postalCode: site.postalCode ?? null,
                countryCode: site.countryCode?.toUpperCase() ?? null,
                latitude: site.latitude ?? null,
                longitude: site.longitude ?? null,
              })),
            }
          : {}),
      },
    });
    return new ReportingEntityResponseDto(entity);
  }

  @Post(':entityId/archive')
  @HttpCode(204)
  @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
  @ApiOperation({
    summary: 'Archive a reporting entity',
    description:
      'Removes it from active selection and retains its historical reports and exports intact ' +
      '(FR-20, UC-55) — the entity is sold, merged or dissolved, and prior filings must stay ' +
      'retrievable. An action-noun route rather than DELETE, because nothing is deleted.',
  })
  @ApiParam({ name: 'entityId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'The entity was archived.' })
  @ApiResponse({
    status: 409,
    description: 'The entity is already archived (problem type entity-archived).',
    content: { 'application/problem+json': {} },
  })
  async archive(
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ): Promise<typeof NO_CONTENT_RESPONSE> {
    await this.entityService.archive({ entityId });
    return NO_CONTENT_RESPONSE;
  }
}
