import { Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { readArrival } from '../home';

/**
 * S-05's arrival sentence — UC-15's outcome, stated (task 30.5).
 *
 * `already_member` is the one this exists for: without it, a reader who accepted an invitation to an
 * organization they were already in sees exactly the landing a new member sees, having clicked a
 * link that told them nothing.
 *
 * **It takes the resolved value rather than `searchParams`**, which keeps it a pure render and keeps
 * the page the only place that awaits the address. Reading the parameter here would put a second
 * `searchParams` await on the screen for a value the page has already unwrapped, and `readArrival`
 * is where the "unrecognised is no sentence" rule lives.
 *
 * **Not behind a Suspense boundary, deliberately.** It renders above the heading, so streaming it in
 * late would push the H1 down after paint — the layout shift `async-suspense-boundaries` names as
 * the cost of the pattern. It also awaits nothing over the network: the catalogue is the request's
 * own, already resolved for every other region.
 */
export async function ArrivalNotice({
  joined,
}: {
  readonly joined: string | string[] | undefined;
}) {
  const arrival = readArrival(joined);
  if (arrival === null) return null;

  // Its own translator, scoped to the three grants. A `t(`arrival.${grant}.title`)` against the
  // whole namespace makes TypeScript infer a template-literal key union over every leaf under it —
  // which it refuses as "too complex to represent". Narrowing the namespace narrows the union.
  const t = await getTranslations('organization.home.arrival');

  return (
    <Callout intent={CALLOUT_INTENT.SUCCESS} title={t(`${arrival}.title`)} action={null}>
      {t(`${arrival}.body`)}
    </Callout>
  );
}
