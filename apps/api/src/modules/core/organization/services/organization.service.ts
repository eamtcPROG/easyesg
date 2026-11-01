import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import type { Organization } from '../models/organization.model';
import {
  CreateOrganization,
  type CreateOrganizationCommand,
} from '../use-cases/create-organization.use-case';
import { ListLegalForms, type CountryLegalForms } from '../use-cases/list-legal-forms.use-case';
import {
  UpdateOrganizationProfile,
  type UpdateOrganizationProfileCommand,
} from '../use-cases/update-organization-profile.use-case';
import { ViewOrganization } from '../use-cases/view-organization.use-case';

/**
 * The Nest-aware seam between the organization controllers and the use cases (house rule: controllers
 * call services, services call use cases).
 *
 * **`create` is why this layer is not a pass-through here.** FR-13 grants the Organization
 * Administrator role to *the creating user*, and that identity is ambient request context — so it
 * is resolved here, exactly as `MembershipService.listOwn` resolves the acting account. The
 * alternative is an account id in the request body, which would let any signed-in caller found an
 * organization administered by somebody else.
 *
 * The command type the controller supplies is therefore `Omit`ed rather than restated: adding a
 * field to `CreateOrganizationCommand` adds it to this signature on its own, and the omission list
 * *is* the documentation of what this layer resolves.
 */
@Injectable()
export class OrganizationService {
  constructor(
    private readonly createOrganization: CreateOrganization,
    private readonly viewOrganization: ViewOrganization,
    private readonly updateOrganizationProfile: UpdateOrganizationProfile,
    private readonly listLegalFormsUseCase: ListLegalForms,
  ) {}

  /**
   * `RequiresAccountGuard` has already refused a request with no actor, so reaching this with none
   * is a route that forgot its decorator. It throws rather than trusting that: the alternative is
   * an organization founded with `undefined` as its administrator, which no policy would refuse
   * because `identity.membership.account_id` is a plain column.
   */
  create(
    input: Omit<CreateOrganizationCommand, 'founderAccountId' | 'sessionId'>,
  ): Promise<Organization> {
    const context = requestContext();
    const founderAccountId = context?.actorId;
    const sessionId = context?.sessionId;
    // Both or neither: `AuthGuard` writes them from the same resolved session, so one present
    // without the other is not a state a request can be in — and creating the organization while
    // failing to point the session would leave the founder with the very lock-out the third write
    // exists to prevent.
    if (!founderAccountId || !sessionId) throw new AuthenticationRequiredError();
    return this.createOrganization.execute({ ...input, founderAccountId, sessionId });
  }

  view(): Promise<Organization> {
    return this.viewOrganization.execute();
  }

  updateProfile(command: UpdateOrganizationProfileCommand): Promise<Organization> {
    return this.updateOrganizationProfile.execute(command);
  }

  listLegalForms(): CountryLegalForms[] {
    return this.listLegalFormsUseCase.execute();
  }
}
