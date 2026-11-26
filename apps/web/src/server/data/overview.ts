import 'server-only';
import { cache } from 'react';
import { toOverviewRows, type OverviewRow } from '@/features/organization/home/tools/overview';
import { readOrganizationPeriods } from './periods';
import { TENANT_READ, type TenantReadRefusal } from './tenant-read';

/**
 * S-05's rows, read once per request and dated once (task 255).
 *
 * **Two regions read them since the rail's deadline card**: the overview, which answers UX-6's three questions, and
 * the card beside it, which names the next deadline. Each is a sibling boundary of its own so neither waits on the
 * other's render, and each read alone would cost a second `GET /periods` and — worse — a second `new Date()`, so a
 * request straddling midnight in a period's zone could have the attention list call a filing overdue while the card
 * counted it as due today. **`cache()` makes the read and the clock one** for the render: the first caller starts
 * the request, the second awaits the same promise, and `toOverviewRows` runs under one instant. It is scoped to one
 * render, like `readMemberships`, so it is not a cache in the §14.2 sense and cannot serve one tenant's rows to
 * another.
 */
export type OverviewRowsRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly rows: readonly OverviewRow[];
      /** Epoch-ms (OQ-50): the instant the rows were dated at, for anything else on the screen that asks the time. */
      readonly now: number;
    }
  | TenantReadRefusal;

export const readOverviewRows = cache(async (): Promise<OverviewRowsRead> => {
  const read = await readOrganizationPeriods();
  if (read.status !== TENANT_READ.READY) return read;
  // **The one clock** — where the time enters the overview, exactly once per request. It travels with the rows, so an
  // invitation's *lapsed* is read at the same instant as a filing's *overdue*.
  const now = new Date();
  return { status: TENANT_READ.READY, rows: toOverviewRows({ periods: read.periods, now }), now: now.getTime() };
});
