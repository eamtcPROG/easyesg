import { STATUS_TONE, StatusChip } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * **Admission test** (`shared-admission-test`): read by more than one part of the providers region — the table's
 * state column and the record's facts — and by nothing outside it.
 *
 * A provider's state as a chip (task 67.11). **Disabled is neutral, not a warning**: both providers ship disabled
 * and a platform may never offer one, so an off provider asks nothing of an operator.
 */
export function ProviderStateChip({ enabled }: { readonly enabled: boolean }) {
  const t = useTranslations('platform.identityProviders.state');

  return enabled ? (
    <StatusChip tone={STATUS_TONE.POSITIVE}>{t('enabled')}</StatusChip>
  ) : (
    <StatusChip tone={STATUS_TONE.NEUTRAL}>{t('disabled')}</StatusChip>
  );
}
