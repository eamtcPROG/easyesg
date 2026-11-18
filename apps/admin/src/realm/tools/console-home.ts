import { ADMIN_ROLE, type AdminPermission, type AdminRole } from '@easyesg/contracts';
import { CONSOLE_DESTINATIONS, SECTION_OF_ROLE } from './console-sections';

/**
 * A-01's exit, per privilege level — the address an operator lands on after sign-in and at `/`
 * (`design_spec.md` §5.2, A-01; project owner, 13 Sep 2026; task 67.1).
 *
 * **A-02 for a Platform Administrator and A-10 for a Billing Operator.** The register is where support
 * triage starts; the reconciliation workspace is the largest of the daily queues a Billing Operator
 * works, and the one A-11, A-13 and A-14 route from. The design spec carries the reasons.
 *
 * **`satisfies Record<AdminRole, …>` rather than a switch**, so a third privilege level added to the
 * contract is a type error here until it is given a home.
 *
 * Pure, and in `tools/` with its spec (`pure-logic-leaves-the-component`): the index route and the
 * sign-in route both read it, and neither should restate which screen is whose.
 */
export const CONSOLE_HOME = {
  [ADMIN_ROLE.PLATFORM_ADMINISTRATOR]: '/organizations',
  [ADMIN_ROLE.BILLING_OPERATOR]: '/billing/reconciliation',
} as const satisfies Record<AdminRole, string>;

/** Where an operator whose roles open no destination of their section lands (task 67.13): A-19, their own. */
export const OWN_CREDENTIALS_HOME = '/credentials';

/**
 * **Since task 67.13 the home is the first destination the operator's roles open** — A-02 for a Platform Administrator
 * who holds the register's permission, as before, and otherwise the first of their section they can open, or A-19 when
 * they can open none. A Billing Operator's home is the realm's, unchanged. Presentation, like the navigation: a home
 * the roles did not open would answer every operator with a refusal on arrival.
 */
export const consoleHomeFor = (operator: {
  readonly role: AdminRole;
  readonly permissions: readonly AdminPermission[];
}): string => {
  if (operator.role !== ADMIN_ROLE.PLATFORM_ADMINISTRATOR) return CONSOLE_HOME[operator.role];
  const opened = CONSOLE_DESTINATIONS[SECTION_OF_ROLE[operator.role]].find(
    (destination) => destination.permission === undefined || operator.permissions.includes(destination.permission),
  );
  return opened?.href ?? OWN_CREDENTIALS_HOME;
};
