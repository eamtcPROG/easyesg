import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { AdminSessionInvalidError } from '../errors/admin-session.errors';
import type { OrganizationEntity } from '../models/organization-entity.model';
import { ListOrganizationEntities } from '../use-cases/list-organization-entities.use-case';

/**
 * The seam between `OrganizationEntitiesController` and task 175's use case — resolving **who is reading**, for the
 * acquisition log, as `OrganizationMembersService` does, and refusing a request with none.
 */
@Injectable()
export class OrganizationEntitiesService {
  constructor(private readonly listEntities: ListOrganizationEntities) {}

  entities(input: { readonly organizationId: string }): Promise<readonly OrganizationEntity[]> {
    const requesterId = requestContext()?.adminAccountId;
    if (!requesterId) throw new AdminSessionInvalidError();
    return this.listEntities.execute({ ...input, requesterId });
  }
}
