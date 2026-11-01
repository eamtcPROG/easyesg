import {
  PUSH_EVENT_ROUTING,
  PUSH_ROUTING,
  type PushEvent,
  type PushHintCommand,
} from '@api/contracts/push.port';

/**
 * A hint as it travels between processes (task 148) — the command, stamped with when the change happened. **Internal
 * only**: `accountIds` routes it and is stripped before anything reaches a browser (`frameOf`).
 */
export type PushHint = PushHintCommand & { readonly since: Date };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isPushEvent = (value: unknown): value is PushEvent =>
  typeof value === 'string' && Object.hasOwn(PUSH_EVENT_ROUTING, value);

/**
 * A hint read back from JSON — an outbox payload or a Redis message — **validated rather than asserted over**, since
 * both crossed a process boundary. Null for anything that is not a hint this release can route: an unknown event, an
 * organization that is no id, or an account-routed event naming no accounts.
 */
export const readPushHint = (input: {
  readonly event: unknown;
  readonly organizationId: unknown;
  readonly accountIds: unknown;
  readonly since: Date;
}): PushHint | null => {
  const { event, organizationId, accountIds, since } = input;
  if (!isPushEvent(event) || !isUuid(organizationId) || Number.isNaN(since.getTime())) return null;
  if (PUSH_EVENT_ROUTING[event] === PUSH_ROUTING.ORGANIZATION) {
    return { event, organizationId, since } as PushHint;
  }
  if (!Array.isArray(accountIds) || accountIds.length === 0 || !accountIds.every(isUuid)) return null;
  return { event, organizationId, accountIds, since };
};

/** What a replica knows about a connection it holds, for routing: whose it is, and where that account belonged. */
export interface HintAudience {
  readonly accountId: string;
  readonly organizationIds: readonly string[];
}

/**
 * Whether a hint reaches a connection (§12.5.6's task-148 row): an account-routed one reaches the accounts it names; an
 * organization-routed one reaches every connection whose account was an active member there at admission.
 */
export const hintReaches = (hint: PushHint, audience: HintAudience): boolean =>
  'accountIds' in hint
    ? hint.accountIds.includes(audience.accountId)
    : audience.organizationIds.includes(hint.organizationId);

/**
 * The browser frame — **exactly three fields, and no tenant data** (§12.5.6's task-148 row; AD-15's first
 * constraint). Built by naming each field rather than by stripping the hint, so a field added to the hint can never
 * reach a browser by default. `since` is epoch milliseconds.
 */
export const frameOf = (hint: PushHint): { readonly event: PushEvent; readonly organizationId: string; readonly since: number } => ({
  event: hint.event,
  organizationId: hint.organizationId,
  since: hint.since.getTime(),
});
