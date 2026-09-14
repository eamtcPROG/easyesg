export const SUPPORT_ACCESS_REQUEST_COUNTS = Symbol('SUPPORT_ACCESS_REQUEST_COUNTS');

/**
 * How many support-access requests each operator raised since an instant — A-08's support-access column
 * (task 67.9; project owner, 14 Sep 2026: *who leans on the privilege is what reviewing it needs*).
 *
 * **Its adapter reads through `esg_admin_ro` and logs the acquisition**, because the requests it counts span
 * every organization. So the port names who is reading, `OrganizationRegisterStore`'s reason.
 */
export interface SupportAccessRequestCounts {
  /** Requests per operator account id; an operator who raised none is absent. */
  since(read: { readonly requesterId: string; readonly since: Date }): Promise<ReadonlyMap<string, number>>;
}
