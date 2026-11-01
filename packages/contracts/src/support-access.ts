import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * Support access by the organization's consent (task 67.9; UC-85, UC-86; FR-78 as amended 14 Sep 2026) — the
 * api's vocabularies (`src/modules/platform/support-access/models/`), mirrored for the two front ends that branch
 * on them: the tenant banner on a request's state, and A-07 on the state, who decided, from which realm, and what
 * a read under a grant opened. Copies changed with their source by hand, for `PROBLEM_TYPE`'s reason, and **held
 * to the generated enums at compile time** as `ADMIN_ROLE` is.
 */

type Schemas = components['schemas'];

/**
 * A request's state, folded by the api from the log's rows against its clock: nobody has answered (for up to
 * 24 hours); granted and within its 60 minutes; declined; nobody answered in time; granted, then ended early;
 * granted, and its 60 minutes ran out.
 */
export const SUPPORT_ACCESS_STATE = {
  AWAITING: 'awaiting',
  ACTIVE: 'active',
  DECLINED: 'declined',
  LAPSED: 'lapsed',
  ENDED: 'ended',
  EXPIRED: 'expired',
} as const;

export type SupportAccessState = (typeof SUPPORT_ACCESS_STATE)[keyof typeof SUPPORT_ACCESS_STATE];

export const SUPPORT_ACCESS_STATE_MIRRORS_WIRE: SameSet<
  SupportAccessState,
  Schemas['SupportAccessRequestResponseDto']['state']
> = true;

/** What a decision row says: the organization's grant or decline, or an end from either realm. */
export const SUPPORT_ACCESS_DECISION = {
  GRANT: 'grant',
  DECLINE: 'decline',
  END: 'end',
} as const;

export type SupportAccessDecisionKind = (typeof SUPPORT_ACCESS_DECISION)[keyof typeof SUPPORT_ACCESS_DECISION];

export const SUPPORT_ACCESS_DECISION_MIRRORS_WIRE: SameSet<
  SupportAccessDecisionKind,
  Schemas['SupportAccessDecisionResponseDto']['kind']
> = true;

/** Who took a decision: a member of the organization, or a Platform Administrator. */
export const SUPPORT_ACCESS_ACTOR_REALM = {
  ORGANIZATION: 'organization',
  PLATFORM: 'platform',
} as const;

export type SupportAccessActorRealm = (typeof SUPPORT_ACCESS_ACTOR_REALM)[keyof typeof SUPPORT_ACCESS_ACTOR_REALM];

export const SUPPORT_ACCESS_ACTOR_REALM_MIRRORS_WIRE: SameSet<
  SupportAccessActorRealm,
  Schemas['SupportAccessDecisionResponseDto']['actorRealm']
> = true;

/** What one read under a grant opened — FR-79's *what was accessed*. */
export const SUPPORT_ACCESS_READ_PURPOSE = {
  REPORTS: 'reports',
  REPORT_MODULES: 'report_modules',
  REPORT_MODULE: 'report_module',
} as const;

export type SupportAccessReadPurpose = (typeof SUPPORT_ACCESS_READ_PURPOSE)[keyof typeof SUPPORT_ACCESS_READ_PURPOSE];

export const SUPPORT_ACCESS_READ_PURPOSE_MIRRORS_WIRE: SameSet<
  SupportAccessReadPurpose,
  Schemas['SupportAccessAccessResponseDto']['purpose']
> = true;
