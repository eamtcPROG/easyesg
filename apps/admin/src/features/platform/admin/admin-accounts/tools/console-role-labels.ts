import { CONSOLE_ROLE, type ConsoleRole } from '@easyesg/contracts';

/**
 * How A-08 names each console role (task 67.13) — a role's wire value is snake_case and the catalogue's keys are
 * camelCase, so this table is the one place the two meet, and `satisfies` fails the build for a role with no words.
 */
export const CONSOLE_ROLE_LABEL = {
  [CONSOLE_ROLE.ACCOUNT_ADMINISTRATION]: 'accountAdministration',
  [CONSOLE_ROLE.SUPPORT]: 'support',
  [CONSOLE_ROLE.OPERATIONS]: 'operations',
  [CONSOLE_ROLE.CONTENT_AUTHOR]: 'contentAuthor',
  [CONSOLE_ROLE.CONTENT_PUBLISHER]: 'contentPublisher',
} as const satisfies Record<ConsoleRole, string>;

/** The roles in the vocabulary's order — the order every list of them is drawn in. */
export const CONSOLE_ROLES: readonly ConsoleRole[] = Object.values(CONSOLE_ROLE);
