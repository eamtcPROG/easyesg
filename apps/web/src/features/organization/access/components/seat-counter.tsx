import { USAGE_STANDING, UsageCounter } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import type { SeatRegion } from '../tools/seats';
import { ACCESS_MESSAGES } from './access-messages';

/**
 * S-16's seat counter, beside the heading as the artboard draws it (task 142; UX-52).
 *
 * **The words carry the standing, not only the mark** (UX-102): *one left* and *none left* are in the
 * sentence, because `UsageCounter` marks the row and owns no text. No plan is named and no path is
 * linked — there is no plan until task 53 and nothing to upgrade to, which UX-50 permits to be absent.
 *
 * A Server Component: it renders once per read and holds no state, so its catalogue stays out of the
 * bundle.
 */
export async function SeatCounter({ region }: { readonly region: SeatRegion }) {
  const t = await getTranslations(`${ACCESS_MESSAGES}.seats`);

  let text: string;
  switch (region.standing) {
    case USAGE_STANDING.UNKNOWN:
      text = t('counterUnknown');
      break;
    case USAGE_STANDING.REACHED:
      text = t('counterReached', { used: region.used, limit: region.limit });
      break;
    case USAGE_STANDING.APPROACHING:
      text = t('counterApproaching', { used: region.used, limit: region.limit });
      break;
    case USAGE_STANDING.WITHIN:
      text = t('counter', { used: region.used, limit: region.limit });
      break;
    default: {
      // Exhaustive by type: a standing added to the vocabulary fails to compile here rather than
      // being drawn silently with the "within" sentence.
      const unhandled: never = region;
      throw new Error(`Unhandled seat standing: ${JSON.stringify(unhandled)}`);
    }
  }

  return <UsageCounter standing={region.standing}>{text}</UsageCounter>;
}
