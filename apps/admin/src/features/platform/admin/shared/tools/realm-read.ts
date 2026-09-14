import { API_OUTCOME, type ApiFailure } from '@easyesg/contracts';

/**
 * **Admission test** (`shared-admission-test`): a file here is read by more than one screen folder
 * under `features/platform/admin/`, and says nothing about any one of them.
 *
 * What a console read that did not answer means, in the three arms every admin-realm screen draws
 * (task 67.4) — extracted when A-08's two reads would have been the second and third copies of A-02's
 * mapping. **401 is a session that ended** between the realm guard's probe and this read, which wants
 * a sign-in rather than an explanation; **403 is §5.2's permission state**; everything else is
 * recoverable, with a retry. The api decides, and a screen only draws the answer.
 */
export const REALM_READ = {
  READY: 'ready',
  FORBIDDEN: 'forbidden',
  SIGNED_OUT: 'signed_out',
  UNAVAILABLE: 'unavailable',
} as const;

export type RealmReadFailure =
  | { readonly kind: typeof REALM_READ.FORBIDDEN }
  | { readonly kind: typeof REALM_READ.SIGNED_OUT }
  | { readonly kind: typeof REALM_READ.UNAVAILABLE };

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

export const realmReadFailureOf = (failure: ApiFailure): RealmReadFailure => {
  if (failure.status === API_OUTCOME.Problem) {
    if (failure.problem.status === HTTP_FORBIDDEN) return { kind: REALM_READ.FORBIDDEN };
    if (failure.problem.status === HTTP_UNAUTHORIZED) return { kind: REALM_READ.SIGNED_OUT };
  }
  return { kind: REALM_READ.UNAVAILABLE };
};
