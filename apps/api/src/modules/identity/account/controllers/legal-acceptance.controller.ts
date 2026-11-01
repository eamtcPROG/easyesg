import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { AdmitsPendingLegalAcceptance } from '@api/modules/identity/session/decorators/admits-pending-legal-acceptance.decorator';
import { AcceptLegalDocumentsRequestDto, LegalAcceptanceResponseDto } from '../dto/legal-acceptance.dto';
import { LegalAcceptanceService } from '../services/legal-acceptance.service';

/**
 * `/api/v1/account/legal-acceptance` — S-43's two routes (task 195; FR-205 behaviour 8; §12.5.6's task-195 row).
 *
 * **On the account's prefix** beside the profile, for its reason: an acceptance is the person's, the same in every
 * organization they belong to, so it needs no active membership. No account id in the path.
 *
 * **The only session-bearing routes an account owing an acceptance reaches** (`@AdmitsPendingLegalAcceptance`), which
 * is decision (3): a member who declines may sign out and nothing else. Both stay open to an account owing nothing — its
 * read answers an empty list, and its acceptance records nothing. **No `@RequiresEntitlement`**: no plan decides whether
 * a person accepts the terms.
 */
@ApiTags('identity')
@Controller('account/legal-acceptance')
@AdmitsPendingLegalAcceptance()
export class LegalAcceptanceController {
  constructor(private readonly acceptance: LegalAcceptanceService) {}

  @Get()
  @ApiOperation({
    summary: 'Read what the signed-in person owes an acceptance of',
    description:
      'The terms of service and the privacy notice each appear when the person has not accepted the version in force ' +
      '— never, or an earlier one — with that version and the one last accepted. Empty once nothing is owed; until ' +
      'then every other signed-in request is refused.',
  })
  @ApiObjectResponse(LegalAcceptanceResponseDto, { status: 200, description: 'What is owed.' })
  async read(): Promise<LegalAcceptanceResponseDto> {
    return new LegalAcceptanceResponseDto(await this.acceptance.owed());
  }

  @Post()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Accept the terms of service and the privacy notice in force',
    description:
      'Records the acceptance of each document owed, at the version the page displayed, with the time. A document ' +
      'already accepted at the version in force records nothing, so pressing twice is harmless.',
  })
  @ApiResponse({ status: 204, description: 'Accepted; nothing more is owed.' })
  @ApiResponse({
    status: 409,
    description:
      'A version presented is not the one in force — the page was read before the text was replaced (problem type ' +
      'legal-version-changed). Nothing was recorded; reload to read the versions in force.',
    content: { 'application/problem+json': {} },
  })
  async accept(@Body() body: AcceptLegalDocumentsRequestDto): Promise<void> {
    await this.acceptance.accept(body);
  }
}
