/**
 * The `@RequiresRole` metadata key.
 *
 * **It lives in a third file because the decorator and the guard import each other**, and
 * `no-circular` caught it on the first run: `@RequiresRole` applies `UseGuards(RequiresRoleGuard)`
 * so the gate cannot be half-applied, and the guard reads the key the decorator sets. Either
 * direction alone is fine; together they are a cycle. A constant belongs to neither of them — it is
 * the contract between them — so this is the shape rather than a workaround for the rule.
 *
 * Namespaced, because Nest metadata keys share one global registry with every library in the
 * process and a bare `'roles'` is a collision waiting for the second one.
 */
export const REQUIRED_ROLES = 'easyesg:required-roles';
