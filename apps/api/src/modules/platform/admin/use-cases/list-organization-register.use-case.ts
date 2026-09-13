import type { OrganizationRegisterStore } from '../interfaces/organization-register-store.interface';
import type {
  OrganizationRegisterPage,
  OrganizationRegisterQuery,
} from '../models/organization-register.model';

export interface ListOrganizationRegisterCommand {
  readonly query: OrganizationRegisterQuery;
  /** The operator reading — the acquisition log's requester (FR-79), from `AdminRealmGuard`. */
  readonly requesterId: string;
}

/**
 * UC-69 — view and search the organization register (FR-76; task 67.3).
 *
 * **A pass-through, and that is the honest shape**, `ListAccess`'s for its reasons: who may read is
 * `AdminRealmGuard`'s, that every read is logged is `admin-readonly.ts`'s, and what a row may carry —
 * account-level metadata and never report content (FR-77, D-5) — is the store's `SELECT` list, where
 * nothing else can add a column. A second filter here "for safety" would be a second place to ask.
 */
export class ListOrganizationRegister {
  constructor(private readonly store: OrganizationRegisterStore) {}

  execute(command: ListOrganizationRegisterCommand): Promise<OrganizationRegisterPage> {
    return this.store.list(command);
  }
}
