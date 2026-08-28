import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiListResponse, ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresAccount } from '@api/modules/identity/membership/decorators/requires-account.decorator';
import { CountryLegalFormsResponseDto } from '../dto/country-legal-forms.response.dto';
import { CreateOrganizationRequestDto } from '../dto/create-organization.request.dto';
import { OrganizationResponseDto } from '../dto/organization.response.dto';
import { OrganizationService } from '../services/organization.service';

/**
 * `/api/v1/organizations` — the routes that are **not** acts inside an organization (UC-49; FR-13,
 * FR-15).
 *
 * **`@RequiresAccount()`, not `@RequiresRole`, and the split is why this is its own controller.**
 * Its caller is by definition not a member of the organization in question — S-04's entry point is
 * "a verified account with no memberships". `@RequiresRole` cannot express that; it refuses the
 * member-of-nothing, who is exactly this route's caller. `/organization` (singular) carries UC-50's
 * routes behind the OA gate, mirroring the `/members` and `/memberships` split task 25 made for the
 * same reason.
 *
 * **The plural is a collection with no `GET`**, and that is not an omission: "every organization"
 * is not a question this API answers to a tenant, and the caller's own list is `/memberships`.
 */
@ApiTags('organization')
@Controller('organizations')
@RequiresAccount()
export class OrganizationsController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create an organization and become its Organization Administrator',
    description:
      'FR-13 and D-1: the creating user is granted the organization_administrator role by the act ' +
      'of creating, in the same transaction — an organization committed without its founding ' +
      'membership would be unreachable by everyone including its creator. The caller keeps every ' +
      'membership they already held; founding a second organization is an ordinary use of this ' +
      'route. The new organization does not become the session’s active one, so the caller ' +
      'chooses when to switch.',
  })
  @ApiObjectResponse(OrganizationResponseDto, {
    status: 201,
    description: 'The organization as created. Profile fields S-04 does not collect are null.',
  })
  @ApiResponse({
    status: 400,
    description:
      'The country registers no legal-form vocabulary, so the platform does not operate there yet ' +
      '(problem type country-not-supported). No edit to the request will change the answer — GET ' +
      '/organizations/legal-forms lists the countries this route accepts.',
    content: { 'application/problem+json': {} },
  })
  async create(@Body() body: CreateOrganizationRequestDto): Promise<OrganizationResponseDto> {
    const organization = await this.organizationService.create({
      name: body.name,
      countryCode: body.countryCode,
      contactEmail: body.contactEmail ?? null,
      contactPhone: body.contactPhone ?? null,
    });
    return new OrganizationResponseDto(organization);
  }

  @Get('legal-forms')
  @ApiOperation({
    summary: 'The countries an organization may be created in, and each one’s legal forms',
    description:
      'Configuration, not code (AD-4): the set moves without a redeploy and propagates within ' +
      'five seconds. S-04 builds its country field from the entries and S-15 its legal-form field ' +
      'from the matching one, which is why both are answered in a single request. The values are ' +
      'keys — resolve them to labels through the message catalogue.',
  })
  @ApiListResponse(CountryLegalFormsResponseDto, {
    status: 200,
    description: 'One entry per country the platform operates in. A list of one at MVP.',
  })
  listLegalForms(): CountryLegalFormsResponseDto[] {
    return this.organizationService
      .listLegalForms()
      .map((entry) => new CountryLegalFormsResponseDto(entry));
  }
}
