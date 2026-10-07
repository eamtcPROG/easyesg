/**
 * A unit of work bound to one organization, for code that runs with no request (task 37.3; `architecture.md`
 * §12.5.6's task-37.3/37.4 row, *How the task builds it*).
 *
 * **Why a port.** On the request tier, `TenantTransactionGuard` opens the transaction and binds the tenant before a
 * use case runs, so every tenant repository and `NOTIFICATION_PORT.raise()` write on it without asking. A job on the
 * worker has no request, and `raise()` refuses rather than open a second transaction (P-8). This gives such a job
 * the same footing for one organization at a time: the work runs in a transaction of its own, bound to the
 * organization, and everything inside it reads and writes on that transaction as a request's code would — so a
 * producer is the same code on either tier.
 *
 * **One organization per call, never a loop inside it**: a job reaching several organizations binds each in turn,
 * and a failure in one rolls back that one alone. Nobody is acting, so no actor is bound.
 */
export interface TenantWork {
  inOrganization<T>(scope: { readonly organizationId: string }, work: () => Promise<T>): Promise<T>;
}

export const TENANT_WORK = Symbol('TENANT_WORK');
