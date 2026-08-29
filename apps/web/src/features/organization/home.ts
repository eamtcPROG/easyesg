import { MEMBERSHIP_GRANT_KIND, type MembershipGrantKind } from '@easyesg/contracts';

/**
 * S-05's own rules (UC-16, UC-67; FR-12, FR-23) — pure, so both are unit specs rather than browser
 * journeys. The same split `features/organization/access.ts` makes.
 */

/**
 * Which arrival sentence to show, from `?joined=`.
 *
 * **An unrecognised value is no sentence rather than a default one.** The parameter reaches this
 * screen through the address bar, so it is whatever somebody typed — and a home that announced
 * *"you now have access"* to a reader who edited a query string would be stating something the
 * product never decided. Absent and unrecognised are the same fact here: nothing to say.
 */
export const readArrival = (value: string | string[] | undefined): MembershipGrantKind | null => {
  const single = Array.isArray(value) ? value[0] : value;
  return (
    Object.values(MEMBERSHIP_GRANT_KIND).find((grant) => grant === single) ?? null
  );
};
