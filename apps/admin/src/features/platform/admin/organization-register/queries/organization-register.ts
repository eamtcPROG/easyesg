import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type { OrganizationRegisterRow } from '@easyesg/contracts';
import { api } from '~/realm/api/api-client';
import { registerApiPath, type RegisterView } from '../tools/register-search';

/**
 * A-02's read (task 67.3) — `GET /admin/organizations`, through the realm's one client.
 *
 * **The answer is the outcome, not a thrown error**, as the session probe's is: a 403 and a 401 are
 * states the section draws (`register-read.ts`), and Query retrying them would ask the api twice more
 * for an answer that is already final. Only a throw — which `api-client.ts` does not produce — would
 * reach Query's error path.
 *
 * **Keyed by what the api is asked, and not by the open record**, so opening a row never refetches
 * the page it came from. **`keepPreviousData`** is §8.1's *loading — refresh*: the previous page
 * stays readable while the next search, order or page loads, rather than blanking to a skeleton.
 *
 * **No `refetchInterval`**: the register changes when an organization registers, and UX-116 forbids a
 * poll more frequent than the state it reflects. The client's defaults refetch on window focus, which
 * is when an operator returning to the tab would want it.
 */
export const organizationRegisterQuery = (view: Omit<RegisterView, 'selected'>) =>
  queryOptions({
    queryKey: ['admin', 'organization-register', view.search, view.sort, view.direction, view.page] as const,
    queryFn: () => api.list<OrganizationRegisterRow>(registerApiPath(view)),
    placeholderData: keepPreviousData,
  });
