import type {
  OrganizationRegisterPage,
  OrganizationRegisterQuery,
  OrganizationRegisterRow,
} from '../models/organization-register.model';

/** One read of the register, and who is reading — the acquisition log's requester (FR-79). */
export interface OrganizationRegisterRead {
  readonly query: OrganizationRegisterQuery;
  /** `adminAccountId` from `AdminRealmGuard` — never a tenant actor. */
  readonly requesterId: string;
}

/**
 * A-02's read across every organization (task 67.3; FR-76). **Its adapter reads through
 * `esg_admin_ro` and logs the acquisition before it does** (§7.6) — which is why the requester is
 * part of the port rather than something the adapter looks up: the log must name who read, and a
 * store resolving ambient context would be a store that can be called without one.
 */
export interface OrganizationRegisterStore {
  list(read: OrganizationRegisterRead): Promise<OrganizationRegisterPage>;

  /**
   * One organization's row by id — what A-07's request form names the organization with (task 67.9) —
   * or `null` for an id no organization holds. Logged like a page, naming the one organization read.
   */
  find(read: OrganizationRegisterRowRead): Promise<OrganizationRegisterRow | null>;
}

/** One organization's row, and who is reading. */
export interface OrganizationRegisterRowRead {
  readonly organizationId: string;
  readonly requesterId: string;
}

export const ORGANIZATION_REGISTER_STORE = Symbol('ORGANIZATION_REGISTER_STORE');
