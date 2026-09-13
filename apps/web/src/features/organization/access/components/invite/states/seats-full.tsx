'use client';

import { EntitlementGate } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { KnownSeatRegion } from '../../../tools/seats';
import { ACCESS_MESSAGES } from '../../shared/access-messages';

/**
 * S-16's entitlement gate state, in place of the invitation form (task 142; §6.10, UX-50).
 *
 * **UX-50's four values, three of them present.** The title states the limit reached and what the
 * organization is allowed together, as the specimen's *"You have used all 3 entities the Growth plan
 * allows"* does; the figure is the consumption; the body is what counts as a seat and the way out.
 * The upgrade path is `null` — there is no plan until task 53, and FR-102's note records the path as
 * deferred for this ceiling rather than met. The way out it names instead is one the reader can take
 * on this screen: withdraw an invitation, lapsed ones included, or remove someone's access.
 *
 * A client part because the invite panel it replaces is one; it holds no state of its own.
 */
export function SeatsFull({ region }: { readonly region: KnownSeatRegion }) {
  const t = useTranslations(`${ACCESS_MESSAGES}.seats.gate`);

  return (
    <EntitlementGate
      title={t('title', { limit: region.limit })}
      consumptionLabel={t('consumptionLabel')}
      consumption={t('consumption', { used: region.used, limit: region.limit })}
      used={region.used}
      limit={region.limit}
      actions={null}
    >
      {t('body')}
    </EntitlementGate>
  );
}
