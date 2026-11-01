import { PERIODS_FROM, type PeriodsFrom } from '@/lib/periods-from';
import { ROUTES, entityRoute, withQuery } from '@/lib/routes';

/**
 * Where S-14's list sends its arrow — back to where the reader came from (§11.5's Back-to-context; project owner,
 * 30 Sep 2026), and up a level to the entity when nothing says where that was: a typed address, a bookmark, a link
 * someone shared. **Pure**, so each origin is a unit spec.
 *
 * `to` is the origin the address answers, the default included, so the caller names the arrow for where it leads.
 */
const BACK_TO: Record<PeriodsFrom, (entityId: string) => string> = {
  [PERIODS_FROM.ENTITIES]: () => ROUTES.ENTITIES,
  [PERIODS_FROM.ENTITY]: (entityId) => entityRoute(entityId),
  // The flow the reader left, with the entity they had chosen still chosen, as its own entity links write it.
  [PERIODS_FROM.NEW_REPORT]: (entityId) => withQuery(ROUTES.REPORT_NEW, `entity=${encodeURIComponent(entityId)}`),
};

export const periodsBack = (input: {
  readonly entityId: string;
  readonly from: PeriodsFrom | null;
}): { readonly href: string; readonly to: PeriodsFrom } => {
  const to = input.from ?? PERIODS_FROM.ENTITY;
  return { href: BACK_TO[to](input.entityId), to };
};
