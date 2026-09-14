import { SetMetadata } from '@nestjs/common';

/**
 * Declares what `audit.system_audit_log` records when this route succeeds (task 67.4; FR-81, FR-159;
 * `architecture.md` §12.5.6's task-67.4 row) — the action, and where the row it acted on comes from.
 *
 * **Declared on the route, written by `AuditInterceptor`, one row per request** (project owner,
 * 13 Sep 2026). The alternative the owner declined wrote a route-keyed row from the interceptor and a
 * second, semantic row from the use case, so every account change would have appeared on A-08 twice.
 *
 * **Every admin-realm write must carry one, and nothing else may** — `route-permissions.spec.ts` fails
 * either way. That is what makes FR-159's *every state-changing action* a property of the surface
 * rather than of whoever added the route remembering.
 *
 * The action is a `string` here because `app/` may not import `modules/**`; a controller passes an
 * `AUDIT_ACTION` member, which is where the spelling is true.
 *
 *     @AuditAction({ action: AUDIT_ACTION.ADMIN_ACCOUNT_SUSPENDED, target: { from: AUDIT_TARGET.PARAM, name: 'accountId' } })
 */
export const AUDIT_ACTION_METADATA = 'easyesg:audit-action';

export const AUDIT_TARGET = {
  /** A route parameter names the row — a change to something that already exists. */
  PARAM: 'param',
  /** The handler's result carries the row's `id` — something the request created. */
  RESULT: 'result',
} as const;

export type AuditTarget =
  | { readonly from: typeof AUDIT_TARGET.PARAM; readonly name: string }
  | { readonly from: typeof AUDIT_TARGET.RESULT };

export interface AuditDeclaration {
  readonly action: string;
  readonly target: AuditTarget;
}

export const AuditAction = (declaration: AuditDeclaration) =>
  SetMetadata(AUDIT_ACTION_METADATA, declaration);
