import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresRole } from '@api/modules/identity/membership/decorators/requires-role.decorator';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { OrganizationResponseDto } from '../dto/organization.response.dto';
import { UpdateOrganizationProfileRequestDto } from '../dto/update-organization-profile.request.dto';
import { OrganizationService } from '../services/organization.service';

/**
 * `/api/v1/organization` — S-15's Record screen over the **active** organization (UC-50; FR-15).
 *
 * **Singular and with no id, for `MembersController`'s reason.** The organization comes from the
 * session by way of `AuthGuard`'s membership lookup; an `{organizationId}` segment would be a
 * second, contradictory source of tenancy that a caller can edit (AD-2, UX-2). RLS scopes the row
 * to `app.current_org`, so the only organization these routes can reach is the bound one — the URL
 * has nothing left to say.
 *
 * **Organization Administrator for the read as well as the write**, declared once at the class.
 * actors.md is explicit that RC has "explicitly no access to organization settings", and D-2 makes
 * entity and organization master data OA-owned while the disclosure content is the Contributor's.
 * The registered address is not a lesser privilege than editing it.
 */
@ApiTags('organization')
@Controller('organization')
@RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @ApiOperation({
    summary: 'The active organization’s profile',
    description:
      'FR-15’s legal identity, which propagates into every report the organization produces. ' +
      'Distinct from the billing account (FR-106): the invoiced legal person is not always the ' +
      'reporting entity, particularly in a group structure.',
  })
  @ApiObjectResponse(OrganizationResponseDto, {
    status: 200,
    description: 'The bound organization.',
  })
  @ApiResponse({
    status: 403,
    description:
      'The caller holds no membership in an active organization (problem type ' +
      'membership-required), or holds one in a role that is not organization_administrator ' +
      '(problem type insufficient-role).',
    content: { 'application/problem+json': {} },
  })
  async view(): Promise<OrganizationResponseDto> {
    return new OrganizationResponseDto(await this.organizationService.view());
  }

  @Patch()
  @ApiOperation({
    summary: 'Edit the organization profile',
    description:
      'A patch: a field absent from the body is unchanged, and an explicit null clears it. Every ' +
      'change is attributed and timestamped by the database itself (FR-15), so the change history ' +
      'names the acting user and the field that moved without this route recording anything.',
  })
  @ApiObjectResponse(OrganizationResponseDto, {
    status: 200,
    description: 'The organization as it stands after the change.',
  })
  @ApiResponse({
    status: 400,
    description:
      'The submitted legal form is not registered for the organization’s country (problem type ' +
      'legal-form-unknown) — reachable by changing the country as well as by changing the form — ' +
      'or the submitted country registers no vocabulary at all (problem type ' +
      'country-not-supported).',
    content: { 'application/problem+json': {} },
  })
  async update(
    @Body() body: UpdateOrganizationProfileRequestDto,
  ): Promise<OrganizationResponseDto> {
    // Passed whole: the DTO's optional fields already carry the absent/null distinction the patch
    // type is written around, and rebuilding it field by field here is where that distinction gets
    // flattened by a `?? null` somebody adds later.
    const organization = await this.organizationService.updateProfile({ patch: body });
    return new OrganizationResponseDto(organization);
  }
}
