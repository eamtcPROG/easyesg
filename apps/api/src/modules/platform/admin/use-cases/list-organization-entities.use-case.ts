import { OrganizationNotRegisteredError } from '../errors/organization-register.errors';
import type { OrganizationEntitiesStore } from '../interfaces/organization-entities-store.interface';
import type { OrganizationEntity } from '../models/organization-entity.model';

export interface ListOrganizationEntitiesCommand {
  readonly organizationId: string;
  /** The operator reading — the acquisition log's requester (FR-79), from `AdminRealmGuard`. */
  readonly requesterId: string;
}

/**
 * The reporting entities of one organization, as A-02's record lists them (task 175; UC-69) — each company's name,
 * IDNO and whether it is archived, since the IDNO is each entity's (FR-16 as amended) and the register row shows one.
 */
export class ListOrganizationEntities {
  constructor(private readonly store: OrganizationEntitiesStore) {}

  async execute(command: ListOrganizationEntitiesCommand): Promise<readonly OrganizationEntity[]> {
    const entities = await this.store.entities(command);
    if (entities === null) throw new OrganizationNotRegisteredError();
    return entities;
  }
}
