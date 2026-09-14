import {
  API_OUTCOME,
  type ApiOutcome,
  type ListResult,
  type OrganizationRegisterRow,
} from '@easyesg/contracts';
import type { IndexPage } from '@easyesg/ui';
import { REALM_READ, realmReadFailureOf, type RealmReadFailure } from '../../shared/tools/realm-read';
import { REGISTER_PAGE_SIZE } from './register-search';

/**
 * What the register's read answered, as the arm the section draws (task 67.3).
 *
 * **Four arms, and two of them are refusals that mean opposite things.** `forbidden` is a live
 * operator whose role is not a Platform Administrator's — the permission state §5.2 asks for, which
 * explains the boundary. `signed_out` is a session that ended between the realm guard's probe and
 * this read — revoked, deactivated, or its lifetime run out (task 145) — and the answer is A-01, not
 * an explanation. Everything else the screen cannot use is `unavailable`, the recoverable state.
 */
export const REGISTER_READ = REALM_READ;

export type RegisterRead =
  | { readonly kind: typeof REGISTER_READ.READY; readonly page: IndexPage<OrganizationRegisterRow> }
  | RealmReadFailure;

export const readRegisterOutcome = (input: {
  readonly outcome: ApiOutcome<ListResult<OrganizationRegisterRow>>;
  readonly page: number;
}): RegisterRead => {
  const { outcome } = input;

  if (outcome.status === API_OUTCOME.Ok) {
    const list = outcome.value;
    return {
      kind: REGISTER_READ.READY,
      page: {
        rows: list.items,
        matched: list.total,
        // The route filters, so `unfiltered` is always published; `total` stands in only if an
        // older api omitted it, which reads as "the search matched everything" — never as first use.
        total: list.unfiltered ?? list.total,
        page: input.page,
        pageSize: REGISTER_PAGE_SIZE,
      },
    };
  }

  return realmReadFailureOf(outcome);
};
