import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { Public } from '@api/app/decorators/public.decorator';
import { LegalControllerResponseDto } from '../dto/legal-controller.response.dto';
import { LegalControllerService } from '../services/legal-controller.service';

/**
 * `/api/v1/legal` — what the legal documents read from the platform rather than from the release (task 75; FR-205;
 * `architecture.md` §12.5.6's task-75 row (8)).
 *
 * **`@Public()`, the decorator's fourth kind**: the terms of service and the privacy notice are read before anyone
 * has an account — FR-205 makes them a precondition of a lawful registration — so the controller they name is too.
 * It discloses only what the documents publish.
 */
@ApiTags('platform')
@Controller('legal')
@Public()
export class LegalDocumentsController {
  constructor(private readonly legal: LegalControllerService) {}

  @Get('controller')
  @ApiOperation({
    summary: 'Read the operator the legal documents name',
    description:
      'UC-178. The platform operator’s registered name, IDNO, registered address and data-protection contact, as ' +
      'the terms of service and the privacy notice state them. Edited on the console; an edit is served within ' +
      'seconds.',
  })
  @ApiObjectResponse(LegalControllerResponseDto, { status: 200, description: 'The operator in force.' })
  @ApiResponse({
    status: 503,
    description: 'No readable operator is in force (problem type legal-controller-unavailable).',
    content: { 'application/problem+json': {} },
  })
  controller(): LegalControllerResponseDto {
    return new LegalControllerResponseDto(this.legal.inForce());
  }
}
