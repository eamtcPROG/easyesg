import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AUDIT_TARGET, AuditAction } from '@api/app/decorators/audit-action.decorator';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import {
  PublishRulesRequestDto,
  PublishedRulesResponseDto,
  RulesConsoleResponseDto,
} from '@api/modules/platform/configuration/dto/rules-console.dto';
import { RulesFamilyUnknownError } from '@api/modules/platform/configuration/errors/rules-console.errors';
import { RULE_FAMILY, isRuleFamily } from '@api/modules/platform/configuration/models/rules-console.model';
import { RulesConsoleService } from '@api/modules/platform/configuration/services/rules-console.service';
import { RequiresAdminPermission } from '../decorators/requires-admin-permission.decorator';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { ADMIN_PERMISSION } from '../models/console-role.model';

const PROBLEM = { 'application/problem+json': {} };
const SIGNED_OUT = { status: 401, description: 'No usable operator session (problem type authentication-required).', content: PROBLEM } as const;
const NOT_PERMITTED = {
  status: 403,
  description: 'The operator is not a Platform Administrator, or their roles do not hold the permission (problem type insufficient-role).',
  content: PROBLEM,
} as const;

/**
 * `/api/v1/admin/rules` — A-05's factor sets, applicability thresholds and validation rule set (task 67.8; UC-80 …
 * UC-82; FR-71 … FR-74; §12.5.6's task-67.8 row). **The route is the realm's; the behaviour is `platform/configuration`'s**,
 * A-17's arrangement. All of it under `rules.manage` (task 67.13). A publication sets off what the store announces — a
 * replaced factor set's notice (37.3), a threshold change's (67.8) — and restates no computed figure (FR-35, FR-71).
 */
@ApiTags('platform')
@Controller('admin/rules')
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class AdminRulesController {
  constructor(private readonly rules: RulesConsoleService) {}

  @Get()
  @RequiresAdminPermission(ADMIN_PERMISSION.RULES_MANAGE)
  @ApiOperation({ summary: 'The factor sets, thresholds and validation rules in force', description: 'Task 67.8.' })
  @ApiObjectResponse(RulesConsoleResponseDto, { status: 200, description: 'A-05’s read.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  async slots(): Promise<RulesConsoleResponseDto> {
    return new RulesConsoleResponseDto(await this.rules.slots());
  }

  @Put(':family/:scope')
  @RequiresAdminPermission(ADMIN_PERMISSION.RULES_MANAGE)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_RULES_PUBLISHED, target: { from: AUDIT_TARGET.RESULT } })
  @ApiOperation({
    summary: 'Publish a factor set, the thresholds or the validation rule set',
    description:
      'Task 67.8 (UC-80 … UC-82; 182/50, 182/51). Put in force for the window read, against the revision read. A payload ' +
      'the family’s reader would refuse is refused, and nothing is published.',
  })
  @ApiParam({ name: 'family', enum: Object.values(RULE_FAMILY) })
  @ApiParam({ name: 'scope', example: 'md' })
  @ApiObjectResponse(PublishedRulesResponseDto, { status: 200, description: 'Put in force.' })
  @ApiResponse({ status: 400, description: 'A payload the family’s reader refuses (problem type validation-failed).', content: PROBLEM })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PERMITTED)
  @ApiResponse({ status: 404, description: 'No such rule family (problem type not-found).', content: PROBLEM })
  @ApiResponse({ status: 409, description: 'A colleague changed it since it was read (problem type conflict).', content: PROBLEM })
  async publish(
    // Judged here rather than by `ParseEnumPipe`: beside an `@ApiParam` the pipe reorders the served document's path
    // parameters against the emitted contract, which `docs.e2e-spec.ts` refuses.
    @Param('family') family: string,
    @Param('scope') scope: string,
    @Body() body: PublishRulesRequestDto,
  ): Promise<PublishedRulesResponseDto> {
    if (!isRuleFamily(family)) throw new RulesFamilyUnknownError();
    return new PublishedRulesResponseDto(
      await this.rules.publish({
        family,
        scope,
        payload: body.payload,
        validFrom: body.validFrom ?? null,
        validTo: body.validTo ?? null,
        expectedRevision: body.expectedRevision,
      }),
    );
  }
}
