import { ADMIN_ROLE, type AdminRole } from '@easyesg/contracts';

/**
 * What A-08's record states a realm may do (task 67.4) — the artboard's *powers, by realm and not by
 * person*, which is `actors.md` §5's matrix read for the two platform-side actors. **Descriptive, not a
 * gate**: `AdminRealmGuard` is what refuses; this says in advance what it will refuse.
 *
 * **Every Platform Administrator holds every platform power** until task 67.5 gives the role levels
 * (`design_spec.md` §5.2 A-08's deferral) — which is exactly what this table states, so it changes with
 * that task rather than drifting from it.
 */
export const REALM_POWER = {
  CONTENT: 'content',
  PUBLICATION: 'publication',
  SUPPORT: 'support',
  ACCOUNTS: 'accounts',
  PLANS: 'plans',
  INVOICES: 'invoices',
  /** Held by nobody on the platform side, ever (D-5, FR-77). */
  TENANT_DATA: 'tenantData',
} as const;

export type RealmPower = (typeof REALM_POWER)[keyof typeof REALM_POWER];

export const REALM_POWER_HOLDING = {
  HELD: 'held',
  NOT_HELD: 'not_held',
  NOBODY: 'nobody',
} as const;

export type RealmPowerHolding = (typeof REALM_POWER_HOLDING)[keyof typeof REALM_POWER_HOLDING];

const HELD_BY: Readonly<Record<AdminRole, ReadonlySet<RealmPower>>> = {
  [ADMIN_ROLE.PLATFORM_ADMINISTRATOR]: new Set([
    REALM_POWER.CONTENT,
    REALM_POWER.PUBLICATION,
    REALM_POWER.SUPPORT,
    REALM_POWER.ACCOUNTS,
  ]),
  [ADMIN_ROLE.BILLING_OPERATOR]: new Set([REALM_POWER.PLANS, REALM_POWER.INVOICES]),
};

export const realmPowersOf = (
  role: AdminRole,
): readonly { readonly power: RealmPower; readonly holding: RealmPowerHolding }[] =>
  Object.values(REALM_POWER).map((power) => ({
    power,
    holding:
      power === REALM_POWER.TENANT_DATA
        ? REALM_POWER_HOLDING.NOBODY
        : HELD_BY[role].has(power)
          ? REALM_POWER_HOLDING.HELD
          : REALM_POWER_HOLDING.NOT_HELD,
  }));
