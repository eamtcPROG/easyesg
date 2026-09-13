import type { components } from './generated/v1';

/**
 * The administrative realm's privilege levels (FR-80, UC-87; actors.md's PA and BO) — the
 * consumer-side mirror of `apps/api`'s `ADMIN_ROLE`
 * (`src/modules/platform/admin/models/admin-session.model.ts`),
 * kept here for `PROBLEM_TYPE`'s stated reason: the api produces this package and must never import
 * it, so this is a copy changed together with its source by hand.
 *
 * Added with task 67.1, the first reader that branches on it: the console's home and its navigation
 * section are chosen by privilege level. **The mirror is held to the wire at compile time, not only by
 * `openapi:check`** — `ADMIN_ROLE_MIRRORS_WIRE` stops type-checking the moment the generated enum
 * gains, loses or renames a member this object does not carry, in either direction.
 */
export const ADMIN_ROLE = {
  PLATFORM_ADMINISTRATOR: 'platform_administrator',
  BILLING_OPERATOR: 'billing_operator',
} as const;

export type AdminRole = (typeof ADMIN_ROLE)[keyof typeof ADMIN_ROLE];

type WireAdminRole = components['schemas']['AdminAccountDto']['role'];

/** `true` only while `A` and `B` are the same set: each extends the other. */
type SameSet<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Compiles only while the mirror and the generated enum agree, in both directions. */
export const ADMIN_ROLE_MIRRORS_WIRE: SameSet<AdminRole, WireAdminRole> = true;
