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
 * **It awaits the address itself** (project owner), which is the screen's rule applied to its last
 * prop: a component takes what the route *has* and derives what it needs. The page handed it a
 * resolved `joined` until then, which made the route file unwrap a value only this component reads
 * and meant a second parameter here would have to be threaded from there. `readArrival` is still
 * where the "unrecognised is no sentence" rule lives.
 *
 * **`searchParams` is not I/O**, so awaiting it costs a microtask rather than a round trip — the
 * same distinction `overview-loading.tsx` draws for a Suspense fallback, and the reason this needs
 * no boundary of its own.
 *
 * **Not behind a Suspense boundary, deliberately.** It renders above the heading, so streaming it in
 * late would push the H1 down after paint — the layout shift `async-suspense-boundaries` names as
 * the cost of the pattern. It also awaits nothing over the network: the catalogue is the request's
 * own, already resolved for every other region.
 */
export async function ArrivalNotice({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const arrival = readArrival((await searchParams).joined);
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
