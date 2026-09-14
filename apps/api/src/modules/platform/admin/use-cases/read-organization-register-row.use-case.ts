import { OrganizationNotRegisteredError } from '../errors/organization-register.errors';
import type { OrganizationRegisterStore } from '../interfaces/organization-register-store.interface';
import type { OrganizationRegisterRow } from '../models/organization-register.model';

export interface ReadOrganizationRegisterRowCommand {
  readonly organizationId: string;
  /** The operator reading — the acquisition log's requester (FR-79), from `AdminRealmGuard`. */
  readonly requesterId: string;
}

/**
 * One organization's register row (UC-69, FR-76; task 67.9) — the same account-level metadata A-02 lists,
 * read by id for A-07's request form, which names the organization an operator is about to ask. Nothing
 * here is report content (FR-77, D-5); the row's columns are the store's `SELECT` list, as for the page.
 */
export class ReadOrganizationRegisterRow {
  constructor(private readonly store: OrganizationRegisterStore) {}

  async execute(command: ReadOrganizationRegisterRowCommand): Promise<OrganizationRegisterRow> {
    const row = await this.store.find(command);
    if (row === null) throw new OrganizationNotRegisteredError();
    return row;
  }
}
