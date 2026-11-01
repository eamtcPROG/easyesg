import { REPORT_SCOPE, type ReportScope } from '@easyesg/contracts';

/**
 * The two changes of scope S-07 offers (task 78.3; UC-192; `architecture.md` §12.5.6's task-78 row (2)): **raising**,
 * the module list's *Add C1 – C9*, and **lowering**, the bar's *Remove the Comprehensive Module*. Directive-free, so the
 * Server Components that place each read it.
 */
export const SCOPE_CHANGE = { RAISE: 'raise', LOWER: 'lower' } as const;

export type ScopeChange = (typeof SCOPE_CHANGE)[keyof typeof SCOPE_CHANGE];

/**
 * Which change a reader is offered, or `null` — one at most, since a report holds one of two scopes. **Only to a reader
 * who may write the report**: a view-only membership, a locked period and an archived entity each make it read-only
 * (UX-13), and the api refuses all three — the archive and the lock by their triggers — so a control there would be one
 * whose every use is refused.
 */
export function scopeChangeOffered(input: { readonly scope: ReportScope; readonly writable: boolean }): ScopeChange | null {
  if (!input.writable) return null;
  return input.scope === REPORT_SCOPE.BASIC ? SCOPE_CHANGE.RAISE : SCOPE_CHANGE.LOWER;
}
