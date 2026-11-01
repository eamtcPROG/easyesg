import { ADMIN_ROLE, type AdminRole } from '@easyesg/contracts';

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

export type ConsoleHome = (typeof CONSOLE_HOME)[AdminRole];

export const consoleHomeFor = (role: AdminRole): ConsoleHome => CONSOLE_HOME[role];
