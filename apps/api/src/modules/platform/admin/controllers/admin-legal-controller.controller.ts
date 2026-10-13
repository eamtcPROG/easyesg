import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AUDIT_TARGET, AuditAction } from '@api/app/decorators/audit-action.decorator';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import { RequiresAdminRole } from '../decorators/requires-admin-role.decorator';
import { LegalControllerPublicationResponseDto } from '../dto/legal-controller-publication.response.dto';
import { LegalControllerRecordResponseDto } from '../dto/legal-controller-record.response.dto';
import { PublishLegalControllerRequestDto } from '../dto/publish-legal-controller.request.dto';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { LegalControllerConsoleService } from '../services/legal-controller-console.service';

const PROBLEM = { 'application/problem+json': {} };

const SIGNED_OUT = {
  status: 401,
  description:
    'No usable operator session (problem type authentication-required), or its lifetimes ran out ' +
    '(problem type session-expired).',
  content: PROBLEM,
} as const;

const NOT_PLATFORM_ADMINISTRATOR = {
  status: 403,
  description:
    'The operator’s role is not platform_administrator (problem type insufficient-role), or the request came ' +
    'from an origin other than the console’s.',
  content: PROBLEM,
} as const;

/**
 * `/api/v1/admin/legal-controller` — A-21, the platform operator the legal documents name (task 75; FR-205;
 * §12.5.6's task-75 row (7)).
 *
 * **The save publishes a configuration revision** — served to the terms of service and the privacy notice on every
 * replica within the store's poll, with no release — and declares its audit action, naming the version it put in
 * force. An action noun, `publication`, as A-17's is: a save is the one write, and the log names it.
 */
@ApiTags('platform')
@Controller('admin/legal-controller')
@RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
export class AdminLegalControllerController {
  constructor(private readonly legalController: LegalControllerConsoleService) {}

  @Get()
  @ApiOperation({
    summary: 'Read the platform operator the legal documents name',
    description:
      'FR-205. The registered name, IDNO, registered address and data-protection contact in force, the revision a ' +
      'change is made against, and who published them.',
  })
  @ApiObjectResponse(LegalControllerRecordResponseDto, { status: 200, description: 'The operator in force.' })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  async read(): Promise<LegalControllerRecordResponseDto> {
    return new LegalControllerRecordResponseDto(await this.legalController.read());
  }

  @Post('publication')
  @HttpCode(201)
  @AuditAction({ action: AUDIT_ACTION.ADMIN_LEGAL_CONTROLLER_PUBLISHED, target: { from: AUDIT_TARGET.RESULT } })
  @ApiOperation({
    summary: 'Save the platform operator the legal documents name',
    description:
      'FR-205. Publishes a new revision, which the terms of service and the privacy notice state within seconds ' +
      'and with no release. It does not change either document’s version. Recorded in the system audit log.',
  })
  @ApiObjectResponse(LegalControllerPublicationResponseDto, {
    status: 201,
    description: 'The configuration revision now in force.',
  })
  @ApiResponse({
    status: 400,
    description:
      'A field is blank, the IDNO is not 13 digits or its check digit is wrong, or the contact is not an email ' +
      'address (problem type validation-failed, with the fault as `fault`).',
    content: PROBLEM,
  })
  @ApiResponse(SIGNED_OUT)
  @ApiResponse(NOT_PLATFORM_ADMINISTRATOR)
  @ApiResponse({
    status: 409,
    description:
      'A newer revision is in force (problem type legal-controller-changed), or the values are those in force ' +
      '(problem type conflict).',
    content: PROBLEM,
  })
  async publish(@Body() body: PublishLegalControllerRequestDto): Promise<LegalControllerPublicationResponseDto> {
    return new LegalControllerPublicationResponseDto(await this.legalController.publish(body));
  }
}
